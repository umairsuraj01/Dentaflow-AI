# crown_completer.py — Crown completion, gap handling, and individual tooth extraction.
#
# OnyxCeph Phase 4B: Crown Completion & Gap Handling
#   - Gap detection between adjacent teeth
#   - Gap correction with configurable offset (default 0.3mm)
#   - Synthetic root generation (parametric cone below crown)
#   - Individual tooth STL export as separate objects
#   - Crown boundary smoothing

from __future__ import annotations

import io
import logging
import time
from dataclasses import dataclass, field

import numpy as np
import trimesh

from ai.utils.fdi_numbering import class_to_fdi, get_quadrant
from ai.pipeline.center_point_detector import ToothCenterPoint

logger = logging.getLogger(__name__)


# ---------------------------------------------------------------------------
# Data structures
# ---------------------------------------------------------------------------

@dataclass
class GapInfo:
    """Gap between two adjacent teeth."""

    tooth_a: int  # FDI of first tooth
    tooth_b: int  # FDI of second tooth
    gap_distance_mm: float  # distance between closest points
    midpoint: list[float]  # [x, y, z] midpoint of the gap
    direction: list[float]  # [x, y, z] unit vector from a→b
    needs_correction: bool  # True if gap > threshold


@dataclass
class ToothObject:
    """Individual extracted tooth with optional synthetic root."""

    fdi: int
    crown_mesh: trimesh.Trimesh
    root_mesh: trimesh.Trimesh | None  # None if no root generated
    combined_mesh: trimesh.Trimesh  # crown + root (or just crown)
    centroid: list[float]
    bbox_min: list[float]
    bbox_max: list[float]
    crown_base_plane: list[float] | None  # [nx, ny, nz, d] plane equation
    stl_bytes: bytes


@dataclass
class CrownCompletionResult:
    """Output of the full crown completion pipeline."""

    tooth_objects: dict[int, ToothObject]  # FDI → tooth
    gum_mesh_bytes: bytes | None
    gaps: list[GapInfo]
    gaps_corrected: int
    roots_generated: int
    processing_time_seconds: float
    jaw: str


# ---------------------------------------------------------------------------
# Main pipeline
# ---------------------------------------------------------------------------

