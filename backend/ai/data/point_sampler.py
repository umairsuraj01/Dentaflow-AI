# point_sampler.py — Uniform surface point sampling.

from __future__ import annotations

import logging
from typing import TYPE_CHECKING

import numpy as np

from app.constants import AI_POINT_CLOUD_SIZE

if TYPE_CHECKING:
    import trimesh

logger = logging.getLogger(__name__)


def sample_surface_points(
    mesh: "trimesh.Trimesh",
    n_points: int = AI_POINT_CLOUD_SIZE,
) -> tuple[np.ndarray, np.ndarray, np.ndarray]:
    """Sample n points uniformly from mesh surface.

    Returns (points, face_indices, barycentric_coords).
    """
    points, face_indices = mesh.sample(n_points, return_index=True)
    # Compute barycentric coordinates for the sampled points
    bary = _compute_barycentric(mesh, points, face_indices)
    logger.info("Sampled %d surface points", n_points)
    return points.astype(np.float32), face_indices, bary


def _compute_barycentric(
    mesh: "trimesh.Trimesh",
    points: np.ndarray,
    face_indices: np.ndarray,
) -> np.ndarray:
    """Compute barycentric coordinates for points on faces."""
    faces = mesh.faces[face_indices]
    v0 = mesh.vertices[faces[:, 0]]
    v1 = mesh.vertices[faces[:, 1]]
    v2 = mesh.vertices[faces[:, 2]]

    e0 = v1 - v0
    e1 = v2 - v0
    ep = points - v0

    d00 = np.sum(e0 * e0, axis=1)
    d01 = np.sum(e0 * e1, axis=1)
    d11 = np.sum(e1 * e1, axis=1)
    dp0 = np.sum(ep * e0, axis=1)
    dp1 = np.sum(ep * e1, axis=1)

    denom = d00 * d11 - d01 * d01
    denom = np.where(np.abs(denom) < 1e-10, 1e-10, denom)

    v = (d11 * dp0 - d01 * dp1) / denom
    w = (d00 * dp1 - d01 * dp0) / denom
    u = 1.0 - v - w

    bary = np.stack([u, v, w], axis=1).astype(np.float32)
    return bary
