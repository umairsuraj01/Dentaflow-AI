# segmentation_runner.py — Real MeshSegNet inference on dental meshes.
#
# Input: STL mesh file
# Output: per-cell (face) labels and probabilities
#
# Pipeline:
#   1. Load mesh with vedo
#   2. Downsample to ≤10,000 cells
#   3. Extract 15 features per cell (vertices + barycenters + normals)
#   4. Build adjacency matrices (A_S, A_L)
#   5. Run MeshSegNet forward pass
#   6. Map downsampled labels back to original mesh

from __future__ import annotations

import logging
import time

import numpy as np
from scipy.spatial import distance_matrix

logger = logging.getLogger(__name__)

NUM_CLASSES = 15
MAX_CELLS = 10000


def detect_jaw_type(mesh) -> str:
    """Detect if mesh is upper or lower jaw from surface normals.

    Upper jaw (maxillary): normals predominantly face downward (Y < 0).
    Lower jaw (mandibular): normals predominantly face upward (Y > 0).
    """
    mesh.compute_normals()
    normals = mesh.celldata["Normals"]
    avg_ny = np.mean(normals[:, 1])
    jaw = "upper" if avg_ny < 0 else "lower"
    logger.info("Detected jaw type: %s (avg normal Y=%.3f)", jaw, avg_ny)
    return jaw


def _get_cell_centers(mesh) -> np.ndarray:
    """Get cell centers as numpy array (compatible with old/new vedo)."""
    cc = mesh.cell_centers()
    if hasattr(cc, 'points'):
        return np.asarray(cc.points)
    return np.asarray(cc)


def preprocess_mesh(mesh) -> tuple[np.ndarray, np.ndarray, np.ndarray]:
    """Extract features from a vedo mesh for MeshSegNet.

    Returns:
        X: (N, 15) feature matrix — 9 cell vertices + 3 barycenters + 3 normals
        A_S: (N, N) small-scale adjacency (distance < 0.1)
        A_L: (N, N) large-scale adjacency (distance < 0.2)
    """
    # Center mesh at origin
    points = np.asarray(mesh.points).copy()
    mean_center = mesh.center_of_mass()
    points[:, 0:3] -= mean_center[0:3]

    # Cell vertices (9 features: 3 vertices × 3 coords)
    ids = np.array(mesh.cells)
    cells = points[ids].reshape(mesh.ncells, 9).astype(np.float32)

    # Normals
    mesh.compute_normals()
    normals = mesh.celldata["Normals"].copy()

    # Barycenters
    barycenters = _get_cell_centers(mesh).copy()
    barycenters -= mean_center[0:3]

    # Normalize
    maxs = points.max(axis=0)
    mins = points.min(axis=0)
    means = points.mean(axis=0)
    stds = points.std(axis=0)
    nmeans = normals.mean(axis=0)
    nstds = normals.std(axis=0)

    # Avoid division by zero
    stds[stds < 1e-8] = 1.0
    nstds[nstds < 1e-8] = 1.0
    denom = maxs - mins
    denom[denom < 1e-8] = 1.0

    for i in range(3):
        cells[:, i] = (cells[:, i] - means[i]) / stds[i]
        cells[:, i + 3] = (cells[:, i + 3] - means[i]) / stds[i]
        cells[:, i + 6] = (cells[:, i + 6] - means[i]) / stds[i]
        barycenters[:, i] = (barycenters[:, i] - mins[i]) / denom[i]
        normals[:, i] = (normals[:, i] - nmeans[i]) / nstds[i]

    X = np.column_stack((cells, barycenters, normals))  # (N, 15)

    # Build adjacency matrices from barycenter distances
    D = distance_matrix(X[:, 9:12], X[:, 9:12])

    A_S = np.zeros_like(D, dtype=np.float32)
    A_S[D < 0.1] = 1.0
    row_sums = A_S.sum(axis=1, keepdims=True)
    row_sums[row_sums == 0] = 1.0
    A_S = A_S / row_sums

    A_L = np.zeros_like(D, dtype=np.float32)
    A_L[D < 0.2] = 1.0
    row_sums = A_L.sum(axis=1, keepdims=True)
    row_sums[row_sums == 0] = 1.0
    A_L = A_L / row_sums

    return X.astype(np.float32), A_S, A_L