def complete_crowns(
    stl_path: str,
    face_labels: np.ndarray,
    jaw: str = "upper",
    center_points: dict[int, ToothCenterPoint] | None = None,
    *,
    gap_threshold_mm: float = 0.3,
    gap_correction_mm: float = 0.3,
    generate_roots: bool = True,
    root_length_mm: float = 12.0,
    root_taper: float = 0.6,
    smooth_crowns: bool = True,
    smooth_iterations: int = 8,
) -> CrownCompletionResult:
    """Run crown completion pipeline.

    Args:
        stl_path: Path to the STL mesh file.
        face_labels: (F,) per-face class indices (0=gum, 1-14=teeth).
        jaw: "upper" or "lower".
        center_points: Pre-computed center points (optional, computed if None).
        gap_threshold_mm: Gaps larger than this trigger correction.
        gap_correction_mm: Amount to move teeth inward to close gaps.
        generate_roots: Whether to generate synthetic roots.
        root_length_mm: Length of generated roots.
        root_taper: Taper ratio for root cone (0=cylinder, 1=point).
        smooth_crowns: Apply boundary smoothing to extracted crowns.
        smooth_iterations: Taubin smoothing iterations for crown boundaries.

    Returns:
        CrownCompletionResult with individual tooth objects and gap info.
    """
    start = time.time()

    mesh = trimesh.load(stl_path, force="mesh")

    if len(face_labels) != len(mesh.faces):
        raise ValueError(
            f"face_labels length ({len(face_labels)}) != "
            f"mesh face count ({len(mesh.faces)})"
        )

    # Step 1: Extract individual tooth meshes
    tooth_objects: dict[int, ToothObject] = {}
    unique_labels = np.unique(face_labels)

    for class_idx in unique_labels:
        class_idx = int(class_idx)
        if class_idx == 0:
            continue

        fdi = class_to_fdi(class_idx, jaw=jaw)
        face_mask = face_labels == class_idx
        face_indices = np.where(face_mask)[0]

        if len(face_indices) < 3:
            continue

        crown = _extract_crown(mesh, face_indices, smooth_crowns, smooth_iterations)
        if crown is None:
            continue

        # Crown base plane (for root attachment)
        base_plane = _estimate_crown_base_plane(crown, jaw)

        # Generate synthetic root
        root = None
        if generate_roots:
            root = _generate_root(crown, base_plane, jaw, root_length_mm, root_taper)

        # Combined mesh
        if root is not None:
            combined = trimesh.util.concatenate([crown, root])
        else:
            combined = crown

        stl_bytes = _export_stl(combined)

        tooth_objects[fdi] = ToothObject(
            fdi=fdi,
            crown_mesh=crown,
            root_mesh=root,
            combined_mesh=combined,
            centroid=combined.centroid.tolist(),
            bbox_min=combined.bounds[0].tolist(),
            bbox_max=combined.bounds[1].tolist(),
            crown_base_plane=base_plane,
            stl_bytes=stl_bytes,
        )

    # Step 2: Extract gum mesh
    gum_bytes = _extract_gum(mesh, face_labels)

    # Step 3: Detect gaps
    gaps = _detect_gaps(tooth_objects, jaw, gap_threshold_mm)

    # Step 4: Correct gaps (shift teeth slightly toward each other)
    gaps_corrected = 0
    if gap_correction_mm > 0:
        gaps_corrected = _correct_gaps(tooth_objects, gaps, gap_correction_mm)

    # Step 5: Count roots
    roots_generated = sum(1 for t in tooth_objects.values() if t.root_mesh is not None)

    elapsed = time.time() - start

    logger.info(
        "Crown completion: %d teeth, %d gaps (%d corrected), %d roots in %.2fs",
        len(tooth_objects), len(gaps), gaps_corrected, roots_generated, elapsed,
    )

    return CrownCompletionResult(
        tooth_objects=tooth_objects,
        gum_mesh_bytes=gum_bytes,
        gaps=gaps,
        gaps_corrected=gaps_corrected,
        roots_generated=roots_generated,
        processing_time_seconds=round(elapsed, 3),
        jaw=jaw,
    )


# ---------------------------------------------------------------------------
# Crown extraction
# ---------------------------------------------------------------------------

def _extract_crown(
    mesh: trimesh.Trimesh,
    face_indices: np.ndarray,
    smooth: bool = True,
    iterations: int = 8,
) -> trimesh.Trimesh | None:
    """Extract a crown submesh from face indices with boundary smoothing."""
    try:
        submesh = mesh.submesh([face_indices], append=True)
        if len(submesh.faces) < 3:
            return None

        if smooth:
            submesh = _smooth_crown_boundary(submesh, iterations)

        return submesh
    except Exception as exc:
        logger.debug("Crown extraction failed: %s", exc)
        return None


