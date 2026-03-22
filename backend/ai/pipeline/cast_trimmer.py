# cast_trimmer.py — Cast adjustment and trimming for dental models.
#
# OnyxCeph Phase 5: Cast Adjust & Trim
#   - Arch boundary detection (gum line via curvature + segmentation)
#   - Trim line generation from boundary with configurable offset
#   - Trim plane computation (best-fit plane from trim line points)
#   - Mesh trimming: remove faces below/above the trim plane
#   - Base flattening for model printing
#   - Adjustable trim offset and smoothing

from __future__ import annotations

import logging
import time
from dataclasses import dataclass, field

import numpy as np
import trimesh
from scipy.spatial import cKDTree

logger = logging.getLogger(__name__)


# ---------------------------------------------------------------------------
# Data structures
# ---------------------------------------------------------------------------

@dataclass
class TrimLinePoint:
    """A single point on the trim line."""

    position: list[float]  # [x, y, z]
    normal: list[float]    # surface normal at this point
    curvature: float       # local curvature estimate


@dataclass
class TrimPlane:
    """A plane used for trimming the cast model."""

    origin: list[float]    # [x, y, z] center of the plane
    normal: list[float]    # [nx, ny, nz] unit normal (pointing toward kept side)
    offset_mm: float       # distance below gum line


@dataclass
class CastTrimResult:
    """Complete output of the cast trimming pipeline."""

    trimmed_mesh: trimesh.Trimesh
    trimmed_stl_bytes: bytes
    trim_line_points: list[TrimLinePoint]
    trim_plane: TrimPlane
    faces_removed: int
    faces_kept: int
    original_face_count: int
    base_flattened: bool
    processing_time_seconds: float
    jaw: str


# ---------------------------------------------------------------------------
# Main entry point
# ---------------------------------------------------------------------------

def trim_cast(
    stl_path: str,
    face_labels: np.ndarray,
    jaw: str = "upper",
    offset_mm: float = 2.0,
    smooth_trim_line: bool = True,
    smooth_iterations: int = 5,
    flatten_base: bool = True,
    base_thickness_mm: float = 3.0,
) -> CastTrimResult:
    """Trim a dental cast model along the gum line.

    Args:
        stl_path: Path to the STL mesh file.
        face_labels: (F,) per-face class indices (0=gum, 1-14=teeth).
        jaw: "upper" or "lower".
        offset_mm: Distance below gum line for trim plane.
        smooth_trim_line: Apply Laplacian smoothing to trim line.
        smooth_iterations: Number of smoothing passes.
        flatten_base: Whether to flatten the base of the trimmed model.
        base_thickness_mm: Minimum thickness of the base.

    Returns:
        CastTrimResult with trimmed mesh, trim line, and plane.
    """
    t0 = time.time()

    mesh = trimesh.load(stl_path)
    if not isinstance(mesh, trimesh.Trimesh):
        mesh = trimesh.Trimesh(
            vertices=np.array(mesh.vertices),
            faces=np.array(mesh.faces),
        )

    original_face_count = len(mesh.faces)

    # Step 1: Detect arch boundary (gum-tooth border)
    boundary_vertices = _detect_arch_boundary(mesh, face_labels)

    # Step 2: Generate trim line points
    trim_points = _generate_trim_line(
        mesh, boundary_vertices, offset_mm, jaw,
    )

    # Step 3: Smooth trim line
    if smooth_trim_line and len(trim_points) > 3:
        trim_points = _smooth_trim_line(trim_points, smooth_iterations)

    # Step 4: Compute trim plane
    trim_plane = _compute_trim_plane(trim_points, jaw, offset_mm)

    # Step 5: Trim the mesh
    trimmed = _trim_mesh(mesh, trim_plane, jaw)

    # Step 6: Flatten base
    base_flattened = False
    if flatten_base and trimmed is not None and len(trimmed.faces) > 0:
        trimmed = _flatten_base(trimmed, trim_plane, base_thickness_mm, jaw)
        base_flattened = True

    if trimmed is None or len(trimmed.faces) == 0:
        # Fallback: return original mesh if trimming removed everything
        trimmed = mesh
        base_flattened = False

    faces_kept = len(trimmed.faces)
    faces_removed = original_face_count - faces_kept

    # Export to STL bytes
    stl_bytes = trimmed.export(file_type="stl")

    # Build trim line output
    trim_line_output = [
        TrimLinePoint(
            position=p.tolist() if isinstance(p, np.ndarray) else p,
            normal=[0, 0, 0],
            curvature=0.0,
        )
        for p in trim_points
    ]

    elapsed = time.time() - t0

    logger.info(
        "Cast trim: %d→%d faces (removed %d), %.2fs",
        original_face_count, faces_kept, faces_removed, elapsed,
    )

    return CastTrimResult(
        trimmed_mesh=trimmed,
        trimmed_stl_bytes=stl_bytes,
        trim_line_points=trim_line_output,
        trim_plane=trim_plane,
        faces_removed=faces_removed,
        faces_kept=faces_kept,
        original_face_count=original_face_count,
        base_flattened=base_flattened,
        processing_time_seconds=round(elapsed, 3),
        jaw=jaw,
    )


