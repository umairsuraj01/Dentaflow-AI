# mesh_repair.py — Automatic mesh repair and quality assessment for dental scans.
#
# OnyxCeph Phase 1: 3D Scan Import & Automatic Repair
#   - Hole detection & closure (boundary loop stitching)
#   - Island removal (connected component analysis, keep largest)
#   - Bridge/spike removal (thin/degenerate triangle detection)
#   - Normal consistency fixing (orient all faces outward)
#   - Taubin smoothing (lambda/mu alternating, volume-preserving)
#   - Mesh quality report (watertight, manifold, face count, etc.)

from __future__ import annotations

import logging
import time
from dataclasses import dataclass, field

import numpy as np
import trimesh

from ai.data.mesh_loader import load_mesh

logger = logging.getLogger(__name__)


# ---------------------------------------------------------------------------
# Data structures
# ---------------------------------------------------------------------------

@dataclass
class MeshQualityReport:
    """Comprehensive mesh quality assessment."""

    is_watertight: bool
    is_manifold: bool
    vertex_count: int
    face_count: int
    edge_count: int
    hole_count: int
    connected_components: int
    degenerate_face_count: int
    duplicate_face_count: int
    min_face_area: float
    max_face_area: float
    mean_face_area: float
    bounding_box_size: list[float]  # [x, y, z] dimensions in mm
    surface_area: float
    volume: float | None  # None if not watertight
    euler_number: int
    non_manifold_edges: int
    quality_score: float  # 0-100 overall quality rating


@dataclass
class MeshRepairResult:
    """Output of the full repair pipeline."""

    mesh: trimesh.Trimesh
    quality_before: MeshQualityReport
    quality_after: MeshQualityReport
    repairs_applied: list[str]
    processing_time_seconds: float
    holes_filled: int
    islands_removed: int
    spikes_removed: int
    normals_fixed: bool
    faces_smoothed: int


# ---------------------------------------------------------------------------
# Main repair orchestrator
# ---------------------------------------------------------------------------

