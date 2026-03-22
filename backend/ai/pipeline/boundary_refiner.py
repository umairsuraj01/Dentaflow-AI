# boundary_refiner.py — Curvature-based boundary refinement for dental segmentation.
#
# Professional dental software achieves clean tooth boundaries by aligning
# segmentation cuts to the natural geometric features of the mesh:
#   - Tooth-tooth boundaries follow high-curvature concave grooves
#   - Tooth-gum boundaries follow the cervical line (gingival margin)
#   - Smooth tooth surfaces should have consistent labels
#
# This module implements three refinement stages:
#   1. Curvature-aware probability diffusion (adaptive alpha)
#   2. Graph-cut boundary snapping to concave ridges
#   3. Morphological cleanup (erosion/dilation on label boundaries)

from __future__ import annotations

import logging
from collections import deque

import numpy as np
from scipy.sparse import lil_matrix, diags, csr_matrix

logger = logging.getLogger(__name__)


# ---------------------------------------------------------------------------
# Mesh helpers — build once, reuse across stages
# ---------------------------------------------------------------------------

class MeshTopology:
    """Precomputed mesh topology for fast access across refinement stages."""

    def __init__(self, stl_path: str):
        import trimesh

        self.mesh = trimesh.load(stl_path)
        self.vertices = np.asarray(self.mesh.vertices)
        self.faces = np.asarray(self.mesh.faces)
        self.n_faces = len(self.faces)
        self.n_verts = len(self.vertices)

        # Face normals
        self.face_normals = np.asarray(self.mesh.face_normals)

        # Face centroids (barycenter of each triangle)
        self.face_centroids = self.vertices[self.faces].mean(axis=1)

        # Build face adjacency via shared edges
        self._build_adjacency()

        # Compute per-face curvature
        self._compute_face_curvature()

        # Compute per-face concavity (sign of curvature at shared edges)
        self._compute_concavity()

    def _build_adjacency(self):
        """Build face adjacency and edge-to-face mapping."""
        self.edge_to_faces: dict[tuple[int, int], list[int]] = {}
        for fi in range(self.n_faces):
            face = self.faces[fi]
            for i in range(3):
                v0, v1 = int(face[i]), int(face[(i + 1) % 3])
                e = (min(v0, v1), max(v0, v1))
                self.edge_to_faces.setdefault(e, []).append(fi)

        # Face neighbor list
        self.face_neighbors: list[list[int]] = [[] for _ in range(self.n_faces)]
        # Face neighbor set (for fast lookup)
        self.face_neighbor_set: list[set[int]] = [set() for _ in range(self.n_faces)]
        for faces_sharing in self.edge_to_faces.values():
            if len(faces_sharing) == 2:
                f0, f1 = faces_sharing
                self.face_neighbors[f0].append(f1)
                self.face_neighbors[f1].append(f0)
                self.face_neighbor_set[f0].add(f1)
                self.face_neighbor_set[f1].add(f0)

        # Sparse adjacency matrix (normalized)
        A = lil_matrix((self.n_faces, self.n_faces), dtype=np.float32)
        for faces_sharing in self.edge_to_faces.values():
            for i in range(len(faces_sharing)):
                for j in range(i + 1, len(faces_sharing)):
                    A[faces_sharing[i], faces_sharing[j]] = 1.0
                    A[faces_sharing[j], faces_sharing[i]] = 1.0
        A_csr = A.tocsr()
        row_sums = np.array(A_csr.sum(axis=1)).flatten()
        row_sums[row_sums == 0] = 1.0
        D_inv = diags(1.0 / row_sums)
        self.A_norm = D_inv @ A_csr

    def _compute_face_curvature(self):
        """Compute per-face curvature using vertex curvature averaging.

        Uses the dihedral angle method: for each edge shared by two faces,
        the angle between their normals indicates local curvature. Each face's
        curvature is the average of its edge dihedral angles.
        """
        face_curv = np.zeros(self.n_faces, dtype=np.float64)
        face_curv_count = np.zeros(self.n_faces, dtype=np.int32)

        for edge, face_list in self.edge_to_faces.items():
            if len(face_list) != 2:
                continue
            f0, f1 = face_list
            n0 = self.face_normals[f0]
            n1 = self.face_normals[f1]

            # Dihedral angle between faces (0 = coplanar, pi = folded)
            cos_angle = np.clip(np.dot(n0, n1), -1.0, 1.0)
            dihedral = np.arccos(cos_angle)  # 0..pi

            face_curv[f0] += dihedral
            face_curv[f1] += dihedral
            face_curv_count[f0] += 1
            face_curv_count[f1] += 1

        face_curv_count[face_curv_count == 0] = 1
        self.face_curvature = (face_curv / face_curv_count).astype(np.float32)

        # Normalize to [0, 1] using percentiles (robust to outliers)
        p5, p95 = np.percentile(self.face_curvature, [5, 95])
        denom = p95 - p5 if p95 > p5 else 1.0
        self.face_curvature_norm = np.clip(
            (self.face_curvature - p5) / denom, 0.0, 1.0,
        ).astype(np.float32)

        logger.info(
            "Face curvature: min=%.4f, median=%.4f, max=%.4f (normalized)",
            self.face_curvature_norm.min(),
            np.median(self.face_curvature_norm),
            self.face_curvature_norm.max(),
        )

    def _compute_concavity(self):
        """Compute per-edge concavity: positive = concave groove (tooth boundary).

        A concave edge means the mesh folds inward — this is where teeth meet.
        A convex edge means the mesh curves outward — this is a smooth tooth surface.
        """
        self.edge_concavity: dict[tuple[int, int], float] = {}
        face_concavity = np.zeros(self.n_faces, dtype=np.float64)
        face_conc_count = np.zeros(self.n_faces, dtype=np.int32)

        for edge, face_list in self.edge_to_faces.items():
            if len(face_list) != 2:
                continue
            f0, f1 = face_list

            # Edge midpoint and vector from f0 centroid to f1 centroid
            c0 = self.face_centroids[f0]
            c1 = self.face_centroids[f1]
            mid_vec = c1 - c0

            # Average normal of the two faces
            avg_normal = (self.face_normals[f0] + self.face_normals[f1]) * 0.5
            norm = np.linalg.norm(avg_normal)
            if norm < 1e-10:
                continue
            avg_normal /= norm

            # Concavity: dot product of edge direction with average normal
            # Positive = concave (groove), Negative = convex (ridge)
            concavity = np.dot(mid_vec, avg_normal)

            # Also include dihedral angle magnitude
            n0, n1 = self.face_normals[f0], self.face_normals[f1]
            cos_angle = np.clip(np.dot(n0, n1), -1.0, 1.0)
            dihedral = np.arccos(cos_angle)

            # Combined concavity score: sign from geometry, magnitude from dihedral
            signed_concavity = np.sign(concavity) * dihedral

            self.edge_concavity[edge] = float(signed_concavity)
            face_concavity[f0] += signed_concavity
            face_concavity[f1] += signed_concavity
            face_conc_count[f0] += 1
            face_conc_count[f1] += 1

        face_conc_count[face_conc_count == 0] = 1
        self.face_concavity = (face_concavity / face_conc_count).astype(np.float32)

    def get_boundary_faces(self, labels: np.ndarray) -> np.ndarray:
        """Get face indices that are at a label boundary (neighbor has different label)."""
        boundary = []
        for fi in range(self.n_faces):
            my_label = labels[fi]
            for nb in self.face_neighbors[fi]:
                if labels[nb] != my_label:
                    boundary.append(fi)
                    break
        return np.array(boundary, dtype=np.int64)