# ---------------------------------------------------------------------------
# Arch boundary detection
# ---------------------------------------------------------------------------

def _detect_arch_boundary(
    mesh: trimesh.Trimesh,
    face_labels: np.ndarray,
) -> np.ndarray:
    """Find vertices at the boundary between gum (class 0) and teeth.

    Returns an array of vertex indices that lie on the gum-tooth border.
    """
    gum_mask = face_labels == 0
    tooth_mask = face_labels > 0

    # Strategy 1: Find boundary edges shared by a gum face and a tooth face
    edges_to_faces: dict[tuple[int, int], list[int]] = {}

    for fi, face in enumerate(mesh.faces):
        for i in range(3):
            v0, v1 = int(face[i]), int(face[(i + 1) % 3])
            edge = (min(v0, v1), max(v0, v1))
            if edge not in edges_to_faces:
                edges_to_faces[edge] = []
            edges_to_faces[edge].append(fi)

    boundary_verts = set()
    for edge, face_ids in edges_to_faces.items():
        if len(face_ids) == 2:
            f0, f1 = face_ids
            if (gum_mask[f0] and tooth_mask[f1]) or (tooth_mask[f0] and gum_mask[f1]):
                boundary_verts.add(edge[0])
                boundary_verts.add(edge[1])

    # Strategy 2: If no shared edges (concatenated meshes), use spatial proximity
    if len(boundary_verts) == 0:
        gum_face_idx = np.where(gum_mask)[0]
        tooth_face_idx = np.where(tooth_mask)[0]

        if len(gum_face_idx) > 0 and len(tooth_face_idx) > 0:
            # Get gum and tooth vertex positions
            gum_vert_idx = np.unique(mesh.faces[gum_face_idx].ravel())
            tooth_vert_idx = np.unique(mesh.faces[tooth_face_idx].ravel())

            gum_pts = mesh.vertices[gum_vert_idx]
            tooth_pts = mesh.vertices[tooth_vert_idx]

            # Find tooth vertices closest to gum vertices
            tree = cKDTree(gum_pts)
            dists, _ = tree.query(tooth_pts, k=1)
            threshold = np.percentile(dists, 30)  # bottom 30% closest
            close_mask = dists <= threshold
            boundary_verts = set(tooth_vert_idx[close_mask].tolist())

    return np.array(sorted(boundary_verts), dtype=np.int64)


def _detect_gum_boundary_by_curvature(
    mesh: trimesh.Trimesh,
    percentile: float = 85.0,
) -> np.ndarray:
    """Fallback: detect gum line using curvature analysis.

    High-curvature vertices at the gum-tooth junction form the boundary.
    """
    # Discrete mean curvature via vertex normal divergence
    curvatures = _estimate_vertex_curvatures(mesh)
    threshold = np.percentile(curvatures, percentile)
    boundary_idx = np.where(curvatures >= threshold)[0]
    return boundary_idx


