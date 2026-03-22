# base_generator.py — Model base generation for dental casts.
#
# OnyxCeph Phase 6: Model Base Generation
#   - Auto-base sizing from arch dimensions
#   - Horseshoe / rectangular / rounded base shapes
#   - Soft tissue margin calculation
#   - Base mesh generation with configurable thickness
#   - Registration marks and label area
#   - Articulator mounting surface (flat bottom)

from __future__ import annotations

import logging
import time
from dataclasses import dataclass, field
from enum import Enum

import numpy as np
import trimesh

logger = logging.getLogger(__name__)


# ---------------------------------------------------------------------------
# Enums & data structures
# ---------------------------------------------------------------------------

class BaseShape(str, Enum):
    HORSESHOE = "horseshoe"
    RECTANGULAR = "rectangular"
    ROUNDED = "rounded"


@dataclass
class BaseParameters:
    """Parameters for base generation."""

    shape: BaseShape = BaseShape.HORSESHOE
    thickness_mm: float = 5.0       # base plate thickness
    margin_mm: float = 3.0          # margin around arch boundary
    height_mm: float = 15.0         # total height from base bottom to trim plane
    flat_bottom: bool = True        # articulator mounting surface
    add_label_area: bool = True     # flat area for patient label
    label_width_mm: float = 15.0
    label_depth_mm: float = 8.0


@dataclass
class BaseGenerationResult:
    """Output of the base generation pipeline."""

    base_mesh: trimesh.Trimesh
    combined_mesh: trimesh.Trimesh  # cast + base merged
    base_stl_bytes: bytes
    combined_stl_bytes: bytes
    base_shape: str
    arch_width_mm: float
    arch_depth_mm: float
    base_width_mm: float
    base_depth_mm: float
    base_height_mm: float
    processing_time_seconds: float
    jaw: str


# ---------------------------------------------------------------------------
# Main entry point
# ---------------------------------------------------------------------------

def generate_base(
    cast_mesh: trimesh.Trimesh,
    jaw: str = "upper",
    params: BaseParameters | None = None,
) -> BaseGenerationResult:
    """Generate a model base for a dental cast.

    Args:
        cast_mesh: The trimmed dental cast mesh.
        jaw: "upper" or "lower".
        params: Base generation parameters. Uses defaults if None.

    Returns:
        BaseGenerationResult with base mesh, combined mesh, and metadata.
    """
    t0 = time.time()

    if params is None:
        params = BaseParameters()

    # Step 1: Compute arch dimensions
    arch_width, arch_depth, arch_center = _compute_arch_dimensions(cast_mesh)

    # Step 2: Determine base dimensions
    base_width = arch_width + 2 * params.margin_mm
    base_depth = arch_depth + 2 * params.margin_mm

    # Step 3: Determine base vertical extent
    if jaw == "upper":
        # Upper: base extends above the cast (root side)
        cast_max_y = float(np.max(cast_mesh.vertices[:, 1]))
        base_top_y = cast_max_y
        base_bottom_y = base_top_y - params.height_mm
    else:
        # Lower: base extends below the cast (root side)
        cast_min_y = float(np.min(cast_mesh.vertices[:, 1]))
        base_bottom_y = cast_min_y
        base_top_y = base_bottom_y + params.height_mm

    # Step 4: Generate base mesh
    if params.shape == BaseShape.HORSESHOE:
        base = _generate_horseshoe_base(
            arch_center, base_width, base_depth,
            base_bottom_y, base_top_y, params,
        )
    elif params.shape == BaseShape.ROUNDED:
        base = _generate_rounded_base(
            arch_center, base_width, base_depth,
            base_bottom_y, base_top_y, params,
        )
    else:
        base = _generate_rectangular_base(
            arch_center, base_width, base_depth,
            base_bottom_y, base_top_y, params,
        )

    # Step 5: Add label area
    if params.add_label_area:
        base = _add_label_area(
            base, arch_center, jaw,
            params.label_width_mm, params.label_depth_mm,
            base_bottom_y, base_top_y,
        )

    # Step 6: Combine cast + base
    combined = trimesh.util.concatenate([cast_mesh, base])

    # Export
    base_stl = base.export(file_type="stl")
    combined_stl = combined.export(file_type="stl")

    elapsed = time.time() - t0

    logger.info(
        "Base generated: %s shape, %.1fx%.1fmm, %.2fs",
        params.shape.value, base_width, base_depth, elapsed,
    )

    return BaseGenerationResult(
        base_mesh=base,
        combined_mesh=combined,
        base_stl_bytes=base_stl,
        combined_stl_bytes=combined_stl,
        base_shape=params.shape.value,
        arch_width_mm=round(arch_width, 2),
        arch_depth_mm=round(arch_depth, 2),
        base_width_mm=round(base_width, 2),
        base_depth_mm=round(base_depth, 2),
        base_height_mm=params.height_mm,
        processing_time_seconds=round(elapsed, 3),
        jaw=jaw,
    )