# ---------------------------------------------------------------------------
# Stage 1: Curvature-Aware Probability Diffusion
# ---------------------------------------------------------------------------

def curvature_aware_diffusion(
    topo: MeshTopology,
    face_probs: np.ndarray,
    iterations: int = 30,
    alpha_smooth: float = 0.6,
    alpha_boundary: float = 0.05,
) -> tuple[np.ndarray, np.ndarray]:
    """Diffuse probabilities with curvature-adaptive blending.

    On smooth surfaces (low curvature): strong diffusion smooths noise.
    On high-curvature concave edges (tooth boundaries): minimal diffusion
    preserves the natural boundary.

    Args:
        topo: Precomputed mesh topology.
        face_probs: (F, C) probability matrix.
        iterations: Number of diffusion iterations.
        alpha_smooth: Diffusion strength on smooth surfaces.
        alpha_boundary: Diffusion strength at high-curvature boundaries.

    Returns:
        (labels, probs): Refined labels and probability matrix.
    """
    n_faces = topo.n_faces
    curv = topo.face_curvature_norm  # [0, 1] normalized

    # Adaptive alpha: lerp between alpha_smooth (low curv) and alpha_boundary (high curv)
    # Faces with high curvature get very low alpha (preserve boundaries)
    alpha_per_face = alpha_smooth - (alpha_smooth - alpha_boundary) * curv
    alpha_col = alpha_per_face[:, np.newaxis]  # (F, 1) for broadcasting

    probs = face_probs.copy().astype(np.float64)
    A_norm = topo.A_norm

    for it in range(iterations):
        neighbor_avg = A_norm @ probs  # (F, C)
        probs = (1.0 - alpha_col) * probs + alpha_col * neighbor_avg
        # Re-normalize
        row_sums = probs.sum(axis=1, keepdims=True)
        row_sums[row_sums == 0] = 1.0
        probs /= row_sums

    labels = probs.argmax(axis=1).astype(np.int64)
    changed = int(np.sum(labels != face_probs.argmax(axis=1)))
    logger.info(
        "Curvature-aware diffusion: %d iters, %d faces changed, "
        "alpha range [%.3f, %.3f]",
        iterations, changed, alpha_per_face.min(), alpha_per_face.max(),
    )
    return labels, probs.astype(np.float32)