def _estimate_vertex_curvatures(mesh: trimesh.Trimesh) -> np.ndarray:
    """Estimate per-vertex curvature using the angle deficit method.

    For each vertex, curvature ≈ (2π - Σ angles) / (Voronoi area).
    Returns absolute curvature values.
    """
    n_verts = len(mesh.vertices)
    angle_sums = np.zeros(n_verts)
    area_sums = np.zeros(n_verts)

    v = mesh.vertices
    for face in mesh.faces:
        i, j, k = int(face[0]), int(face[1]), int(face[2])
        p0, p1, p2 = v[i], v[j], v[k]

        # Edge vectors
        e01 = p1 - p0
        e02 = p2 - p0
        e12 = p2 - p1
        e10 = p0 - p1
        e20 = p0 - p2
        e21 = p1 - p2

        # Face area
        face_area = 0.5 * np.linalg.norm(np.cross(e01, e02))
        if face_area < 1e-12:
            continue

        voronoi_area = face_area / 3.0

        # Angles at each vertex
        def _safe_angle(a: np.ndarray, b: np.ndarray) -> float:
            cos_val = np.dot(a, b) / (np.linalg.norm(a) * np.linalg.norm(b) + 1e-12)
            return float(np.arccos(np.clip(cos_val, -1, 1)))

        angle_sums[i] += _safe_angle(e01, e02)
        angle_sums[j] += _safe_angle(e10, e12)
        angle_sums[k] += _safe_angle(e20, e21)

        area_sums[i] += voronoi_area
        area_sums[j] += voronoi_area
        area_sums[k] += voronoi_area

    # Gaussian curvature = (2π - angle_sum) / area
    area_sums = np.maximum(area_sums, 1e-12)
    curvatures = np.abs(2 * np.pi - angle_sums) / area_sums

    return curvatures


# ---------------------------------------------------------------------------
# Trim line generation
# ---------------------------------------------------------------------------

