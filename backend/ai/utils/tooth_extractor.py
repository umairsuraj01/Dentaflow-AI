# tooth_extractor.py — Extract individual tooth meshes from a segmented arch.

from __future__ import annotations

import io
import logging
from dataclasses import dataclass
from typing import TYPE_CHECKING

import numpy as np

if TYPE_CHECKING:
    import trimesh

from ai.utils.fdi_numbering import class_to_fdi

logger = logging.getLogger(__name__)


@dataclass
class ToothMeshData:
    """Extracted mesh data for a single tooth (or gum)."""

    stl_bytes: bytes
    centroid: list[float]      # [x, y, z]
    bbox_min: list[float]      # [x, y, z]
    bbox_max: list[float]      # [x, y, z]


def extract_tooth_meshes(
    mesh: "trimesh.Trimesh",
    face_labels: np.ndarray,
) -> dict[int, ToothMeshData]:
    """Extract individual tooth meshes from a segmented full-arch STL.

    Parameters
    ----------
    mesh:
        The full-arch trimesh mesh.
    face_labels:
        Per-face array of class indices (0 = background/gum, 1-32 = teeth).
        Length must equal ``len(mesh.faces)``.

    Returns
    -------
    dict mapping FDI number (or 0 for gum) to :class:`ToothMeshData`.
    """
    if len(face_labels) != len(mesh.faces):
        raise ValueError(
            f"face_labels length ({len(face_labels)}) != "
            f"mesh face count ({len(mesh.faces)})"
        )

    results: dict[int, ToothMeshData] = {}
    unique_labels = np.unique(face_labels)

    for class_idx in unique_labels:
        class_idx = int(class_idx)

        # Convert class index to FDI number (0 stays 0 for gum)
        fdi = class_to_fdi(class_idx) if class_idx != 0 else 0

        # Get face indices for this label
        face_mask = face_labels == class_idx
        face_indices = np.where(face_mask)[0]

        if len(face_indices) == 0:
            continue

        try:
            submesh = _extract_submesh(mesh, face_indices)
            stl_bytes = _export_stl_bytes(submesh)
            centroid = submesh.centroid.tolist()
            bbox_min = submesh.bounds[0].tolist()
            bbox_max = submesh.bounds[1].tolist()

            results[fdi] = ToothMeshData(
                stl_bytes=stl_bytes,
                centroid=centroid,
                bbox_min=bbox_min,
                bbox_max=bbox_max,
            )

            label_name = f"FDI {fdi}" if fdi != 0 else "gum"
            logger.info(
                "Extracted %s: %d faces, centroid=%s",
                label_name, len(face_indices),
                [round(c, 2) for c in centroid],
            )
        except Exception as exc:
            label_name = f"FDI {fdi}" if fdi != 0 else "gum"
            logger.error("Failed to extract %s: %s", label_name, exc)

    logger.info(
        "Tooth extraction complete: %d segments (%d teeth + gum=%s)",
        len(results),
        len([k for k in results if k != 0]),
        "yes" if 0 in results else "no",
    )
    return results


def _extract_submesh(
    mesh: "trimesh.Trimesh",
    face_indices: np.ndarray,
) -> "trimesh.Trimesh":
    """Extract a submesh from the given face indices."""
    submesh = mesh.submesh([face_indices], append=True)
    return submesh


def _export_stl_bytes(submesh: "trimesh.Trimesh") -> bytes:
    """Export a trimesh mesh to binary STL bytes."""
    buffer = io.BytesIO()
    submesh.export(buffer, file_type="stl")
    return buffer.getvalue()