# ---------------------------------------------------------------------------
# Stage 2: Graph-Cut Boundary Snapping
# ---------------------------------------------------------------------------

def snap_boundaries_to_grooves(
    topo: MeshTopology,
    labels: np.ndarray,
    probs: np.ndarray,
    concavity_weight: float = 2.0,
    max_iterations: int = 5,
) -> np.ndarray:
    """Snap label boundaries to concave grooves between teeth.

    For each boundary face, evaluate whether moving it to a neighbor's label
    would place the boundary on a more concave (groove-like) edge.

    Uses an energy minimization approach:
      E(face) = -log(P(label)) + concavity_weight * boundary_cost

    Where boundary_cost penalizes placing boundaries on convex (smooth) edges
    and rewards placing them on concave (groove) edges.

    Args:
        topo: Precomputed mesh topology.
        labels: (F,) current face labels.
        probs: (F, C) probability matrix.
        concavity_weight: How strongly concavity influences boundary placement.
        max_iterations: Maximum refinement passes.

    Returns:
        Refined face labels.
    """
    refined = labels.copy()
    total_flipped = 0

    for iteration in range(max_iterations):
        flipped = 0
        boundary_faces = topo.get_boundary_faces(refined)

        for fi in boundary_faces:
            fi = int(fi)
            current_label = refined[fi]
            if current_label == 0:
                continue  # don't move gum faces

            neighbors = topo.face_neighbors[fi]
            if not neighbors:
                continue

            # Current energy: data term (how confident is current label?)
            prob_current = max(probs[fi, current_label], 1e-10)
            data_cost_current = -np.log(prob_current)

            # Current boundary cost: sum of concavity at edges where label changes
            boundary_cost_current = _boundary_cost_for_face(
                topo, refined, fi, current_label,
            )
            energy_current = data_cost_current + concavity_weight * boundary_cost_current

            # Try each neighbor's label
            best_label = current_label
            best_energy = energy_current

            neighbor_labels = set(int(refined[nb]) for nb in neighbors) - {current_label}
            for candidate_label in neighbor_labels:
                if candidate_label == 0:
                    continue  # don't convert teeth to gum

                prob_cand = max(probs[fi, candidate_label], 1e-10)
                data_cost_cand = -np.log(prob_cand)
                boundary_cost_cand = _boundary_cost_for_face(
                    topo, refined, fi, candidate_label,
                )
                energy_cand = data_cost_cand + concavity_weight * boundary_cost_cand

                if energy_cand < best_energy:
                    best_energy = energy_cand
                    best_label = candidate_label

            if best_label != current_label:
                refined[fi] = best_label
                flipped += 1

        total_flipped += flipped
        logger.info(
            "Boundary snapping iter %d: %d faces flipped", iteration + 1, flipped,
        )
        if flipped == 0:
            break

    logger.info("Boundary snapping complete: %d total faces refined", total_flipped)
    return refined