def run_inference(
    stl_path: str,
    jaw: str | None = None,
) -> tuple[np.ndarray, np.ndarray, str]:
    """Run MeshSegNet inference on an STL file.

    Args:
        stl_path: Path to the STL mesh file.
        jaw: "upper" or "lower". Auto-detected if None.

    Returns:
        face_labels: (F,) int array — class index per original face (0=gum, 1-14=teeth).
        face_probs: (F, 15) float array — class probabilities per original face.
        jaw: Detected or specified jaw type.
    """
    import torch
    import vedo

    from ai.models.model_loader import load_model, get_device

    start = time.time()

    # 1. Load mesh
    logger.info("Loading mesh: %s", stl_path)
    mesh = vedo.load(stl_path)
    original_ncells = mesh.ncells
    logger.info("Mesh loaded: %d cells", original_ncells)

    # 2. Detect jaw type
    if jaw is None:
        jaw = detect_jaw_type(mesh)

    # 3. Load model
    device = get_device()
    model = load_model(jaw=jaw, device=device)
    if model is None:
        raise RuntimeError(
            f"No pretrained weights found for {jaw} jaw. "
            f"Expected checkpoint in ai/checkpoints/"
        )

    # 4. Downsample if needed
    if mesh.ncells > MAX_CELLS:
        logger.info("Downsampling from %d to %d cells...", mesh.ncells, MAX_CELLS)
        ratio = MAX_CELLS / mesh.ncells
        mesh_d = mesh.clone().decimate(fraction=ratio)
        logger.info("Downsampled to %d cells", mesh_d.ncells)
    else:
        mesh_d = mesh.clone()

    # 5. Preprocess
    logger.info("Preprocessing %d cells...", mesh_d.ncells)
    X, A_S, A_L = preprocess_mesh(mesh_d)

    # 6. Run model
    logger.info("Running MeshSegNet inference on %s...", device)
    X_t = torch.from_numpy(X.T[np.newaxis, :, :]).to(device, dtype=torch.float)
    A_S_t = torch.from_numpy(A_S[np.newaxis, :, :]).to(device, dtype=torch.float)
    A_L_t = torch.from_numpy(A_L[np.newaxis, :, :]).to(device, dtype=torch.float)

    with torch.no_grad():
        probs = model(X_t, A_S_t, A_L_t)  # (1, N, 15)

    probs_np = probs.cpu().numpy()[0]  # (N, 15)
    labels_d = np.argmax(probs_np, axis=1)  # (N,)

    elapsed_model = time.time() - start
    unique_labels = np.unique(labels_d)
    logger.info(
        "Model inference done in %.2fs: %d unique labels on downsampled mesh",
        elapsed_model, len(unique_labels),
    )

    # 7. Map labels back to original mesh (if downsampled)
    if mesh_d.ncells < original_ncells:
        logger.info("Mapping labels back to original %d cells...", original_ncells)
        face_labels, face_probs = _upsample_labels(
            mesh, mesh_d, labels_d, probs_np,
        )
    else:
        face_labels = labels_d
        face_probs = probs_np

    elapsed = time.time() - start
    logger.info(
        "Segmentation complete: %d cells, %d unique labels, %.2fs total",
        len(face_labels), len(np.unique(face_labels)), elapsed,
    )

    return face_labels, face_probs, jaw


def _upsample_labels(
    original_mesh,
    downsampled_mesh,
    labels_d: np.ndarray,
    probs_d: np.ndarray,
) -> tuple[np.ndarray, np.ndarray]:
    """Map labels from downsampled mesh back to original mesh.

    Uses distance-weighted probability interpolation (not label voting)
    for smooth, clean boundaries. Each original face gets the weighted
    average of its k nearest downsampled faces' probability vectors,
    then takes argmax for the label.
    """
    from scipy.spatial import cKDTree

    orig_centers = _get_cell_centers(original_mesh)
    down_centers = _get_cell_centers(downsampled_mesh)

    tree = cKDTree(down_centers)
    k = min(15, len(down_centers))
    dists, nn_indices = tree.query(orig_centers, k=k)

    n_orig = len(orig_centers)
    n_classes = probs_d.shape[1]

    # Distance-weighted probability interpolation (vectorized)
    weights = 1.0 / (dists + 1e-8)  # (N, k)
    weights_norm = weights / weights.sum(axis=1, keepdims=True)  # normalize

    # Gather neighbor probabilities: (N, k, C)
    neighbor_probs = probs_d[nn_indices]  # (N, k, C)

    # Weighted average of probabilities: (N, C)
    face_probs = np.einsum('nk,nkc->nc', weights_norm, neighbor_probs).astype(np.float32)

    # Labels from argmax on interpolated probabilities (smooth!)
    face_labels = face_probs.argmax(axis=1).astype(np.int64)

    return face_labels, face_probs
