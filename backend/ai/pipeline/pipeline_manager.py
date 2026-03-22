# pipeline_manager.py — Orchestrates the full AI segmentation pipeline.
#
# New flow using real MeshSegNet:
#   1. Run MeshSegNet inference → per-face labels + probabilities
#   2. Convert class indices to FDI numbers
#   3. Compute per-tooth confidence scores

from __future__ import annotations

import logging
import time
from dataclasses import dataclass, field

import numpy as np

from ai.pipeline.segmentation_runner import run_inference
from ai.pipeline.graphcut_refiner import refine_with_graphcut
from ai.pipeline.boundary_smoother import smooth_boundaries
from ai.utils.fdi_numbering import class_to_fdi

logger = logging.getLogger(__name__)

NUM_CLASSES = 15


@dataclass
class SegmentationOutput:
    """Complete output of the AI segmentation pipeline."""

    face_labels: np.ndarray               # (F,) per-face class indices (0=gum, 1-14=teeth)
    face_probs: np.ndarray                # (F, 15) per-face class probabilities
    jaw: str                              # "upper" or "lower"
    teeth_found: list[int]                # FDI numbers detected
    confidence_scores: dict[int, float]   # {fdi: score}
    processing_time_seconds: float
    total_faces: int
    model_version: str = "meshsegnet_v1"
    metadata: dict = field(default_factory=dict)


def run_full_pipeline(
    file_path: str,
    jaw: str | None = None,
    instructions: dict | None = None,
    **kwargs,
) -> SegmentationOutput:
    """Run the complete segmentation pipeline on an STL file.

    Args:
        file_path: Path to the STL mesh file.
        jaw: "upper" or "lower". Auto-detected if None.
        instructions: Unused for now (reserved for future restriction logic).

    Returns:
        SegmentationOutput with per-face labels, probabilities, and metadata.
    """
    start = time.time()

    # Step 1: Run MeshSegNet inference
    logger.info("Running MeshSegNet inference on %s...", file_path)
    face_labels, face_probs, detected_jaw = run_inference(file_path, jaw=jaw)

    # Step 2: Graph-cut boundary refinement (MeshSegNet standard post-processing)
    logger.info("Running graph-cut boundary refinement...")
    face_labels, face_probs = refine_with_graphcut(file_path, face_probs, lambda_c=100.0)

    # Step 3: Morphological boundary smoothing
    logger.info("Running boundary smoothing...")
    face_labels = smooth_boundaries(file_path, face_labels, iterations=4)

    # Step 4: Compute per-tooth confidence scores
    confidence = _compute_confidence(face_labels, face_probs, detected_jaw)

    # Step 5: Get list of detected teeth (FDI numbers)
    teeth_found = sorted([
        class_to_fdi(int(c), jaw=detected_jaw)
        for c in np.unique(face_labels) if c != 0
    ])

    elapsed = time.time() - start
    logger.info(
        "Pipeline complete: %d teeth found in %.2fs",
        len(teeth_found), elapsed,
    )

    return SegmentationOutput(
        face_labels=face_labels,
        face_probs=face_probs,
        jaw=detected_jaw,
        teeth_found=teeth_found,
        confidence_scores=confidence,
        processing_time_seconds=round(elapsed, 2),
        total_faces=len(face_labels),
        metadata={
            "jaw": detected_jaw,
            "num_classes": NUM_CLASSES,
            "total_faces": len(face_labels),
        },
    )