def _smooth_crown_boundary(
    mesh: trimesh.Trimesh,
    iterations: int = 8,
) -> trimesh.Trimesh:
    """Taubin smoothing on boundary vertices to reduce jagged edges."""
    edges = mesh.edges_unique
    if len(edges) == 0:
        return mesh

    # Find boundary edges
    edge_face_count = np.zeros(len(edges), dtype=int)
    try:
        face_edges = mesh.faces_unique_edges
        for fe in face_edges:
            edge_face_count[fe] += 1
    except Exception:
        return mesh

    boundary_mask = edge_face_count == 1
    boundary_edges = edges[boundary_mask]
    if len(boundary_edges) == 0:
        return mesh

    boundary_verts = set(boundary_edges.ravel().tolist())

    # Expand to 2-ring neighbors
    adj: dict[int, list[int]] = {}
    for e in edges:
        adj.setdefault(int(e[0]), []).append(int(e[1]))
        adj.setdefault(int(e[1]), []).append(int(e[0]))

    smooth_set = set(boundary_verts)
    for _ in range(2):
        frontier = set()
        for v in smooth_set:
            for nb in adj.get(v, []):
                frontier.add(nb)
        smooth_set |= frontier

    smooth_verts = np.array(sorted(smooth_set), dtype=int)
    verts = mesh.vertices.copy()

    lam = 0.4
    mu = -0.45

    for it in range(iterations):
        factor = lam if (it % 2 == 0) else mu
        new_verts = verts.copy()
        for vi in smooth_verts:
            neighbors = adj.get(vi, [])
            if not neighbors:
                continue
            avg = verts[neighbors].mean(axis=0)
            new_verts[vi] = verts[vi] + factor * (avg - verts[vi])
        verts = new_verts

    return trimesh.Trimesh(vertices=verts, faces=mesh.faces, process=False)


# ---------------------------------------------------------------------------
# Crown base plane estimation
# ---------------------------------------------------------------------------

def _estimate_crown_base_plane(
    crown: trimesh.Trimesh,
    jaw: str,
) -> list[float] | None:
    """Estimate the crown base plane (gingival margin).

    The base plane is the plane separating the visible crown from where
    the root would begin. For upper jaw teeth, this is the highest Y boundary;
    for lower jaw, the lowest Y boundary.

    Returns [nx, ny, nz, d] plane equation, or None if estimation fails.
    """
    try:
        # Find boundary vertices
        edges = crown.edges_unique
        edge_face_count = np.zeros(len(edges), dtype=int)
        face_edges = crown.faces_unique_edges
        for fe in face_edges:
            edge_face_count[fe] += 1

        boundary_edges = edges[edge_face_count == 1]
        if len(boundary_edges) == 0:
            return None

        boundary_verts = np.unique(boundary_edges.ravel())
        boundary_points = crown.vertices[boundary_verts]

        # Fit plane via SVD
        centroid = boundary_points.mean(axis=0)
        centered = boundary_points - centroid
        _, _, vh = np.linalg.svd(centered)
        normal = vh[2]  # smallest singular value → plane normal

        # Orient normal: for upper jaw, normal should point up (+Y)
        if jaw == "upper" and normal[1] < 0:
            normal = -normal
        elif jaw == "lower" and normal[1] > 0:
            normal = -normal

        d = -np.dot(normal, centroid)
        return [float(normal[0]), float(normal[1]), float(normal[2]), float(d)]
    except Exception:
        return None


# ---------------------------------------------------------------------------
# Synthetic root generation
# ---------------------------------------------------------------------------