def repair_mesh(
    file_path: str | None = None,
    mesh: trimesh.Trimesh | None = None,
    *,
    fill_holes: bool = True,
    remove_islands: bool = True,
    remove_spikes: bool = True,
    fix_normals: bool = True,
    smooth: bool = True,
    smooth_iterations: int = 10,
    smooth_lambda: float = 0.5,
    smooth_mu: float = -0.53,
    island_threshold: float = 0.02,
    spike_aspect_ratio: float = 30.0,
    spike_min_area: float = 1e-6,
) -> MeshRepairResult:
    """Run the complete mesh repair pipeline.

    Either ``file_path`` or ``mesh`` must be provided. If both are given,
    ``mesh`` takes precedence.

    Args:
        file_path: Path to STL/OBJ/PLY file.
        mesh: Pre-loaded trimesh object.
        fill_holes: Close boundary loops to make mesh watertight.
        remove_islands: Remove small disconnected components.
        remove_spikes: Remove thin/degenerate triangles.
        fix_normals: Ensure consistent outward-facing normals.
        smooth: Apply Taubin smoothing.
        smooth_iterations: Number of Taubin smoothing passes.
        smooth_lambda: Shrink factor (positive).
        smooth_mu: Inflate factor (negative, |mu| > lambda).
        island_threshold: Components with fewer than this fraction of
            total vertices are removed.
        spike_aspect_ratio: Triangles with aspect ratio above this are
            considered spikes.
        spike_min_area: Triangles with area below this are degenerate.

    Returns:
        MeshRepairResult with repaired mesh and diagnostics.
    """
    start = time.time()

    if mesh is None:
        if file_path is None:
            raise ValueError("Either file_path or mesh must be provided")
        mesh = load_mesh(file_path)
    else:
        mesh = mesh.copy()

    quality_before = assess_quality(mesh)
    repairs: list[str] = []
    holes_filled = 0
    islands_removed = 0
    spikes_removed = 0
    normals_fixed_flag = False
    faces_smoothed = 0

    # Step 1: Remove degenerate / duplicate faces
    n_before = len(mesh.faces)
    mesh = _remove_degenerate_faces(mesh, spike_min_area)
    n_after = len(mesh.faces)
    if n_after < n_before:
        removed = n_before - n_after
        repairs.append(f"Removed {removed} degenerate faces")
        spikes_removed += removed

    # Step 2: Remove duplicate faces
    n_before = len(mesh.faces)
    mesh = _remove_duplicate_faces(mesh)
    n_after = len(mesh.faces)
    if n_after < n_before:
        removed = n_before - n_after
        repairs.append(f"Removed {removed} duplicate faces")

    # Step 3: Remove spikes (thin triangles with extreme aspect ratio)
    if remove_spikes:
        n_before = len(mesh.faces)
        mesh = _remove_spikes(mesh, spike_aspect_ratio)
        n_after = len(mesh.faces)
        if n_after < n_before:
            removed = n_before - n_after
            spikes_removed += removed
            repairs.append(f"Removed {removed} spike triangles")

    # Step 4: Remove small islands
    if remove_islands:
        n_components_before = _count_components(mesh)
        mesh, islands_removed = _remove_islands(mesh, island_threshold)
        if islands_removed > 0:
            repairs.append(
                f"Removed {islands_removed} small island components"
            )

    # Step 5: Fill holes
    if fill_holes:
        holes_filled = _fill_holes(mesh)
        if holes_filled > 0:
            repairs.append(f"Filled {holes_filled} holes")

    # Step 6: Fix normals
    if fix_normals:
        normals_fixed_flag = _fix_normals(mesh)
        if normals_fixed_flag:
            repairs.append("Fixed inconsistent normals")

    # Step 7: Taubin smoothing
    if smooth and smooth_iterations > 0:
        faces_smoothed = _taubin_smooth(
            mesh, smooth_iterations, smooth_lambda, smooth_mu,
        )
        if faces_smoothed > 0:
            repairs.append(
                f"Taubin smoothing: {smooth_iterations} iterations, "
                f"{faces_smoothed} vertices adjusted"
            )

    quality_after = assess_quality(mesh)
    elapsed = time.time() - start

    logger.info(
        "Mesh repair complete: %d repairs in %.2fs (quality: %.1f → %.1f)",
        len(repairs), elapsed,
        quality_before.quality_score, quality_after.quality_score,
    )

    return MeshRepairResult(
        mesh=mesh,
        quality_before=quality_before,
        quality_after=quality_after,
        repairs_applied=repairs,
        processing_time_seconds=round(elapsed, 3),
        holes_filled=holes_filled,
        islands_removed=islands_removed,
        spikes_removed=spikes_removed,
        normals_fixed=normals_fixed_flag,
        faces_smoothed=faces_smoothed,
    )


# ---------------------------------------------------------------------------
# Quality assessment
# ---------------------------------------------------------------------------

def assess_quality(mesh: trimesh.Trimesh) -> MeshQualityReport:
    """Generate a comprehensive quality report for a mesh."""
    face_areas = mesh.area_faces
    edges = mesh.edges_unique
    n_edges = len(edges)

    # Hole count: number of boundary loops
    hole_count = _count_holes(mesh)

    # Connected components
    n_components = _count_components(mesh)

    # Degenerate faces (near-zero area)
    degenerate_count = int(np.sum(face_areas < 1e-10))

    # Duplicate faces
    duplicate_count = _count_duplicate_faces(mesh)

    # Non-manifold edges (shared by more than 2 faces)
    non_manifold = _count_non_manifold_edges(mesh)

    # Euler number: V - E + F
    euler = len(mesh.vertices) - n_edges + len(mesh.faces)

    # Bounding box
    bbox = mesh.bounds
    bbox_size = (bbox[1] - bbox[0]).tolist()

    # Volume (only valid for watertight)
    vol = None
    if mesh.is_watertight:
        try:
            vol = float(mesh.volume)
        except Exception:
            vol = None

    # Quality score (0-100)
    score = _compute_quality_score(
        mesh, hole_count, n_components, degenerate_count,
        non_manifold, duplicate_count,
    )

    return MeshQualityReport(
        is_watertight=mesh.is_watertight,
        is_manifold=non_manifold == 0,
        vertex_count=len(mesh.vertices),
        face_count=len(mesh.faces),
        edge_count=n_edges,
        hole_count=hole_count,
        connected_components=n_components,
        degenerate_face_count=degenerate_count,
        duplicate_face_count=duplicate_count,
        min_face_area=float(np.min(face_areas)) if len(face_areas) > 0 else 0.0,
        max_face_area=float(np.max(face_areas)) if len(face_areas) > 0 else 0.0,
        mean_face_area=float(np.mean(face_areas)) if len(face_areas) > 0 else 0.0,
        bounding_box_size=bbox_size,
        surface_area=float(mesh.area),
        volume=vol,
        euler_number=euler,
        non_manifold_edges=non_manifold,
        quality_score=score,
    )


