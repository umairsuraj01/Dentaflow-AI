# mesh_utils.py — Mesh manipulation utilities.

from __future__ import annotations

import logging
from typing import TYPE_CHECKING

import numpy as np

if TYPE_CHECKING:
    import trimesh

logger = logging.getLogger(__name__)


def fill_holes(mesh: "trimesh.Trimesh") -> "trimesh.Trimesh":
    """Fill holes in a mesh if it is not watertight."""
    if not mesh.is_watertight:
        mesh.fill_holes()
    return mesh


def fix_normals(mesh: "trimesh.Trimesh") -> "trimesh.Trimesh":
    """Ensure consistent face winding and vertex normals."""
    mesh.fix_normals()
    return mesh


def remove_duplicate_faces(mesh: "trimesh.Trimesh") -> "trimesh.Trimesh":
    """Remove duplicate and degenerate faces."""
    # trimesh API varies by version — guard gracefully
    if hasattr(mesh, "remove_degenerate_faces"):
        mesh.remove_degenerate_faces()
    if hasattr(mesh, "remove_duplicate_faces"):
        mesh.remove_duplicate_faces()
    elif hasattr(mesh, "update_faces"):
        # In newer trimesh, unique faces via boolean mask
        unique = mesh.unique_faces()
        if len(unique) < len(mesh.faces):
            mesh.update_faces(unique)
    return mesh


def remove_small_components(
    mesh: "trimesh.Trimesh", threshold: float = 0.01,
) -> "trimesh.Trimesh":
    """Keep only connected components with > threshold fraction of vertices."""
    import trimesh as tm

    components = mesh.split(only_watertight=False)
    if len(components) <= 1:
        return mesh
    total_verts = sum(c.vertices.shape[0] for c in components)
    min_verts = int(total_verts * threshold)
    kept = [c for c in components if c.vertices.shape[0] > min_verts]
    if not kept:
        return mesh
    combined = tm.util.concatenate(kept)
    logger.info(
        "Removed %d small components (kept %d)",
        len(components) - len(kept), len(kept),
    )
    return combined


def compute_vertex_curvature(mesh: "trimesh.Trimesh") -> np.ndarray:
    """Compute approximate mean curvature per vertex using discrete Laplacian."""
    try:
        from trimesh.curvature import discrete_mean_curvature_measure
        curvature = discrete_mean_curvature_measure(mesh, mesh.vertices, radius=1.0)
    except Exception:
        curvature = _fallback_curvature(mesh)
    return curvature.astype(np.float32)


def _fallback_curvature(mesh: "trimesh.Trimesh") -> np.ndarray:
    """Simple curvature fallback using vertex normal divergence."""
    normals = mesh.vertex_normals
    adjacency = mesh.vertex_neighbors
    curvature = np.zeros(len(mesh.vertices), dtype=np.float32)
    for i, neighbors in enumerate(adjacency):
        if len(neighbors) == 0:
            continue
        neighbor_normals = normals[neighbors]
        diff = np.linalg.norm(neighbor_normals - normals[i], axis=1)
        curvature[i] = np.mean(diff)
    return curvature


def barycentric_interpolate(
    mesh: "trimesh.Trimesh",
    face_indices: np.ndarray,
    barycentric_coords: np.ndarray,
    vertex_values: np.ndarray,
) -> np.ndarray:
    """Interpolate per-vertex values at sampled surface points."""
    faces = mesh.faces[face_indices]
    v0_vals = vertex_values[faces[:, 0]]
    v1_vals = vertex_values[faces[:, 1]]
    v2_vals = vertex_values[faces[:, 2]]
    w = barycentric_coords
    if v0_vals.ndim == 1:
        return w[:, 0] * v0_vals + w[:, 1] * v1_vals + w[:, 2] * v2_vals
    return (
        w[:, 0:1] * v0_vals + w[:, 1:2] * v1_vals + w[:, 2:3] * v2_vals
    )
