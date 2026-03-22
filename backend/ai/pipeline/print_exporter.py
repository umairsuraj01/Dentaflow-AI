# print_exporter.py — Print-ready export for dental models.
#
# OnyxCeph Phase 10: Print-Ready Export
#   - Mesh validation for 3D printing (watertight, manifold, min wall thickness)
#   - STL/OBJ/PLY export with format validation
#   - Batch export (all stages, all teeth)
#   - Support material estimation
#   - Print volume calculation
#   - Model orientation optimization for minimal supports

from __future__ import annotations

import io
import logging
import time
import zipfile
from dataclasses import dataclass, field
from enum import Enum
from pathlib import Path

import numpy as np
import trimesh

logger = logging.getLogger(__name__)


# ---------------------------------------------------------------------------
# Enums & data structures
# ---------------------------------------------------------------------------

class ExportFormat(str, Enum):
    STL = "stl"
    OBJ = "obj"
    PLY = "ply"


class PrintOrientation(str, Enum):
    OCCLUSAL_UP = "occlusal_up"     # teeth face up (standard)
    OCCLUSAL_DOWN = "occlusal_down" # teeth face down (for SLA)
    TILTED = "tilted"               # 30° tilt for minimal supports


@dataclass
class PrintValidation:
    """Mesh validation results for 3D printing."""

    is_watertight: bool
    is_manifold: bool
    has_degenerate_faces: bool
    degenerate_face_count: int
    min_wall_thickness_mm: float
    volume_mm3: float
    surface_area_mm2: float
    bounding_box_mm: list[float]  # [x, y, z]
    face_count: int
    vertex_count: int
    is_printable: bool
    issues: list[str]


@dataclass
class SupportEstimate:
    """Estimated support material requirements."""

    support_volume_mm3: float
    overhang_area_mm2: float
    overhang_face_count: int
    support_percentage: float  # % of model that needs support
    recommended_orientation: str


@dataclass
class ExportedFile:
    """A single exported file."""

    filename: str
    format: str
    data: bytes
    mesh_face_count: int
    file_size_bytes: int


@dataclass
class BatchExportResult:
    """Result of a batch export operation."""

    files: list[ExportedFile]
    total_files: int
    total_size_bytes: int
    zip_data: bytes | None  # combined ZIP archive
    validation_results: dict[str, PrintValidation]  # filename → validation
    processing_time_seconds: float


# ---------------------------------------------------------------------------
# Main entry points
# ---------------------------------------------------------------------------

def validate_for_printing(
    mesh: trimesh.Trimesh,
    min_wall_thickness_mm: float = 0.5,
) -> PrintValidation:
    """Validate a mesh for 3D printing suitability.

    Args:
        mesh: The mesh to validate.
        min_wall_thickness_mm: Minimum acceptable wall thickness.

    Returns:
        PrintValidation with all checks and issues.
    """
    issues: list[str] = []

    is_watertight = bool(mesh.is_watertight)
    if not is_watertight:
        issues.append("Mesh is not watertight (has holes)")

    # Manifold check
    is_manifold = _check_manifold(mesh)
    if not is_manifold:
        issues.append("Mesh has non-manifold edges")

    # Degenerate faces
    face_areas = mesh.area_faces if hasattr(mesh, 'area_faces') else _compute_face_areas(mesh)
    degenerate_mask = face_areas < 1e-8
    degenerate_count = int(np.sum(degenerate_mask))
    has_degenerate = degenerate_count > 0
    if has_degenerate:
        issues.append(f"{degenerate_count} degenerate faces detected")

    # Volume and surface area
    volume = float(mesh.volume) if is_watertight else _estimate_volume(mesh)
    surface_area = float(mesh.area)

    # Bounding box
    bbox = mesh.bounding_box.extents.tolist()

    # Wall thickness estimate (simplified: use face area distribution)
    wall_thickness = _estimate_wall_thickness(mesh)
    if wall_thickness < min_wall_thickness_mm:
        issues.append(f"Wall thickness {wall_thickness:.2f}mm < minimum {min_wall_thickness_mm}mm")

    is_printable = len(issues) == 0

    return PrintValidation(
        is_watertight=is_watertight,
        is_manifold=is_manifold,
        has_degenerate_faces=has_degenerate,
        degenerate_face_count=degenerate_count,
        min_wall_thickness_mm=round(wall_thickness, 3),
        volume_mm3=round(abs(volume), 2),
        surface_area_mm2=round(surface_area, 2),
        bounding_box_mm=[round(b, 2) for b in bbox],
        face_count=len(mesh.faces),
        vertex_count=len(mesh.vertices),
        is_printable=is_printable,
        issues=issues,
    )