# ---------------------------------------------------------------------------
# Arch dimension computation
# ---------------------------------------------------------------------------

def _compute_arch_dimensions(
    mesh: trimesh.Trimesh,
) -> tuple[float, float, np.ndarray]:
    """Compute arch width, depth, and center from mesh bounding box.

    Returns: (width_mm, depth_mm, center_xz [x, y, z])
    """
    bbox_min = mesh.vertices.min(axis=0)
    bbox_max = mesh.vertices.max(axis=0)
    center = (bbox_min + bbox_max) / 2.0

    width = float(bbox_max[0] - bbox_min[0])  # X extent
    depth = float(bbox_max[2] - bbox_min[2])  # Z extent

    return width, depth, center


# ---------------------------------------------------------------------------
# Base shape generators
# ---------------------------------------------------------------------------

def _generate_horseshoe_base(
    center: np.ndarray,
    width: float,
    depth: float,
    bottom_y: float,
    top_y: float,
    params: BaseParameters,
) -> trimesh.Trimesh:
    """Generate a horseshoe-shaped base (standard dental model base).

    The horseshoe follows the arch form with an open posterior.
    """
    # Create a horseshoe profile in XZ plane
    n_points = 40
    profile = _horseshoe_profile(width / 2, depth, n_points)

    # Offset to center
    profile[:, 0] += center[0]
    profile[:, 1] += center[2]

    # Extrude into a 3D base
    vertices = []
    faces = []
    n = len(profile)

    # Bottom ring
    for p in profile:
        vertices.append([p[0], bottom_y, p[1]])
    # Top ring
    for p in profile:
        vertices.append([p[0], top_y, p[1]])

    # Side faces connecting bottom and top rings
    for i in range(n - 1):
        # Triangle 1
        faces.append([i, i + 1, i + n])
        # Triangle 2
        faces.append([i + 1, i + n + 1, i + n])

    # Close the shape
    faces.append([n - 1, 0, n - 1 + n])
    faces.append([0, n, n - 1 + n])

    # Cap faces (bottom and top) using fan triangulation
    bottom_center_idx = len(vertices)
    vertices.append([center[0], bottom_y, center[2]])
    for i in range(n - 1):
        faces.append([bottom_center_idx, i + 1, i])

    top_center_idx = len(vertices)
    vertices.append([center[0], top_y, center[2]])
    for i in range(n - 1):
        faces.append([top_center_idx, i + n, i + n + 1])

    mesh = trimesh.Trimesh(
        vertices=np.array(vertices),
        faces=np.array(faces),
        process=True,
    )
    return mesh


def _generate_rectangular_base(
    center: np.ndarray,
    width: float,
    depth: float,
    bottom_y: float,
    top_y: float,
    params: BaseParameters,
) -> trimesh.Trimesh:
    """Generate a rectangular base plate."""
    hw = width / 2
    hd = depth / 2
    cx, cz = center[0], center[2]

    base = trimesh.creation.box(
        extents=[width, top_y - bottom_y, depth],
        transform=trimesh.transformations.translation_matrix([
            cx, (bottom_y + top_y) / 2, cz,
        ]),
    )
    return base