def _boundary_cost_for_face(
    topo: MeshTopology,
    labels: np.ndarray,
    fi: int,
    hypothetical_label: int,
) -> float:
    """Compute boundary cost if face fi had the given label.

    Boundary cost is LOW when label transitions happen at concave edges (grooves).
    Boundary cost is HIGH when label transitions happen at convex edges (smooth surface).

    This rewards snapping boundaries to natural tooth grooves.
    """
    cost = 0.0
    face = topo.faces[fi]

    for nb in topo.face_neighbors[fi]:
        nb_label = int(labels[nb])
        is_boundary = (nb_label != hypothetical_label)

        if not is_boundary:
            continue

        # Find the shared edge between fi and nb
        nb_face = topo.faces[nb]
        shared_verts = set(face.tolist()) & set(nb_face.tolist())
        if len(shared_verts) < 2:
            continue

        edge = tuple(sorted(shared_verts))[:2]
        edge_key = (min(edge), max(edge))

        concavity = topo.edge_concavity.get(edge_key, 0.0)

        # Concave edge (positive concavity) → low cost (good boundary)
        # Convex edge (negative concavity) → high cost (bad boundary)
        # We want boundaries at concave edges, so cost = -concavity
        cost += -concavity

    return cost


# ---------------------------------------------------------------------------
# Stage 3: Morphological Label Cleanup
# ---------------------------------------------------------------------------

def morphological_cleanup(
    topo: MeshTopology,
    labels: np.ndarray,
    probs: np.ndarray,
    erosion_iterations: int = 2,
    dilation_iterations: int = 2,
) -> np.ndarray:
    """Morphological erosion then dilation to clean boundary noise.

    Erosion: boundary faces of each tooth label are set to gum (shrink teeth).
    Dilation: gum faces adjacent to a tooth label adopt that label (grow teeth back).

    The effect is like opening in image morphology — removes thin protrusions
    and fills small holes at boundaries, producing cleaner edges.

    Only operates on low-confidence boundary faces to avoid eroding
    correctly-classified regions.
    """
    cleaned = labels.copy()

    # Erosion: remove low-confidence boundary faces
    for _ in range(erosion_iterations):
        boundary = topo.get_boundary_faces(cleaned)
        for fi in boundary:
            fi = int(fi)
            if cleaned[fi] == 0:
                continue
            # Only erode if confidence is below threshold
            label = cleaned[fi]
            if probs[fi, label] < 0.7:
                cleaned[fi] = 0

    # Dilation: grow tooth labels back into eroded gum regions
    for _ in range(dilation_iterations):
        # Find gum faces adjacent to teeth
        gum_faces = np.where(cleaned == 0)[0]
        changes: list[tuple[int, int]] = []

        for fi in gum_faces:
            fi = int(fi)
            neighbors = topo.face_neighbors[fi]
            # Count neighbor labels (excluding gum)
            neighbor_labels: dict[int, float] = {}
            for nb in neighbors:
                nb_label = int(cleaned[nb])
                if nb_label != 0:
                    # Weight by probability
                    neighbor_labels[nb_label] = (
                        neighbor_labels.get(nb_label, 0.0) + probs[fi, nb_label]
                    )

            if not neighbor_labels:
                continue

            # Assign the label with highest weighted support
            best_label = max(neighbor_labels, key=neighbor_labels.get)
            if probs[fi, best_label] > 0.3:
                changes.append((fi, best_label))

        for fi, label in changes:
            cleaned[fi] = label

    eroded_then_dilated = int(np.sum(cleaned != labels))
    logger.info(
        "Morphological cleanup: %d faces changed "
        "(%d erosion + %d dilation iters)",
        eroded_then_dilated, erosion_iterations, dilation_iterations,
    )
    return cleaned


# ---------------------------------------------------------------------------
# Stage 4: Final Boundary Smoothing
# ---------------------------------------------------------------------------