def _generate_trim_line(
    mesh: trimesh.Trimesh,
    boundary_vertices: np.ndarray,
    offset_mm: float,
    jaw: str,
) -> list[np.ndarray]:
    """Generate a trim line from boundary vertices with an offset.

    The trim line is placed offset_mm below the boundary in the root
    direction (up for upper, down for lower).
    """
    if len(boundary_vertices) == 0:
        # Fallback: use bottom/top 20% of vertices based on jaw
        y_coords = mesh.vertices[:, 1]
        if jaw == "upper":
            threshold = np.percentile(y_coords, 80)
            candidates = [mesh.vertices[i].copy() for i in range(len(mesh.vertices))
                          if y_coords[i] > threshold]
        else:
            threshold = np.percentile(y_coords, 20)
            candidates = [mesh.vertices[i].copy() for i in range(len(mesh.vertices))
                          if y_coords[i] < threshold]
        return candidates[::max(1, len(candidates) // 50)]

    positions = mesh.vertices[boundary_vertices].copy()

    # Offset in root direction
    if jaw == "upper":
        positions[:, 1] += offset_mm  # move up (root direction for upper)
    else:
        positions[:, 1] -= offset_mm  # move down (root direction for lower)

    # Order points along the arch (sort by angle from centroid in XZ plane)
    centroid_xz = positions[:, [0, 2]].mean(axis=0)
    angles = np.arctan2(
        positions[:, 2] - centroid_xz[1],
        positions[:, 0] - centroid_xz[0],
    )
    order = np.argsort(angles)
    ordered_positions = positions[order]

    return [p for p in ordered_positions]


def _smooth_trim_line(
    points: list[np.ndarray],
    iterations: int = 5,
) -> list[np.ndarray]:
    """Apply Laplacian smoothing to the trim line.

    Each point moves toward the average of its neighbors.
    """
    arr = np.array([p if isinstance(p, np.ndarray) else np.array(p) for p in points])
    n = len(arr)

    if n < 3:
        return points

    for _ in range(iterations):
        smoothed = arr.copy()
        for i in range(n):
            prev_idx = (i - 1) % n
            next_idx = (i + 1) % n
            smoothed[i] = 0.5 * arr[i] + 0.25 * arr[prev_idx] + 0.25 * arr[next_idx]
        arr = smoothed

    return [arr[i] for i in range(n)]


# ---------------------------------------------------------------------------
# Trim plane computation
# ---------------------------------------------------------------------------

def _compute_trim_plane(
    trim_points: list[np.ndarray],
    jaw: str,
    offset_mm: float,
) -> TrimPlane:
    """Compute a best-fit plane from trim line points.

    Uses SVD to fit a plane, then ensures the normal points toward
    the kept side (toward teeth, away from base).
    """
    if len(trim_points) < 3:
        # Fallback: horizontal plane
        normal = [0.0, -1.0, 0.0] if jaw == "upper" else [0.0, 1.0, 0.0]
        return TrimPlane(
            origin=[0.0, 0.0, 0.0],
            normal=normal,
            offset_mm=offset_mm,
        )

    pts = np.array([p if isinstance(p, np.ndarray) else np.array(p)
                     for p in trim_points])
    centroid = pts.mean(axis=0)

    # SVD for plane fitting
    centered = pts - centroid
    _, _, Vt = np.linalg.svd(centered)
    normal = Vt[-1]  # smallest singular value → plane normal

    # Ensure normal points toward the kept side
    # For upper jaw: teeth are below gum line (negative Y), keep below → normal should point down (-Y)
    # For lower jaw: teeth are above gum line (positive Y), keep above → normal should point up (+Y)
    if jaw == "upper":
        if float(normal[1]) > 0:
            normal = -normal
    else:
        if float(normal[1]) < 0:
            normal = -normal

    norm_len = float(np.linalg.norm(normal))
    if norm_len > 1e-12:
        normal = normal / norm_len

    return TrimPlane(
        origin=centroid.tolist(),
        normal=normal.tolist(),
        offset_mm=offset_mm,
    )


# ---------------------------------------------------------------------------
# Mesh trimming
# ---------------------------------------------------------------------------

def _trim_mesh(
    mesh: trimesh.Trimesh,
    plane: TrimPlane,
    jaw: str,
) -> trimesh.Trimesh:
    """Remove faces on the non-tooth side of the trim plane.

    Keeps faces whose centroids are on the tooth side of the plane.
    """
    origin = np.array(plane.origin)
    normal = np.array(plane.normal)

    # Face centroids
    v0 = mesh.vertices[mesh.faces[:, 0]]
    v1 = mesh.vertices[mesh.faces[:, 1]]
    v2 = mesh.vertices[mesh.faces[:, 2]]
    face_centroids = (v0 + v1 + v2) / 3.0

    # Signed distance from plane
    signed_dist = np.dot(face_centroids - origin, normal)

    # Keep faces on the positive side of the normal (toward teeth)
    keep_mask = signed_dist >= 0

    if np.sum(keep_mask) == 0:
        return mesh

    kept_faces = mesh.faces[keep_mask]
    trimmed = trimesh.Trimesh(
        vertices=mesh.vertices.copy(),
        faces=kept_faces,
        process=True,
    )

    return trimmed


def _flatten_base(
    mesh: trimesh.Trimesh,
    plane: TrimPlane,
    thickness_mm: float,
    jaw: str,
) -> trimesh.Trimesh:
    """Flatten the base of the trimmed model.

    Projects vertices near the trim plane onto the plane to create
    a flat base surface.
    """
    origin = np.array(plane.origin)
    normal = np.array(plane.normal)

    vertices = mesh.vertices.copy()

    # Find vertices near the trim plane (within thickness_mm)
    signed_dist = np.dot(vertices - origin, normal)

    # Vertices close to the plane (small positive distance)
    near_plane = (signed_dist >= 0) & (signed_dist < thickness_mm)

    # Project these vertices onto the plane
    if np.any(near_plane):
        for i in np.where(near_plane)[0]:
            d = signed_dist[i]
            # Move vertex onto the plane
            vertices[i] = vertices[i] - d * normal

    return trimesh.Trimesh(
        vertices=vertices,
        faces=mesh.faces.copy(),
        process=True,
    )


# ---------------------------------------------------------------------------
# Utility: get trim line from segmented mesh (convenience)
# ---------------------------------------------------------------------------

def get_arch_boundary_points(
    mesh: trimesh.Trimesh,
    face_labels: np.ndarray,
) -> np.ndarray:
    """Get the 3D positions of arch boundary vertices.

    Useful for visualization in the frontend.
    Returns: (N, 3) array of boundary vertex positions.
    """
    boundary_idx = _detect_arch_boundary(mesh, face_labels)
    if len(boundary_idx) == 0:
        return np.empty((0, 3))
    return mesh.vertices[boundary_idx]


def estimate_trim_plane_from_labels(
    stl_path: str,
    face_labels: np.ndarray,
    jaw: str = "upper",
    offset_mm: float = 2.0,
) -> TrimPlane:
    """Convenience: estimate a trim plane from STL + labels without full trim."""
    mesh = trimesh.load(stl_path)
    if not isinstance(mesh, trimesh.Trimesh):
        mesh = trimesh.Trimesh(
            vertices=np.array(mesh.vertices),
            faces=np.array(mesh.faces),
        )

    boundary = _detect_arch_boundary(mesh, face_labels)
    trim_points = _generate_trim_line(mesh, boundary, offset_mm, jaw)
    return _compute_trim_plane(trim_points, jaw, offset_mm)
