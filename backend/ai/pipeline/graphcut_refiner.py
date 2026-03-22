# graphcut_refiner.py — Graph-cut post-processing for dental mesh segmentation.
#
# This is the STANDARD post-processing used by the original MeshSegNet authors.
# Uses pygco (Python wrapper for graph-cut optimization) to enforce spatially
# consistent labels by penalizing label changes on smooth surfaces and
# encouraging them at high-curvature concave grooves (tooth boundaries).
#
# Pipeline:
#   1. Build unary costs from model probabilities
#   2. Build pairwise costs from face adjacency + normal angles
#   3. Run multi-label graph-cut optimization (alpha-expansion)
#   4. Connected component cleanup

from __future__ import annotations

import logging
from collections import deque

import numpy as np

logger = logging.getLogger(__name__)


def refine_with_graphcut(
    stl_path: str,
    face_probs: np.ndarray,
    lambda_c: float = 30.0,
    beta: float = 1.0,
) -> tuple[np.ndarray, np.ndarray]:
    """Refine segmentation labels using multi-label graph-cut optimization.

    This replicates the post-processing from the original MeshSegNet paper.
    Graph-cut enforces spatial consistency: adjacent faces with similar
    normals should have the same label. Label changes are encouraged at
    high-curvature edges (where normals differ sharply).

    Args:
        stl_path: Path to the STL mesh file.
        face_probs: (F, C) probability matrix from model inference.
        lambda_c: Smoothness weight — higher = smoother boundaries (fewer label changes).
                   MeshSegNet default is 30.
        beta: Normal angle sensitivity — controls how much normal differences
              reduce the smoothness penalty.

    Returns:
        (face_labels, face_probs): Refined labels and original probability matrix.
    """
    import pygco
    import vedo

    logger.info("=== Starting graph-cut boundary refinement ===")

    # Load mesh
    mesh = vedo.load(stl_path)
    faces_arr = np.asarray(mesh.cells)
    n_faces = len(faces_arr)
    n_classes = face_probs.shape[1]

    # Compute face normals
    mesh.compute_normals()
    normals = np.asarray(mesh.celldata["Normals"]).copy()

    # Normalize normals
    norms = np.linalg.norm(normals, axis=1, keepdims=True)
    norms[norms < 1e-10] = 1.0
    normals = normals / norms

    # --- 1. Build unary costs (data term) ---
    # Unary cost = -log(probability) — low cost for high-probability labels
    eps = 1e-10
    unary = -np.log(np.clip(face_probs, eps, 1.0))
    # Scale to integer costs for pygco (multiply by 100 for precision)
    unary_int = (unary * 100).astype(np.int32)

    logger.info("Unary costs: shape=%s, range=[%d, %d]",
                unary_int.shape, unary_int.min(), unary_int.max())

    # --- 2. Build face adjacency (edges) ---
    edge_to_faces: dict[tuple[int, int], list[int]] = {}
    for fi in range(n_faces):
        face = faces_arr[fi]
        for i in range(3):
            v0, v1 = int(face[i]), int(face[(i + 1) % 3])
            e = (min(v0, v1), max(v0, v1))
            edge_to_faces.setdefault(e, []).append(fi)

    # Build edge list and pairwise costs
    edges_list = []
    edge_weights = []

    for face_list in edge_to_faces.values():
        if len(face_list) != 2:
            continue
        f0, f1 = face_list

        # Normal angle between adjacent faces
        cos_angle = np.clip(np.dot(normals[f0], normals[f1]), -1.0, 1.0)
        angle = np.arccos(cos_angle)  # 0..pi

        # Edge weight: high when normals are similar (smooth surface → penalize label change)
        #              low when normals differ (sharp edge → allow label change)
        # w = lambda_c * exp(-beta * angle^2)
        weight = lambda_c * np.exp(-beta * angle * angle)

        edges_list.append([f0, f1])
        edge_weights.append(max(1, int(weight)))

    weights_arr = np.array(edge_weights, dtype=np.int32)

    # Build edges with weights as 3rd column (pygco format: n_edges x 3)
    edges_with_weights = np.column_stack([
        np.array(edges_list, dtype=np.int32),
        weights_arr,
    ])

    logger.info(
        "Graph: %d nodes, %d edges, weight range=[%d, %d]",
        n_faces, len(edges_with_weights), weights_arr.min(), weights_arr.max(),
    )

    # --- 3. Build pairwise (label compatibility) matrix ---
    # Potts model: 0 cost for same label, 1 for different
    pairwise = (1 - np.eye(n_classes, dtype=np.int32))

    # --- 4. Run graph-cut optimization ---
    logger.info("Running alpha-expansion graph-cut (lambda=%.1f, beta=%.1f)...", lambda_c, beta)

    try:
        labels = pygco.cut_from_graph(
            edges_with_weights,
            unary_int,
            pairwise,
            n_iter=5,
            algorithm='expansion',
        )
        labels = labels.astype(np.int64)
    except Exception as exc:
        logger.warning("pygco failed (%s), falling back to argmax", exc)
        labels = face_probs.argmax(axis=1).astype(np.int64)

    # --- 5. Connected component cleanup ---
    labels = _remove_small_components(faces_arr, labels, n_faces, edge_to_faces, min_fraction=0.03)

    changed = int(np.sum(labels != face_probs.argmax(axis=1)))
    unique_labels = np.unique(labels)
    logger.info(
        "=== Graph-cut complete: %d faces changed, %d unique labels ===",
        changed, len(unique_labels),
    )

    return labels, face_probs


def _remove_small_components(
    faces_arr: np.ndarray,
    labels: np.ndarray,
    n_faces: int,
    edge_to_faces: dict,
    min_fraction: float = 0.03,
) -> np.ndarray:
    """Remove small disconnected components per label."""
    face_neighbors: list[list[int]] = [[] for _ in range(n_faces)]
    for face_list in edge_to_faces.values():
        if len(face_list) == 2:
            f0, f1 = face_list
            face_neighbors[f0].append(f1)
            face_neighbors[f1].append(f0)

    cleaned = labels.copy()
    total_relabeled = 0

    for class_idx in range(1, int(labels.max()) + 1):
        class_faces = np.where(cleaned == class_idx)[0]
        if len(class_faces) == 0:
            continue

        class_set = set(class_faces.tolist())
        visited: set[int] = set()
        components: list[list[int]] = []

        for start in class_faces:
            start = int(start)
            if start in visited:
                continue
            comp: list[int] = []
            queue = deque([start])
            visited.add(start)
            while queue:
                node = queue.popleft()
                comp.append(node)
                for nb in face_neighbors[node]:
                    if nb not in visited and nb in class_set:
                        visited.add(nb)
                        queue.append(nb)
            components.append(comp)

        if len(components) <= 1:
            continue

        components.sort(key=len, reverse=True)
        largest_size = len(components[0])

        for comp in components[1:]:
            if len(comp) < largest_size * min_fraction:
                for fi in comp:
                    cleaned[fi] = 0
                total_relabeled += len(comp)

    if total_relabeled > 0:
        logger.info("Component cleanup: relabeled %d stray faces", total_relabeled)
    return cleaned