def _generate_root(
    crown: trimesh.Trimesh,
    base_plane: list[float] | None,
    jaw: str,
    length_mm: float = 12.0,
    taper: float = 0.6,
) -> trimesh.Trimesh | None:
    """Generate a synthetic root cone below the crown.

    Creates a tapered cone from the crown base boundary extending
    in the root direction (up for upper, down for lower).

    Args:
        crown: The crown mesh.
        base_plane: Crown base plane [nx, ny, nz, d].
        jaw: "upper" or "lower".
        length_mm: Root length.
        taper: Taper ratio (0=cylinder, 1=point).

    Returns:
        Root mesh, or None if generation fails.
    """
    try:
        # Get boundary loop vertices
        edges = crown.edges_unique
        edge_face_count = np.zeros(len(edges), dtype=int)
        face_edges = crown.faces_unique_edges
        for fe in face_edges:
            edge_face_count[fe] += 1

        boundary_edges = edges[edge_face_count == 1]
        if len(boundary_edges) < 3:
            return None

        boundary_verts = np.unique(boundary_edges.ravel())
        boundary_points = crown.vertices[boundary_verts]

        # Root direction
        if jaw == "upper":
            root_dir = np.array([0, 1, 0], dtype=float)  # up
        else:
            root_dir = np.array([0, -1, 0], dtype=float)  # down

        # Use base plane normal if available
        if base_plane is not None:
            root_dir = np.array(base_plane[:3])
            root_dir = root_dir / (np.linalg.norm(root_dir) + 1e-12)

        # Centroid of boundary (root base)
        base_center = boundary_points.mean(axis=0)
        # Apex of root
        apex = base_center + root_dir * length_mm

        # Create cone mesh by connecting boundary to apex
        n_boundary = len(boundary_points)

        # Vertices: boundary points + apex + tapered ring
        taper_points = base_center + (boundary_points - base_center) * (1 - taper) + root_dir * length_mm * 0.7
        all_verts = np.vstack([boundary_points, taper_points, [apex]])
        apex_idx = len(all_verts) - 1

        faces = []
        for i in range(n_boundary):
            j = (i + 1) % n_boundary
            # Side face: boundary → taper ring
            faces.append([i, j, n_boundary + i])
            faces.append([j, n_boundary + j, n_boundary + i])
            # Taper ring → apex
            faces.append([n_boundary + i, n_boundary + j, apex_idx])

        root = trimesh.Trimesh(
            vertices=all_verts,
            faces=np.array(faces),
            process=True,
        )

        if len(root.faces) < 3:
            return None

        return root
    except Exception as exc:
        logger.debug("Root generation failed: %s", exc)
        return None


# ---------------------------------------------------------------------------
# Gap detection
# ---------------------------------------------------------------------------

def _detect_gaps(
    tooth_objects: dict[int, ToothObject],
    jaw: str,
    threshold_mm: float = 0.3,
) -> list[GapInfo]:
    """Detect gaps between adjacent teeth."""
    gaps: list[GapInfo] = []
    fdis = sorted(tooth_objects.keys())

    if len(fdis) < 2:
        return gaps

    # Build adjacency pairs (teeth that should be neighbors in the arch)
    pairs = _get_adjacent_pairs(fdis)

    for fdi_a, fdi_b in pairs:
        if fdi_a not in tooth_objects or fdi_b not in tooth_objects:
            continue

        obj_a = tooth_objects[fdi_a]
        obj_b = tooth_objects[fdi_b]

        # Compute closest distance between the two crown meshes
        dist, midpoint, direction = _closest_mesh_distance(
            obj_a.crown_mesh, obj_b.crown_mesh,
        )

        gaps.append(GapInfo(
            tooth_a=fdi_a,
            tooth_b=fdi_b,
            gap_distance_mm=round(dist, 3),
            midpoint=midpoint,
            direction=direction,
            needs_correction=dist > threshold_mm,
        ))

    return gaps


def _get_adjacent_pairs(fdis: list[int]) -> list[tuple[int, int]]:
    """Get pairs of teeth that are anatomically adjacent."""
    pairs: list[tuple[int, int]] = []

    # Group by quadrant
    quadrants: dict[int, list[int]] = {}
    for fdi in fdis:
        q = get_quadrant(fdi)
        quadrants.setdefault(q, []).append(fdi)

    # Within each quadrant, consecutive tooth numbers are adjacent
    for q, teeth in quadrants.items():
        teeth.sort(key=lambda x: x % 10)
        for i in range(len(teeth) - 1):
            pairs.append((teeth[i], teeth[i + 1]))

    # Cross-midline: central incisors are adjacent
    # Upper: 11-21, Lower: 31-41
    cross_pairs = [(11, 21), (31, 41)]
    for a, b in cross_pairs:
        if a in fdis and b in fdis:
            pairs.append((a, b))

    return pairs