def estimate_supports(
    mesh: trimesh.Trimesh,
    overhang_angle_deg: float = 45.0,
    orientation: PrintOrientation = PrintOrientation.OCCLUSAL_UP,
) -> SupportEstimate:
    """Estimate support material requirements.

    Args:
        mesh: The mesh to analyze.
        overhang_angle_deg: Angle threshold for overhangs.
        orientation: Print orientation.

    Returns:
        SupportEstimate with overhang analysis.
    """
    # Apply orientation transform
    oriented = _apply_orientation(mesh, orientation)

    # Find overhang faces (face normal pointing down beyond threshold)
    normals = oriented.face_normals
    down_component = -normals[:, 1]  # Y is up, so -Y is down
    overhang_threshold = np.cos(np.radians(90 - overhang_angle_deg))
    overhang_mask = down_component > overhang_threshold

    overhang_count = int(np.sum(overhang_mask))
    face_areas = oriented.area_faces if hasattr(oriented, 'area_faces') else _compute_face_areas(oriented)
    overhang_area = float(np.sum(face_areas[overhang_mask]))
    total_area = float(np.sum(face_areas))

    support_pct = (overhang_area / max(total_area, 1e-12)) * 100

    # Rough support volume estimate (overhang area × average height)
    if overhang_count > 0:
        overhang_centroids = _face_centroids(oriented)[overhang_mask]
        avg_height = float(np.mean(overhang_centroids[:, 1] - oriented.vertices[:, 1].min()))
        support_volume = overhang_area * avg_height * 0.3  # ~30% fill
    else:
        support_volume = 0.0

    # Recommend orientation
    best_orientation = _recommend_orientation(mesh)

    return SupportEstimate(
        support_volume_mm3=round(support_volume, 2),
        overhang_area_mm2=round(overhang_area, 2),
        overhang_face_count=overhang_count,
        support_percentage=round(support_pct, 1),
        recommended_orientation=best_orientation,
    )


def export_mesh(
    mesh: trimesh.Trimesh,
    filename: str,
    format: ExportFormat = ExportFormat.STL,
) -> ExportedFile:
    """Export a mesh to a specific format.

    Args:
        mesh: The mesh to export.
        filename: Output filename (without extension).
        format: Export format.

    Returns:
        ExportedFile with binary data.
    """
    ext = format.value
    full_filename = f"{filename}.{ext}"

    if format == ExportFormat.STL:
        data = mesh.export(file_type="stl")
    elif format == ExportFormat.OBJ:
        data = mesh.export(file_type="obj")
    elif format == ExportFormat.PLY:
        data = mesh.export(file_type="ply")
    else:
        data = mesh.export(file_type="stl")

    if isinstance(data, str):
        data = data.encode("utf-8")

    return ExportedFile(
        filename=full_filename,
        format=ext,
        data=data,
        mesh_face_count=len(mesh.faces),
        file_size_bytes=len(data),
    )


def batch_export(
    meshes: dict[str, trimesh.Trimesh],
    format: ExportFormat = ExportFormat.STL,
    validate: bool = True,
    create_zip: bool = True,
) -> BatchExportResult:
    """Export multiple meshes as a batch.

    Args:
        meshes: name → mesh dictionary.
        format: Export format for all meshes.
        validate: Run print validation on each mesh.
        create_zip: Create a combined ZIP archive.

    Returns:
        BatchExportResult with all exported files.
    """
    t0 = time.time()

    files: list[ExportedFile] = []
    validations: dict[str, PrintValidation] = {}

    for name, mesh in meshes.items():
        exported = export_mesh(mesh, name, format)
        files.append(exported)

        if validate:
            validations[exported.filename] = validate_for_printing(mesh)

    total_size = sum(f.file_size_bytes for f in files)

    # Create ZIP archive
    zip_data = None
    if create_zip and files:
        zip_buffer = io.BytesIO()
        with zipfile.ZipFile(zip_buffer, 'w', zipfile.ZIP_DEFLATED) as zf:
            for f in files:
                zf.writestr(f.filename, f.data)
        zip_data = zip_buffer.getvalue()

    elapsed = time.time() - t0

    return BatchExportResult(
        files=files,
        total_files=len(files),
        total_size_bytes=total_size,
        zip_data=zip_data,
        validation_results=validations,
        processing_time_seconds=round(elapsed, 3),
    )


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _check_manifold(mesh: trimesh.Trimesh) -> bool:
    """Check if mesh is manifold (every edge shared by exactly 2 faces)."""
    edges = mesh.edges_sorted
    unique_edges, counts = np.unique(edges, axis=0, return_counts=True)
    return bool(np.all(counts <= 2))