def smooth_label_boundaries(
    topo: MeshTopology,
    labels: np.ndarray,
    probs: np.ndarray,
    passes: int = 3,
) -> np.ndarray:
    """Smooth label boundaries using local majority voting on neighbors.

    For each boundary face, if a supermajority of neighbors (>= 2/3) have
    a different label AND that label's probability is reasonable, switch.
    This removes isolated single-face spikes along boundaries.
    """
    smoothed = labels.copy()
    total_changed = 0

    for pass_num in range(passes):
        changed = 0
        boundary = topo.get_boundary_faces(smoothed)

        for fi in boundary:
            fi = int(fi)
            current = smoothed[fi]
            neighbors = topo.face_neighbors[fi]
            if len(neighbors) < 2:
                continue

            # Count neighbor labels
            label_counts: dict[int, int] = {}
            for nb in neighbors:
                nb_label = int(smoothed[nb])
                label_counts[nb_label] = label_counts.get(nb_label, 0) + 1

            # Find majority label
            majority_label = max(label_counts, key=label_counts.get)
            majority_count = label_counts[majority_label]

            if majority_label == current:
                continue

            # Switch if supermajority AND reasonable probability
            threshold = len(neighbors) * 2 / 3
            if majority_count >= threshold and probs[fi, majority_label] > 0.15:
                smoothed[fi] = majority_label
                changed += 1

        total_changed += changed
        if changed == 0:
            break

    logger.info(
        "Boundary smoothing: %d faces changed over %d passes",
        total_changed, passes,
    )
    return smoothed


# ---------------------------------------------------------------------------
# Main Entry Point
# ---------------------------------------------------------------------------

def refine_segmentation(
    stl_path: str,
    face_probs: np.ndarray,
) -> tuple[np.ndarray, np.ndarray]:
    """Full boundary refinement pipeline.

    Stages:
        1. Build mesh topology (adjacency, curvature, concavity)
        2. Curvature-aware probability diffusion
        3. Connected component cleanup (remove small patches)
        4. Graph-cut boundary snapping to concave grooves
        5. Morphological cleanup (erosion + dilation)
        6. Final boundary smoothing (local majority voting)

    Args:
        stl_path: Path to the STL mesh file.
        face_probs: (F, C) probability matrix from model.

    Returns:
        (face_labels, face_probs): Refined labels and probabilities.
    """
    logger.info("=== Starting curvature-based boundary refinement ===")

    # Build topology once (reused by all stages)
    logger.info("Building mesh topology...")
    topo = MeshTopology(stl_path)
    logger.info(
        "Mesh: %d faces, %d vertices, %d edges",
        topo.n_faces, topo.n_verts, len(topo.edge_to_faces),
    )

    # Stage 1: Curvature-aware probability diffusion
    labels, probs = curvature_aware_diffusion(
        topo, face_probs,
        iterations=30, alpha_smooth=0.6, alpha_boundary=0.05,
    )

    # Stage 2: Connected component cleanup
    labels = _remove_small_components_fast(topo, labels, min_fraction=0.05)

    # Stage 3: Graph-cut boundary snapping
    labels = snap_boundaries_to_grooves(
        topo, labels, probs,
        concavity_weight=2.0, max_iterations=5,
    )

    # Stage 4: Morphological cleanup
    labels = morphological_cleanup(
        topo, labels, probs,
        erosion_iterations=2, dilation_iterations=2,
    )

    # Stage 5: Final boundary smoothing
    labels = smooth_label_boundaries(topo, labels, probs, passes=3)

    # Stage 6: Final connected component cleanup
    labels = _remove_small_components_fast(topo, labels, min_fraction=0.03)

    total_changed = int(np.sum(labels != face_probs.argmax(axis=1)))
    logger.info(
        "=== Boundary refinement complete: %d total faces refined ===",
        total_changed,
    )

    return labels, probs


def _remove_small_components_fast(
    topo: MeshTopology,
    labels: np.ndarray,
    min_fraction: float = 0.05,
) -> np.ndarray:
    """Remove small disconnected components using precomputed topology."""
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
                for nb in topo.face_neighbors[node]:
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