def _compute_quality_score(
    mesh: trimesh.Trimesh,
    hole_count: int,
    n_components: int,
    degenerate_count: int,
    non_manifold_edges: int,
    duplicate_count: int,
) -> float:
    """Compute 0-100 quality score based on mesh characteristics."""
    score = 100.0

    # Penalty for holes (10 points per hole, max 30)
    score -= min(hole_count * 10, 30)

    # Penalty for multiple components (5 per extra, max 20)
    score -= min((n_components - 1) * 5, 20)

    # Penalty for degenerate faces
    if len(mesh.faces) > 0:
        degen_ratio = degenerate_count / len(mesh.faces)
        score -= min(degen_ratio * 100, 15)

    # Penalty for non-manifold edges (5 per edge, max 20)
    score -= min(non_manifold_edges * 5, 20)

    # Penalty for duplicate faces
    if len(mesh.faces) > 0:
        dup_ratio = duplicate_count / len(mesh.faces)
        score -= min(dup_ratio * 50, 10)

    # Bonus for watertight
    if not mesh.is_watertight:
        score -= 5

    return max(0.0, round(score, 1))


# ---------------------------------------------------------------------------
# Repair operations
# ---------------------------------------------------------------------------

def _remove_degenerate_faces(
    mesh: trimesh.Trimesh,
    min_area: float = 1e-6,
) -> trimesh.Trimesh:
    """Remove faces with near-zero area."""
    areas = mesh.area_faces
    valid_mask = areas >= min_area
    if np.all(valid_mask):
        return mesh
    mesh.update_faces(valid_mask)
    mesh.remove_unreferenced_vertices()
    logger.debug(
        "Removed %d degenerate faces (area < %e)",
        int(np.sum(~valid_mask)), min_area,
    )
    return mesh


def _remove_duplicate_faces(mesh: trimesh.Trimesh) -> trimesh.Trimesh:
    """Remove exact duplicate faces."""
    if hasattr(mesh, "remove_duplicate_faces"):
        mesh.remove_duplicate_faces()
    elif hasattr(mesh, "unique_faces"):
        unique = mesh.unique_faces()
        if len(unique) < len(mesh.faces):
            mesh.update_faces(unique)
    return mesh


def _remove_spikes(
    mesh: trimesh.Trimesh,
    max_aspect_ratio: float = 30.0,
) -> trimesh.Trimesh:
    """Remove spike triangles with extreme aspect ratios.

    Aspect ratio = longest edge / shortest altitude. Spikes are thin,
    needle-like triangles that cause rendering artifacts and smoothing issues.
    """
    faces = mesh.faces
    vertices = mesh.vertices

    if len(faces) == 0:
        return mesh

    # Compute edge lengths for each face
    v0 = vertices[faces[:, 0]]
    v1 = vertices[faces[:, 1]]
    v2 = vertices[faces[:, 2]]

    edge_a = np.linalg.norm(v1 - v0, axis=1)  # edge opposite v2
    edge_b = np.linalg.norm(v2 - v1, axis=1)  # edge opposite v0
    edge_c = np.linalg.norm(v0 - v2, axis=1)  # edge opposite v1

    # Longest edge per face
    longest = np.maximum(np.maximum(edge_a, edge_b), edge_c)
    # Shortest edge per face
    shortest = np.minimum(np.minimum(edge_a, edge_b), edge_c)

    # Avoid division by zero
    shortest = np.maximum(shortest, 1e-12)

    # Simple aspect ratio: longest / shortest edge
    aspect = longest / shortest
    valid_mask = aspect <= max_aspect_ratio

    if np.all(valid_mask):
        return mesh

    mesh.update_faces(valid_mask)
    mesh.remove_unreferenced_vertices()
    return mesh