def _smooth_probs_on_mesh(
    stl_path: str,
    face_probs: np.ndarray,
    iterations: int = 15,
    alpha: float = 0.3,
) -> tuple[np.ndarray, np.ndarray]:
    """Smooth probabilities by diffusing them across mesh face adjacency.

    Each iteration, each face's probability vector becomes a blend of
    its own value (weight 1-alpha) and the average of its neighbors (alpha).
    This propagates clean probability signals across the mesh, filling
    noisy holes and consolidating tooth regions.

    Uses scipy sparse matrix multiplication for speed (vectorized).

    Returns updated (face_labels, face_probs).
    """
    import vedo
    from scipy.sparse import lil_matrix

    mesh = vedo.load(stl_path)
    faces_arr = np.asarray(mesh.cells) if hasattr(mesh, 'cells') else np.asarray(mesh.cells())
    n_faces = len(faces_arr)
    n_classes = face_probs.shape[1]

    # Build sparse face adjacency matrix
    edge_to_faces: dict[tuple[int, int], list[int]] = {}
    for fi in range(n_faces):
        face = faces_arr[fi]
        for i in range(3):
            e = (min(int(face[i]), int(face[(i + 1) % 3])),
                 max(int(face[i]), int(face[(i + 1) % 3])))
            edge_to_faces.setdefault(e, []).append(fi)

    A = lil_matrix((n_faces, n_faces), dtype=np.float32)
    for faces_sharing in edge_to_faces.values():
        for i in range(len(faces_sharing)):
            for j in range(i + 1, len(faces_sharing)):
                A[faces_sharing[i], faces_sharing[j]] = 1.0
                A[faces_sharing[j], faces_sharing[i]] = 1.0

    # Normalize rows (each row sums to 1)
    A_csr = A.tocsr()
    row_sums = np.array(A_csr.sum(axis=1)).flatten()
    row_sums[row_sums == 0] = 1.0
    # Divide each row by its sum
    from scipy.sparse import diags
    D_inv = diags(1.0 / row_sums)
    A_norm = D_inv @ A_csr

    # Iterative probability diffusion
    probs = face_probs.copy().astype(np.float64)
    for iteration in range(iterations):
        # Neighbor average
        neighbor_avg = A_norm @ probs  # (N, C) sparse matmul
        # Blend: self * (1-alpha) + neighbor_avg * alpha
        probs = (1 - alpha) * probs + alpha * neighbor_avg
        # Re-normalize probabilities
        row_sums_p = probs.sum(axis=1, keepdims=True)
        row_sums_p[row_sums_p == 0] = 1.0
        probs /= row_sums_p

    labels = probs.argmax(axis=1).astype(np.int64)
    changed = int(np.sum(labels != face_probs.argmax(axis=1)))
    logger.info(
        "Probability diffusion: %d iterations, %d faces changed",
        iterations, changed,
    )
    return labels, probs.astype(np.float32)


def _remove_small_components(
    stl_path: str,
    face_labels: np.ndarray,
    min_fraction: float = 0.05,
) -> np.ndarray:
    """Remove small disconnected patches of each tooth label.

    For each non-gum label, finds connected components (via face adjacency)
    and keeps only the largest one. Small stray patches are relabeled as gum.
    This removes misclassified spots on the palate/gum.
    """
    import vedo

    mesh = vedo.load(stl_path)
    faces = np.asarray(mesh.cells) if hasattr(mesh, 'cells') else np.asarray(mesh.cells())
    n_faces = len(faces)

    # Build face adjacency via shared edges
    edge_to_faces: dict[tuple[int, int], list[int]] = {}
    for fi in range(n_faces):
        face = faces[fi]
        for i in range(3):
            e = (min(int(face[i]), int(face[(i + 1) % 3])),
                 max(int(face[i]), int(face[(i + 1) % 3])))
            edge_to_faces.setdefault(e, []).append(fi)

    face_neighbors: list[list[int]] = [[] for _ in range(n_faces)]
    for faces_sharing in edge_to_faces.values():
        if len(faces_sharing) == 2:
            f0, f1 = faces_sharing
            face_neighbors[f0].append(f1)
            face_neighbors[f1].append(f0)

    cleaned = face_labels.copy()
    total_relabeled = 0

    for class_idx in range(1, int(face_labels.max()) + 1):
        class_faces = np.where(cleaned == class_idx)[0]
        if len(class_faces) == 0:
            continue

        # BFS to find connected components
        class_set = set(class_faces.tolist())
        visited = set()
        components: list[list[int]] = []

        for start in class_faces:
            start = int(start)
            if start in visited:
                continue
            # BFS
            comp = []
            queue = [start]
            visited.add(start)
            while queue:
                node = queue.pop()
                comp.append(node)
                for nb in face_neighbors[node]:
                    if nb not in visited and nb in class_set:
                        visited.add(nb)
                        queue.append(nb)
            components.append(comp)

        if len(components) <= 1:
            continue

        # Keep only the largest component, relabel rest as gum
        components.sort(key=len, reverse=True)
        largest_size = len(components[0])

        for comp in components[1:]:
            # Remove components smaller than min_fraction of the largest
            if len(comp) < largest_size * min_fraction:
                for fi in comp:
                    cleaned[fi] = 0
                total_relabeled += len(comp)

    logger.info(
        "Connected component cleanup: relabeled %d stray faces to gum",
        total_relabeled,
    )
    return cleaned


def _compute_confidence(
    face_labels: np.ndarray,
    face_probs: np.ndarray,
    jaw: str,
) -> dict[int, float]:
    """Compute mean confidence score per detected tooth."""
    confidence: dict[int, float] = {}

    for class_idx in np.unique(face_labels):
        class_idx = int(class_idx)
        if class_idx == 0:
            continue
        fdi = class_to_fdi(class_idx, jaw=jaw)
        mask = face_labels == class_idx
        tooth_probs = face_probs[mask, class_idx]
        confidence[fdi] = round(float(np.mean(tooth_probs)), 4)

    return confidence
