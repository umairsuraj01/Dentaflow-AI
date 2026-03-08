# visualization.py — Generate colored mesh for viewer from segmentation labels.

from __future__ import annotations

import logging
from typing import TYPE_CHECKING

import numpy as np

from ai.utils.fdi_numbering import class_to_fdi, get_tooth_color, fdi_to_class

if TYPE_CHECKING:
    import trimesh

logger = logging.getLogger(__name__)

RESTRICTED_COLOR = (255, 0, 0)


def map_labels_to_faces(
    mesh: "trimesh.Trimesh",
    sampled_points: np.ndarray,
    point_labels: np.ndarray,
    k: int = 3,
) -> np.ndarray:
    """Map per-point labels (N,) to per-face labels (F,) via KD-tree.

    For each mesh face, finds the k nearest sampled points and assigns
    the majority label. This maps 10k point labels to 100k+ face labels.
    """
    from scipy.spatial import cKDTree

    face_centroids = mesh.triangles_center  # (F, 3)
    tree = cKDTree(sampled_points[:, :3])
    _, nn_indices = tree.query(face_centroids, k=k)

    face_labels = np.zeros(len(mesh.faces), dtype=np.int64)
    for i in range(len(mesh.faces)):
        neighbor_labels = point_labels[nn_indices[i]]
        face_labels[i] = np.bincount(neighbor_labels).argmax()

    logger.info(
        "Mapped %d point labels to %d face labels (%d unique)",
        len(point_labels), len(face_labels), len(np.unique(face_labels)),
    )
    return face_labels


def generate_face_colors(
    face_labels: np.ndarray,
    restricted_fdi: list[int] | None = None,
) -> np.ndarray:
    """Generate RGBA face colors from per-face labels. Returns (F, 4) uint8."""
    restricted_fdi = restricted_fdi or []
    n_faces = len(face_labels)
    face_colors = np.zeros((n_faces, 4), dtype=np.uint8)

    for label_id in np.unique(face_labels):
        fdi = class_to_fdi(int(label_id))
        r, g, b = get_tooth_color(fdi)
        if fdi in restricted_fdi:
            r, g, b = _blend_restricted(r, g, b)
        mask = face_labels == label_id
        face_colors[mask] = [r, g, b, 255]

    return face_colors


def generate_colored_mesh(
    mesh: "trimesh.Trimesh",
    face_labels: np.ndarray,
    restricted_fdi: list[int] | None = None,
) -> "trimesh.Trimesh":
    """Color mesh faces based on per-face labels."""
    colored = mesh.copy()
    colored.visual.face_colors = generate_face_colors(face_labels, restricted_fdi)
    logger.info("Colored mesh with %d unique labels", len(np.unique(face_labels)))
    return colored


def export_colored_mesh(
    mesh: "trimesh.Trimesh",
    output_path: str,
    file_type: str = "ply",
) -> str:
    """Export colored mesh to PLY (preferred) or STL."""
    mesh.export(output_path, file_type=file_type)
    logger.info("Exported colored mesh to %s", output_path)
    return output_path


# Keep old name for backward compatibility
export_colored_stl = export_colored_mesh


def get_fdi_color_map() -> dict[int, list[int]]:
    """Return {fdi_number: [r, g, b]} for all teeth + background."""
    from ai.utils.fdi_numbering import FDI_ALL
    colors = {0: list(get_tooth_color(0))}
    for fdi in FDI_ALL:
        colors[fdi] = list(get_tooth_color(fdi))
    return colors


def _blend_restricted(r: int, g: int, b: int) -> tuple[int, int, int]:
    """Blend tooth color with red tint to indicate restriction."""
    return (
        min(255, int(r * 0.5 + RESTRICTED_COLOR[0] * 0.5)),
        min(255, int(g * 0.3 + RESTRICTED_COLOR[1] * 0.3)),
        min(255, int(b * 0.3 + RESTRICTED_COLOR[2] * 0.3)),
    )