def _remove_islands(
    mesh: trimesh.Trimesh,
    threshold: float = 0.02,
) -> tuple[trimesh.Trimesh, int]:
    """Remove small disconnected components.

    Keeps only components with more than ``threshold`` fraction of the
    total vertex count.

    Returns:
        (cleaned_mesh, number_of_islands_removed)
    """
    components = mesh.split(only_watertight=False)
    if len(components) <= 1:
        return mesh, 0

    total_verts = sum(c.vertices.shape[0] for c in components)
    min_verts = int(total_verts * threshold)

    kept = [c for c in components if c.vertices.shape[0] > min_verts]
    removed = len(components) - len(kept)

    if not kept:
        # Don't remove everything — keep the largest
        kept = [max(components, key=lambda c: c.vertices.shape[0])]
        removed = len(components) - 1

    if removed == 0:
        return mesh, 0

    combined = trimesh.util.concatenate(kept)
    logger.info("Removed %d island components", removed)
    return combined, removed


def _count_holes(mesh: trimesh.Trimesh) -> int:
    """Count boundary loops (holes) in the mesh."""
    try:
        # Boundary edges are edges that belong to exactly one face
        edges = mesh.edges_sorted
        # Count occurrences of each edge
        edge_tuples = [tuple(e) for e in edges]
        from collections import Counter
        edge_counts = Counter(edge_tuples)
        boundary_edges = [e for e, c in edge_counts.items() if c == 1]

        if not boundary_edges:
            return 0

        # Group boundary edges into loops via connected components
        from collections import defaultdict
        adj: dict[int, list[int]] = defaultdict(list)
        for e in boundary_edges:
            adj[e[0]].append(e[1])
            adj[e[1]].append(e[0])

        visited: set[int] = set()
        loops = 0
        for start in adj:
            if start in visited:
                continue
            # BFS to find connected boundary component
            queue = [start]
            visited.add(start)
            while queue:
                node = queue.pop()
                for nb in adj[node]:
                    if nb not in visited:
                        visited.add(nb)
                        queue.append(nb)
            loops += 1

        return loops
    except Exception:
        return 0


def _fill_holes(mesh: trimesh.Trimesh) -> int:
    """Fill holes in the mesh. Returns number of holes filled."""
    holes_before = _count_holes(mesh)
    if holes_before == 0:
        return 0
    mesh.fill_holes()
    holes_after = _count_holes(mesh)
    filled = max(0, holes_before - holes_after)
    if filled > 0:
        logger.info("Filled %d holes (%d → %d)", filled, holes_before, holes_after)
    return filled


def _fix_normals(mesh: trimesh.Trimesh) -> bool:
    """Fix face winding and normals. Returns True if changes were made."""
    # Check if normals are already consistent by looking at the winding
    try:
        winding_before = mesh.face_normals.copy()
        mesh.fix_normals()
        winding_after = mesh.face_normals

        # Check if any normals actually changed
        if winding_before.shape == winding_after.shape:
            diff = np.abs(winding_before - winding_after).sum()
            changed = bool(diff > 1e-6)
        else:
            changed = True

        if changed:
            logger.info("Fixed inconsistent normals")
        return changed
    except Exception:
        mesh.fix_normals()
        return True


def _count_components(mesh: trimesh.Trimesh) -> int:
    """Count connected components in the mesh."""
    try:
        components = mesh.split(only_watertight=False)
        return len(components)
    except Exception:
        return 1


