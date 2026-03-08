# mesh_loader.py — Load STL/OBJ/PLY with trimesh.

from __future__ import annotations

import logging
from pathlib import Path

import trimesh

logger = logging.getLogger(__name__)

SUPPORTED_FORMATS = frozenset({"stl", "obj", "ply"})


def load_mesh(path: str) -> trimesh.Trimesh:
    """Load a mesh file and return a trimesh.Trimesh object."""
    p = Path(path)
    if not p.exists():
        raise FileNotFoundError(f"Mesh file not found: {path}")
    ext = p.suffix.lstrip(".").lower()
    if ext not in SUPPORTED_FORMATS:
        raise ValueError(f"Unsupported format: {ext}")
    mesh = trimesh.load(str(p), force="mesh")
    if not isinstance(mesh, trimesh.Trimesh):
        raise ValueError(f"Failed to load as single mesh: {path}")
    logger.info(
        "Loaded mesh: %s — %d vertices, %d faces",
        p.name, len(mesh.vertices), len(mesh.faces),
    )
    return mesh