def _closest_mesh_distance(
    mesh_a: trimesh.Trimesh,
    mesh_b: trimesh.Trimesh,
) -> tuple[float, list[float], list[float]]:
    """Compute closest distance between two meshes.

    Uses vertex sampling for speed (not exact closest point on surface).

    Returns:
        (distance_mm, midpoint [x,y,z], direction [x,y,z])
    """
    # Sample vertices from both meshes
    verts_a = mesh_a.vertices
    verts_b = mesh_b.vertices

    # For large meshes, subsample for speed
    max_pts = 500
    if len(verts_a) > max_pts:
        idx_a = np.random.choice(len(verts_a), max_pts, replace=False)
        verts_a = verts_a[idx_a]
    if len(verts_b) > max_pts:
        idx_b = np.random.choice(len(verts_b), max_pts, replace=False)
        verts_b = verts_b[idx_b]

    # Compute pairwise distances using scipy
    from scipy.spatial import cKDTree

    tree_b = cKDTree(verts_b)
    dists, indices = tree_b.query(verts_a, k=1)

    min_idx = np.argmin(dists)
    min_dist = float(dists[min_idx])
    pt_a = verts_a[min_idx]
    pt_b = verts_b[indices[min_idx]]

    midpoint = ((pt_a + pt_b) / 2).tolist()
    direction = (pt_b - pt_a)
    norm = np.linalg.norm(direction)
    if norm > 1e-12:
        direction = (direction / norm).tolist()
    else:
        direction = [0.0, 0.0, 0.0]

    return min_dist, midpoint, direction


# ---------------------------------------------------------------------------
# Gap correction
# ---------------------------------------------------------------------------

def _correct_gaps(
    tooth_objects: dict[int, ToothObject],
    gaps: list[GapInfo],
    correction_mm: float = 0.3,
) -> int:
    """Move teeth slightly to close detected gaps.

    Each tooth in a gap pair is translated by half the correction distance
    toward the other tooth.

    Returns number of gaps corrected.
    """
    corrected = 0

    for gap in gaps:
        if not gap.needs_correction:
            continue

        obj_a = tooth_objects.get(gap.tooth_a)
        obj_b = tooth_objects.get(gap.tooth_b)
        if obj_a is None or obj_b is None:
            continue

        # Compute translation: move each tooth half the correction toward other
        direction = np.array(gap.direction)
        shift = min(correction_mm, gap.gap_distance_mm) / 2

        # Move tooth A toward B
        _translate_tooth(obj_a, direction * shift)
        # Move tooth B toward A
        _translate_tooth(obj_b, -direction * shift)

        corrected += 1

    return corrected


def _translate_tooth(obj: ToothObject, offset: np.ndarray) -> None:
    """Translate a tooth object by the given offset."""
    obj.crown_mesh.vertices += offset
    if obj.root_mesh is not None:
        obj.root_mesh.vertices += offset
    obj.combined_mesh.vertices += offset
    obj.centroid = obj.combined_mesh.centroid.tolist()
    obj.bbox_min = obj.combined_mesh.bounds[0].tolist()
    obj.bbox_max = obj.combined_mesh.bounds[1].tolist()
    # Re-export STL
    obj.stl_bytes = _export_stl(obj.combined_mesh)


# ---------------------------------------------------------------------------
# Gum extraction
# ---------------------------------------------------------------------------

def _extract_gum(
    mesh: trimesh.Trimesh,
    face_labels: np.ndarray,
) -> bytes | None:
    """Extract gum mesh from face labels."""
    gum_indices = np.where(face_labels == 0)[0]
    if len(gum_indices) == 0:
        return None
    try:
        gum = mesh.submesh([gum_indices], append=True)
        return _export_stl(gum)
    except Exception:
        return None


def _export_stl(mesh: trimesh.Trimesh) -> bytes:
    """Export mesh to binary STL bytes."""
    buf = io.BytesIO()
    mesh.export(buf, file_type="stl")
    return buf.getvalue()