def _count_duplicate_faces(mesh: trimesh.Trimesh) -> int:
    """Count exact duplicate faces."""
    sorted_faces = np.sort(mesh.faces, axis=1)
    unique = np.unique(sorted_faces, axis=0)
    return len(sorted_faces) - len(unique)


def _count_non_manifold_edges(mesh: trimesh.Trimesh) -> int:
    """Count edges shared by more than 2 faces."""
    try:
        edges = mesh.edges_sorted
        edge_tuples = [tuple(e) for e in edges]
        from collections import Counter
        edge_counts = Counter(edge_tuples)
        return sum(1 for c in edge_counts.values() if c > 2)
    except Exception:
        return 0


# ---------------------------------------------------------------------------
# Taubin smoothing — volume-preserving mesh smoothing
# ---------------------------------------------------------------------------

def taubin_smooth(
    mesh: trimesh.Trimesh,
    iterations: int = 10,
    lam: float = 0.5,
    mu: float = -0.53,
) -> int:
    """Apply Taubin smoothing to a mesh (public API).

    Taubin smoothing alternates a shrinking Laplacian step (lambda > 0) with
    an inflating step (mu < 0, |mu| > lambda) to smooth surfaces without
    volume shrinkage.

    Args:
        mesh: Mesh to smooth (modified in place).
        iterations: Number of shrink-inflate pairs.
        lam: Shrink factor (positive, typically 0.3-0.7).
        mu: Inflate factor (negative, |mu| > lam, typically -0.53).

    Returns:
        Number of vertices that moved more than 1e-6 from original position.
    """
    return _taubin_smooth(mesh, iterations, lam, mu)


def _taubin_smooth(
    mesh: trimesh.Trimesh,
    iterations: int,
    lam: float,
    mu: float,
) -> int:
    """Internal Taubin smoothing implementation."""
    vertices = mesh.vertices.copy().astype(np.float64)
    n_verts = len(vertices)

    if n_verts == 0:
        return 0

    # Build vertex adjacency from faces
    adj = _build_vertex_adjacency(mesh)

    original = vertices.copy()

    for _it in range(iterations):
        # Shrink step (lambda)
        vertices = _laplacian_step(vertices, adj, lam)
        # Inflate step (mu)
        vertices = _laplacian_step(vertices, adj, mu)

    # Count moved vertices
    displacements = np.linalg.norm(vertices - original, axis=1)
    moved = int(np.sum(displacements > 1e-6))

    mesh.vertices = vertices.astype(np.float64)

    logger.debug(
        "Taubin smoothing: %d iterations, %d/%d vertices moved",
        iterations, moved, n_verts,
    )
    return moved


def _build_vertex_adjacency(mesh: trimesh.Trimesh) -> list[np.ndarray]:
    """Build vertex adjacency lists from mesh faces.

    Returns a list where adj[i] is an array of vertex indices connected to
    vertex i by an edge.
    """
    from collections import defaultdict

    n_verts = len(mesh.vertices)
    neighbors: dict[int, set[int]] = defaultdict(set)

    for face in mesh.faces:
        v0, v1, v2 = int(face[0]), int(face[1]), int(face[2])
        neighbors[v0].update([v1, v2])
        neighbors[v1].update([v0, v2])
        neighbors[v2].update([v0, v1])

    adj = [
        np.array(sorted(neighbors.get(i, set())), dtype=np.int64)
        for i in range(n_verts)
    ]
    return adj


def _laplacian_step(
    vertices: np.ndarray,
    adj: list[np.ndarray],
    factor: float,
) -> np.ndarray:
    """One step of Laplacian smoothing.

    Each vertex is moved toward (factor > 0) or away from (factor < 0)
    the centroid of its neighbors.
    """
    new_verts = vertices.copy()
    for i in range(len(vertices)):
        neighbors = adj[i]
        if len(neighbors) == 0:
            continue
        centroid = vertices[neighbors].mean(axis=0)
        laplacian = centroid - vertices[i]
        new_verts[i] = vertices[i] + factor * laplacian
    return new_verts