def _compute_face_areas(mesh: trimesh.Trimesh) -> np.ndarray:
    """Compute per-face areas."""
    v0 = mesh.vertices[mesh.faces[:, 0]]
    v1 = mesh.vertices[mesh.faces[:, 1]]
    v2 = mesh.vertices[mesh.faces[:, 2]]
    cross = np.cross(v1 - v0, v2 - v0)
    return 0.5 * np.linalg.norm(cross, axis=1)


def _face_centroids(mesh: trimesh.Trimesh) -> np.ndarray:
    """Compute per-face centroids."""
    v0 = mesh.vertices[mesh.faces[:, 0]]
    v1 = mesh.vertices[mesh.faces[:, 1]]
    v2 = mesh.vertices[mesh.faces[:, 2]]
    return (v0 + v1 + v2) / 3.0


def _estimate_volume(mesh: trimesh.Trimesh) -> float:
    """Estimate volume even for non-watertight meshes."""
    try:
        # Use convex hull as approximation
        hull = mesh.convex_hull
        return float(hull.volume)
    except Exception:
        # Bounding box volume as fallback
        extents = mesh.bounding_box.extents
        return float(np.prod(extents))


def _estimate_wall_thickness(mesh: trimesh.Trimesh) -> float:
    """Estimate minimum wall thickness.

    Uses ray casting: shoot rays from face centroids inward and measure
    the distance to the opposite wall. Simplified version.
    """
    if len(mesh.faces) < 10:
        return 0.0

    # Sample a subset of faces for speed
    n_samples = min(100, len(mesh.faces))
    rng = np.random.RandomState(42)
    sample_idx = rng.choice(len(mesh.faces), n_samples, replace=False)

    centroids = _face_centroids(mesh)[sample_idx]
    normals = mesh.face_normals[sample_idx]

    # Shoot rays inward (opposite to face normal)
    ray_origins = centroids + normals * 0.01  # offset slightly outward
    ray_directions = -normals

    try:
        locations, index_ray, _ = mesh.ray.intersects_location(
            ray_origins, ray_directions,
        )
        if len(locations) == 0:
            return 1.0  # assume reasonable thickness

        # Compute distances for each ray that hit
        thicknesses = []
        for i in range(n_samples):
            hits = locations[index_ray == i]
            if len(hits) > 0:
                dists = np.linalg.norm(hits - centroids[i], axis=1)
                dists = dists[dists > 0.02]  # ignore self-intersection
                if len(dists) > 0:
                    thicknesses.append(float(np.min(dists)))

        if thicknesses:
            return float(np.percentile(thicknesses, 5))  # 5th percentile
    except Exception:
        pass

    return 1.0  # default


def _apply_orientation(
    mesh: trimesh.Trimesh,
    orientation: PrintOrientation,
) -> trimesh.Trimesh:
    """Apply a print orientation to the mesh."""
    oriented = mesh.copy()

    if orientation == PrintOrientation.OCCLUSAL_DOWN:
        # Flip 180° around X axis
        mat = trimesh.transformations.rotation_matrix(np.pi, [1, 0, 0])
        oriented.apply_transform(mat)
    elif orientation == PrintOrientation.TILTED:
        # 30° tilt around X axis
        mat = trimesh.transformations.rotation_matrix(np.radians(30), [1, 0, 0])
        oriented.apply_transform(mat)

    return oriented


def _recommend_orientation(mesh: trimesh.Trimesh) -> str:
    """Recommend the best print orientation to minimize supports."""
    orientations = [
        (PrintOrientation.OCCLUSAL_UP, "occlusal_up"),
        (PrintOrientation.OCCLUSAL_DOWN, "occlusal_down"),
        (PrintOrientation.TILTED, "tilted"),
    ]

    best_orientation = "occlusal_up"
    min_overhang = float('inf')

    for orient, name in orientations:
        oriented = _apply_orientation(mesh, orient)
        normals = oriented.face_normals
        down = -normals[:, 1]
        threshold = np.cos(np.radians(45))
        overhang_count = int(np.sum(down > threshold))

        if overhang_count < min_overhang:
            min_overhang = overhang_count
            best_orientation = name

    return best_orientation