def _generate_rounded_base(
    center: np.ndarray,
    width: float,
    depth: float,
    bottom_y: float,
    top_y: float,
    params: BaseParameters,
) -> trimesh.Trimesh:
    """Generate a rounded (elliptical) base plate."""
    # Create elliptical profile
    n_points = 40
    angles = np.linspace(0, 2 * np.pi, n_points, endpoint=False)
    rx = width / 2
    rz = depth / 2

    profile = np.column_stack([
        rx * np.cos(angles),
        rz * np.sin(angles),
    ])

    profile[:, 0] += center[0]
    profile[:, 1] += center[2]

    # Extrude
    vertices = []
    faces = []
    n = len(profile)

    for p in profile:
        vertices.append([p[0], bottom_y, p[1]])
    for p in profile:
        vertices.append([p[0], top_y, p[1]])

    for i in range(n):
        next_i = (i + 1) % n
        faces.append([i, next_i, i + n])
        faces.append([next_i, next_i + n, i + n])

    # Bottom cap
    bc = len(vertices)
    vertices.append([center[0], bottom_y, center[2]])
    for i in range(n):
        faces.append([bc, (i + 1) % n, i])

    # Top cap
    tc = len(vertices)
    vertices.append([center[0], top_y, center[2]])
    for i in range(n):
        faces.append([tc, i + n, (i + 1) % n + n])

    mesh = trimesh.Trimesh(
        vertices=np.array(vertices),
        faces=np.array(faces),
        process=True,
    )
    return mesh


# ---------------------------------------------------------------------------
# Horseshoe profile
# ---------------------------------------------------------------------------

def _horseshoe_profile(
    half_width: float,
    depth: float,
    n_points: int = 40,
) -> np.ndarray:
    """Generate a 2D horseshoe profile in XZ coordinates.

    Returns: (N, 2) array of [x, z] points.
    """
    # Front arc (semicircle)
    n_arc = n_points // 2
    angles = np.linspace(-np.pi / 2, np.pi / 2, n_arc)
    arc_x = half_width * np.cos(angles)
    arc_z = -half_width * np.sin(angles)  # front = negative Z

    # Side extensions (straight portions going posterior)
    n_side = (n_points - n_arc) // 2
    right_x = np.full(n_side, half_width)
    right_z = np.linspace(0, depth / 2, n_side)

    left_x = np.full(n_side, -half_width)
    left_z = np.linspace(0, depth / 2, n_side)[::-1]

    # Combine: left side → front arc → right side
    x = np.concatenate([left_x[::-1], arc_x, right_x])
    z = np.concatenate([left_z[::-1], arc_z, right_z])

    return np.column_stack([x, z])


# ---------------------------------------------------------------------------
# Label area
# ---------------------------------------------------------------------------

def _add_label_area(
    base: trimesh.Trimesh,
    center: np.ndarray,
    jaw: str,
    label_width: float,
    label_depth: float,
    bottom_y: float,
    top_y: float,
) -> trimesh.Trimesh:
    """Add a flat label area on the posterior of the base.

    This is a small raised platform for patient identification labels.
    """
    # Position label on the posterior side
    label_z = center[2] + 5.0  # slightly posterior

    if jaw == "upper":
        label_y = top_y + 0.5  # slightly above base top
    else:
        label_y = bottom_y - 0.5  # slightly below base bottom

    label_box = trimesh.creation.box(
        extents=[label_width, 1.0, label_depth],
        transform=trimesh.transformations.translation_matrix([
            center[0], label_y, label_z,
        ]),
    )

    return trimesh.util.concatenate([base, label_box])


# ---------------------------------------------------------------------------
# Utility: compute soft tissue margin
# ---------------------------------------------------------------------------

def compute_soft_tissue_margin(
    cast_mesh: trimesh.Trimesh,
    face_labels: np.ndarray,
    margin_mm: float = 2.0,
) -> np.ndarray:
    """Compute the soft tissue margin around teeth.

    Returns an (N, 3) array of margin points offset from the gum-tooth boundary.
    Useful for determining where the base should meet the tissue.
    """
    from ai.pipeline.cast_trimmer import _detect_arch_boundary

    boundary_idx = _detect_arch_boundary(cast_mesh, face_labels)
    if len(boundary_idx) == 0:
        return np.empty((0, 3))

    boundary_pts = cast_mesh.vertices[boundary_idx]

    # Offset outward from arch center
    center = boundary_pts.mean(axis=0)
    directions = boundary_pts - center
    directions[:, 1] = 0  # only offset in XZ plane
    norms = np.linalg.norm(directions, axis=1, keepdims=True)
    norms = np.maximum(norms, 1e-12)
    unit_dirs = directions / norms

    margin_pts = boundary_pts + unit_dirs * margin_mm
    return margin_pts
