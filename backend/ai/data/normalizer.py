# normalizer.py — Center + scale mesh to unit sphere.

from __future__ import annotations

import logging
from typing import TYPE_CHECKING

import numpy as np

if TYPE_CHECKING:
    import trimesh

logger = logging.getLogger(__name__)


def center_mesh(mesh: "trimesh.Trimesh") -> "trimesh.Trimesh":
    """Subtract centroid so mesh is centered at origin."""
    mesh.vertices -= mesh.centroid
    logger.debug("Centered mesh at origin")
    return mesh


def scale_to_unit_sphere(mesh: "trimesh.Trimesh") -> "trimesh.Trimesh":
    """Scale mesh so it fits within a unit sphere."""
    bounds = mesh.bounding_box.extents
    diagonal = float(np.linalg.norm(bounds))
    if diagonal > 0:
        mesh.vertices /= diagonal
    logger.debug("Scaled mesh to unit sphere (diagonal=%.4f)", diagonal)
    return mesh


def normalize_mesh(mesh: "trimesh.Trimesh") -> "trimesh.Trimesh":
    """Center and scale mesh in one call."""
    center_mesh(mesh)
    scale_to_unit_sphere(mesh)
    return mesh
