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
    jaw: str = "upper",
) -> dict[int, ToothMeshData]:
    """Extract individual tooth meshes from a segmented full-arch STL.

    Parameters
    ----------
    mesh:
        The full-arch trimesh mesh.
    face_labels:
        Per-face array of class indices (0 = gum, 1-14 = teeth).
        Length must equal ``len(mesh.faces)``.
    jaw:
        "upper" or "lower" — needed for correct FDI numbering.

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

    # --- Gum: extract ONLY gum-labeled faces + a border ring around each tooth.
    # The border ring extends slightly under the teeth to prevent visible gaps
    # at the tooth-gum boundary, while avoiding full-mesh z-fighting.
    try:
        import trimesh as _trimesh

        gum_face_indices = np.where(face_labels == 0)[0]
        gum = _create_gum_with_border(mesh, face_labels, gum_face_indices, border_rings=2)
        center = gum.centroid.copy()
        stl_bytes = _export_stl_bytes(gum)
        results[0] = ToothMeshData(
            stl_bytes=stl_bytes,
            centroid=center.tolist(),
            bbox_min=gum.bounds[0].tolist(),
            bbox_max=gum.bounds[1].tolist(),
        )
        logger.info(
            "Gum: %d faces (gum=%d + border), no tooth overlap",
            len(gum.faces), len(gum_face_indices),
        )
    except Exception as exc:
        logger.error("Failed to create gum mesh: %s", exc)

    # --- Teeth: extract individual submeshes per tooth label
    for class_idx in unique_labels:
        class_idx = int(class_idx)
        if class_idx == 0:
            continue  # gum already handled above

        fdi = class_to_fdi(class_idx, jaw=jaw)
        face_mask = face_labels == class_idx
        face_indices = np.where(face_mask)[0]

        if len(face_indices) == 0:
            continue

        try:
            submesh = _extract_submesh(mesh, face_indices, smooth=True, smooth_iterations=10)
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
                label_name, len(submesh.faces),
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



def _erode_tooth_boundary(
    face_indices: np.ndarray,
    face_labels: np.ndarray,
    face_neighbors: list[list[int]],
    erosion_rings: int = 2,
) -> np.ndarray:
    """Remove faces at TOOTH-TOOTH boundaries only (not tooth-gum).

    Cross-selection artifacts happen when two teeth share misclassified
    faces at their mutual boundary. We only erode faces that touch a
    DIFFERENT tooth label (not gum=0). Tooth-gum boundary faces are
    kept intact to avoid hollow/gap appearance.

    Args:
        face_indices: Indices of faces belonging to this tooth.
        face_labels: Per-face labels for the full mesh.
        face_neighbors: Adjacency list for the full mesh.
        erosion_rings: Number of boundary rings to remove at tooth-tooth borders.

    Returns:
        Eroded face indices (subset of input).
    """
    remaining = set(face_indices.tolist())
    my_label = int(face_labels[face_indices[0]])

    # Skip erosion for small tooth regions (test meshes, tiny teeth)
    if len(remaining) < 50:
        return face_indices

    for ring in range(erosion_rings):
        to_remove = set()
        for fi in remaining:
            for nb in face_neighbors[fi]:
                nb_label = int(face_labels[nb])
                # Only erode if neighbor is a DIFFERENT TOOTH (not gum)
                if nb_label != my_label and nb_label != 0 and nb not in remaining:
                    to_remove.add(fi)
                    break

        if not to_remove:
            break

        # Don't erode more than 20% of remaining faces per ring
        if len(to_remove) > len(remaining) * 0.2:
            break

        remaining -= to_remove

    result = np.array(sorted(remaining), dtype=np.int64)
    eroded_count = len(face_indices) - len(result)
    if eroded_count > 0:
        logger.debug(
            "Tooth class %d: eroded %d tooth-tooth boundary faces (%d remaining)",
            my_label, eroded_count, len(result),
        )
    return result


def _create_gum_with_border(
    mesh: "trimesh.Trimesh",
    face_labels: np.ndarray,
    gum_face_indices: np.ndarray,
    border_rings: int = 2,
) -> "trimesh.Trimesh":
    """Create gum mesh from gum faces + a border ring that extends under teeth.

    The border ring includes tooth-labeled faces that are adjacent to gum faces.
    This creates a slight overlap under the teeth edges, preventing visible gaps
    at the tooth-gum boundary without causing full-mesh z-fighting.

    Args:
        mesh: Full arch trimesh mesh.
        face_labels: Per-face labels (0=gum, 1-14=teeth).
        gum_face_indices: Indices of gum-labeled faces.
        border_rings: Number of neighbor rings to include from tooth faces.
    """
    import trimesh

    faces = np.asarray(mesh.faces)
    n_faces = len(faces)

    # Build face adjacency
    edge_to_faces: dict[tuple[int, int], list[int]] = {}
    for fi in range(n_faces):
        face = faces[fi]
        for i in range(3):
            v0, v1 = int(face[i]), int(face[(i + 1) % 3])
            e = (min(v0, v1), max(v0, v1))
            edge_to_faces.setdefault(e, []).append(fi)

    face_neighbors: list[list[int]] = [[] for _ in range(n_faces)]
    for faces_sharing in edge_to_faces.values():
        if len(faces_sharing) == 2:
            f0, f1 = faces_sharing
            face_neighbors[f0].append(f1)
            face_neighbors[f1].append(f0)

    # Start with gum faces, expand into tooth faces by border_rings
    included = set(gum_face_indices.tolist())
    frontier = set()

    # Find initial frontier: gum faces adjacent to tooth faces
    for fi in gum_face_indices:
        fi = int(fi)
        for nb in face_neighbors[fi]:
            if face_labels[nb] != 0 and nb not in included:
                frontier.add(nb)

    # Expand border rings
    for ring in range(border_rings):
        included.update(frontier)
        next_frontier = set()
        for fi in frontier:
            for nb in face_neighbors[fi]:
                if nb not in included and face_labels[nb] != 0:
                    next_frontier.add(nb)
        frontier = next_frontier

    included.update(frontier)
    all_indices = np.array(sorted(included), dtype=np.int64)

    logger.info(
        "Gum border: %d gum faces + %d border faces = %d total",
        len(gum_face_indices), len(all_indices) - len(gum_face_indices), len(all_indices),
    )

    # Extract submesh and apply light smoothing to boundary vertices
    gum = mesh.submesh([all_indices], append=True)

    # Light Taubin smoothing on boundary to soften the cut edge
    try:
        gum = _smooth_boundary(gum, iterations=6, factor=0.3)
    except Exception as exc:
        logger.debug("Gum boundary smoothing skipped: %s", exc)

    return gum


def _create_smooth_gum(
    mesh: "trimesh.Trimesh",
    gum_face_indices: np.ndarray,
) -> "trimesh.Trimesh":
    """Create a smooth gum mesh from gum-labeled faces only.

    Extracts gum faces, applies heavy Laplacian smoothing to remove
    scan noise and jagged boundaries, then rescales to original size.
    """
    import trimesh
    import trimesh.smoothing

    # Extract only gum faces as a submesh
    gum = mesh.submesh([gum_face_indices], append=True)

    # Save original bounds for rescaling after shrinkage
    orig_center = gum.centroid.copy()
    orig_size = (gum.bounds[1] - gum.bounds[0]).copy()

    # Heavy Laplacian smoothing: removes surface noise and smooths boundaries
    trimesh.smoothing.filter_laplacian(gum, lamb=0.5, iterations=30)

    # Rescale to compensate for Laplacian shrinkage
    smooth_center = gum.centroid.copy()
    smooth_size = gum.bounds[1] - gum.bounds[0]
    scale = np.ones(3)
    for i in range(3):
        if smooth_size[i] > 1e-6:
            scale[i] = orig_size[i] / smooth_size[i]
    gum.vertices -= smooth_center
    gum.vertices *= scale
    gum.vertices += orig_center

    logger.info(
        "Gum smoothing: %d faces, %d iterations",
        len(gum.faces), 30,
    )
    return gum


def _extract_submesh(
    mesh: "trimesh.Trimesh",
    face_indices: np.ndarray,
    smooth: bool = True,
    smooth_iterations: int = 10,
) -> "trimesh.Trimesh":
    """Extract a submesh from the given face indices, with boundary smoothing."""
    submesh = mesh.submesh([face_indices], append=True)

    # Smooth boundary vertices to reduce jagged edges from segmentation cuts
    if smooth:
        try:
            submesh = _smooth_boundary(submesh, iterations=smooth_iterations, factor=0.4)
        except Exception as exc:
            logger.debug("Boundary smoothing skipped: %s", exc)

    return submesh


def _smooth_boundary(
    submesh: "trimesh.Trimesh",
    iterations: int = 6,
    factor: float = 0.4,
) -> "trimesh.Trimesh":
    """Taubin-style smooth on boundary vertices + their 1-ring neighbors.

    Uses alternating positive/negative factors to prevent mesh shrinkage
    while smoothing the jagged segmentation-cut edges.
    """
    import trimesh

    # Find boundary edges (edges that belong to only one face)
    edges = submesh.edges_unique
    edge_face_count = np.zeros(len(edges), dtype=int)
    face_edges = submesh.faces_unique_edges
    for fe in face_edges:
        edge_face_count[fe] += 1
    boundary_edge_mask = edge_face_count == 1
    boundary_edges = edges[boundary_edge_mask]

    if len(boundary_edges) == 0:
        return submesh

    # Get boundary vertices AND their 1-ring neighbors for smoother transition
    boundary_verts_set = set(boundary_edges.ravel().tolist())

    # Build full vertex adjacency from all edges
    all_edges = submesh.edges_unique
    adj: dict[int, list[int]] = {}
    for e in all_edges:
        adj.setdefault(int(e[0]), []).append(int(e[1]))
        adj.setdefault(int(e[1]), []).append(int(e[0]))

    # Expand to include 2-ring neighbors of boundary verts for wider smooth zone
    ring1 = set(boundary_verts_set)
    for bv in boundary_verts_set:
        for nb in adj.get(bv, []):
            ring1.add(nb)
    smooth_verts_set = set(ring1)
    for v in ring1:
        for nb in adj.get(v, []):
            smooth_verts_set.add(nb)

    smooth_verts = np.array(sorted(smooth_verts_set), dtype=int)

    if len(smooth_verts) == 0:
        return submesh

    verts = submesh.vertices.copy()

    # Taubin smoothing: alternate positive (shrink) and negative (inflate) steps
    mu = -(factor + 0.1)  # inflation factor slightly stronger to prevent shrinkage

    for it in range(iterations):
        new_verts = verts.copy()
        current_factor = factor if (it % 2 == 0) else mu

        for vi in smooth_verts:
            neighbors = adj.get(vi, [])
            if len(neighbors) == 0:
                continue
            avg = verts[neighbors].mean(axis=0)
            new_verts[vi] = verts[vi] + current_factor * (avg - verts[vi])
        verts = new_verts

    result = trimesh.Trimesh(vertices=verts, faces=submesh.faces, process=False)
    return result


def _export_stl_bytes(submesh: "trimesh.Trimesh") -> bytes:
    """Export a trimesh mesh to binary STL bytes."""
    buffer = io.BytesIO()
    submesh.export(buffer, file_type="stl")
    return buffer.getvalue()
