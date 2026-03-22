# boundary_smoother.py — Morphological smoothing for dental mesh segmentation labels.
#
# Runs boundary-only majority voting to smooth jagged gum-tooth and tooth-tooth
# boundaries, followed by small-component cleanup to remove isolated face patches.

from __future__ import annotations

import logging
from collections import Counter

import numpy as np

logger = logging.getLogger(__name__)


def smooth_boundaries(
    stl_path: str,
    face_labels: np.ndarray,
    iterations: int = 4,
) -> np.ndarray:
    """Smooth segmentation boundaries using iterative majority voting.

    Only faces that sit on a label boundary (i.e. have at least one neighbor
    with a different label) are considered for relabeling. Each boundary face
    is assigned the majority label among its neighbors and itself. Interior
    faces are never modified, preserving stable regions.

    After smoothing, a small-component cleanup removes any isolated face
    patches that may have been created.

    Args:
        stl_path: Path to the STL mesh file (used to compute face adjacency).
        face_labels: (F,) array of per-face class indices (0=gum, 1-14=teeth).
        iterations: Number of majority-voting passes (3-5 recommended).

    Returns:
        Smoothed face_labels array of the same shape.
    """
    import vedo

    # --- Load mesh and build face neighbor lists from shared edges ---
    mesh = vedo.load(stl_path)
    faces_arr = np.asarray(mesh.cells) if hasattr(mesh, "cells") else np.asarray(mesh.cells())
    n_faces = len(faces_arr)

    edge_to_faces: dict[tuple[int, int], list[int]] = {}
    for fi in range(n_faces):
        face = faces_arr[fi]
        for i in range(3):
            v0, v1 = int(face[i]), int(face[(i + 1) % 3])
            e = (min(v0, v1), max(v0, v1))
            edge_to_faces.setdefault(e, []).append(fi)

    face_neighbors: list[list[int]] = [[] for _ in range(n_faces)]
    for faces_sharing in edge_to_faces.values():
        if len(faces_sharing) == 2:
            f0, f1 = faces_sharing
            face_neighbors[f0].append(f1)
            face_neighbors[f1].append(f0)

    # --- Iterative boundary-only majority voting ---
    labels = face_labels.copy()

    for it in range(iterations):
        new_labels = labels.copy()
        changed = 0

        for fi in range(n_faces):
            neighbors = face_neighbors[fi]
            if not neighbors:
                continue

            # Check if this face is on a boundary
            current_label = labels[fi]
            is_boundary = any(labels[nb] != current_label for nb in neighbors)
            if not is_boundary:
                continue

            # Majority vote: count labels of neighbors + self
            vote_counts = Counter()
            vote_counts[current_label] += 1
            for nb in neighbors:
                vote_counts[labels[nb]] += 1

            majority_label = vote_counts.most_common(1)[0][0]
            if majority_label != current_label:
                new_labels[fi] = majority_label
                changed += 1

        labels = new_labels
        logger.info(
            "Boundary smoothing iteration %d/%d: %d faces changed",
            it + 1, iterations, changed,
        )

        # Early exit if converged
        if changed == 0:
            logger.info("Boundary smoothing converged at iteration %d", it + 1)
            break

    # --- Small-component cleanup ---
    labels = _cleanup_small_components(face_neighbors, labels, n_faces)

    return labels


def _cleanup_small_components(
    face_neighbors: list[list[int]],
    face_labels: np.ndarray,
    n_faces: int,
    min_size: int = 5,
) -> np.ndarray:
    """Remove small isolated components created by smoothing.

    For each non-gum label, find connected components via BFS. Any component
    with fewer faces than *min_size* is relabeled to the most common neighbor
    label (usually gum).

    Args:
        face_neighbors: Pre-computed neighbor list per face.
        face_labels: Current label array.
        n_faces: Total number of faces.
        min_size: Components smaller than this are cleaned up.

    Returns:
        Cleaned label array.
    """
    cleaned = face_labels.copy()
    total_relabeled = 0

    for class_idx in range(1, int(face_labels.max()) + 1):
        class_faces = np.where(cleaned == class_idx)[0]
        if len(class_faces) == 0:
            continue

        class_set = set(class_faces.tolist())
        visited: set[int] = set()
        components: list[list[int]] = []

        for start_face in class_faces:
            start_face = int(start_face)
            if start_face in visited:
                continue

            # BFS to find connected component
            comp: list[int] = []
            queue = [start_face]
            visited.add(start_face)
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

        # Keep only the largest; relabel tiny fragments
        components.sort(key=len, reverse=True)
        for comp in components[1:]:
            if len(comp) < min_size:
                # Find the most common neighbor label for this fragment
                neighbor_labels = Counter()
                for fi in comp:
                    for nb in face_neighbors[fi]:
                        if cleaned[nb] != class_idx:
                            neighbor_labels[cleaned[nb]] += 1

                # Default to gum (0) if no external neighbors
                replacement = neighbor_labels.most_common(1)[0][0] if neighbor_labels else 0
                for fi in comp:
                    cleaned[fi] = replacement
                total_relabeled += len(comp)

    if total_relabeled > 0:
        logger.info(
            "Post-smoothing cleanup: relabeled %d isolated faces",
            total_relabeled,
        )

    return cleaned
