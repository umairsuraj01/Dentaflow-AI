# center_point_detector.py — Tooth center point detection from segmentation.
#
# OnyxCeph Phase 4A: Tooth Center Points
#   - 3D centroid detection from segmented face labels
#   - 32 FDI coordinate output with confidence scores
#   - Overbite classification (normal/deep/open/crossbite)
#   - Missing tooth detection (gap analysis between expected positions)
#   - Crown tip detection (highest/lowest point per tooth depending on jaw)

from __future__ import annotations

import logging
from dataclasses import dataclass, field

import numpy as np

from ai.utils.fdi_numbering import (
    FDI_UPPER,
    FDI_LOWER,
    class_to_fdi,
    get_quadrant,
)

logger = logging.getLogger(__name__)


# ---------------------------------------------------------------------------
# Expected tooth ordering along the arch (mesial → distal per quadrant)
# ---------------------------------------------------------------------------

# FDI numbers expected in a full upper arch
EXPECTED_UPPER = sorted(FDI_UPPER)  # [11,12,...,27,28]
# FDI numbers expected in a full lower arch
EXPECTED_LOWER = sorted(FDI_LOWER)  # [31,32,...,47,48]


# ---------------------------------------------------------------------------
# Data structures
# ---------------------------------------------------------------------------

@dataclass
class ToothCenterPoint:
    """A detected tooth center point in 3D space."""

    fdi: int
    centroid: list[float]          # [x, y, z] weighted centroid of all faces
    crown_tip: list[float]         # [x, y, z] highest/lowest point (occlusal tip)
    buccal_point: list[float]      # [x, y, z] outermost point (buccal surface)
    face_count: int                # number of faces assigned to this tooth
    confidence: float              # mean probability for this tooth class
    surface_area: float            # total face area in mm²


@dataclass
class OverbiteClassification:
    """Overbite analysis result."""

    type: str                      # "normal", "deep", "open", "edge_to_edge"
    measurement_mm: float          # vertical overlap in mm
    description: str


@dataclass
class MissingToothInfo:
    """Information about a detected missing tooth."""

    fdi: int
    expected_position: list[float]  # estimated [x, y, z]
    gap_width_mm: float             # measured gap between neighbors
    mesial_neighbor: int | None     # FDI of mesial neighbor
    distal_neighbor: int | None     # FDI of distal neighbor


@dataclass
class CenterPointResult:
    """Complete output of center point detection."""

    center_points: dict[int, ToothCenterPoint]  # FDI → center point
    missing_teeth: list[MissingToothInfo]
    overbite: OverbiteClassification | None
    jaw: str                        # "upper" or "lower"
    teeth_detected: list[int]       # sorted FDI numbers
    teeth_expected: list[int]       # full arch FDI numbers
    arch_centroid: list[float]      # center of all detected teeth
    arch_width_mm: float            # distance between most lateral teeth
    arch_depth_mm: float            # anterior-posterior distance


# ---------------------------------------------------------------------------
# Main entry point
# ---------------------------------------------------------------------------

def detect_center_points(
    stl_path: str,
    face_labels: np.ndarray,
    face_probs: np.ndarray | None = None,
    jaw: str = "upper",
) -> CenterPointResult:
    """Detect tooth center points from segmentation output.

    Args:
        stl_path: Path to the STL mesh file.
        face_labels: (F,) per-face class indices (0=gum, 1-14=teeth).
        face_probs: (F, 15) per-face class probabilities. If None,
            confidence defaults to 1.0 for all teeth.
        jaw: "upper" or "lower".

    Returns:
        CenterPointResult with center points, missing teeth, and overbite.
    """
    import vedo

    mesh = vedo.load(stl_path)
    cells = np.asarray(mesh.cells) if hasattr(mesh, "cells") and not callable(mesh.cells) else np.asarray(mesh.cells())
    points = np.asarray(mesh.points) if hasattr(mesh, "points") and not callable(mesh.points) else np.asarray(mesh.points())

    n_faces = len(cells)

    # Compute face centroids and areas
    v0 = points[cells[:, 0]]
    v1 = points[cells[:, 1]]
    v2 = points[cells[:, 2]]

    face_centroids = (v0 + v1 + v2) / 3.0
    # Face areas via cross product
    cross = np.cross(v1 - v0, v2 - v0)
    face_areas = 0.5 * np.linalg.norm(cross, axis=1)

    # Detect center points per tooth class
    center_points: dict[int, ToothCenterPoint] = {}

    for class_idx in np.unique(face_labels):
        class_idx = int(class_idx)
        if class_idx == 0:
            continue  # skip gum

        fdi = class_to_fdi(class_idx, jaw=jaw)
        mask = face_labels == class_idx
        n_tooth_faces = int(np.sum(mask))

        if n_tooth_faces == 0:
            continue

        tooth_centroids = face_centroids[mask]
        tooth_areas = face_areas[mask]
        total_area = float(np.sum(tooth_areas))

        # Area-weighted centroid
        weights = tooth_areas / (total_area + 1e-12)
        weighted_centroid = np.average(tooth_centroids, axis=0, weights=weights)

        # Crown tip: for upper jaw → lowest Y (occlusal surface faces down)
        #            for lower jaw → highest Y (occlusal surface faces up)
        tooth_points = _get_tooth_vertex_positions(cells, points, mask)
        if jaw == "upper":
            tip_idx = np.argmin(tooth_points[:, 1])
        else:
            tip_idx = np.argmax(tooth_points[:, 1])
        crown_tip = tooth_points[tip_idx]

        # Buccal point: farthest from arch midline (largest |x|)
        buccal_idx = np.argmax(np.abs(tooth_points[:, 0]))
        buccal_point = tooth_points[buccal_idx]

        # Confidence from probability matrix
        if face_probs is not None and face_probs.shape[1] > class_idx:
            conf = float(np.mean(face_probs[mask, class_idx]))
        else:
            conf = 1.0

        center_points[fdi] = ToothCenterPoint(
            fdi=fdi,
            centroid=weighted_centroid.tolist(),
            crown_tip=crown_tip.tolist(),
            buccal_point=buccal_point.tolist(),
            face_count=n_tooth_faces,
            confidence=round(conf, 4),
            surface_area=round(total_area, 2),
        )

    teeth_detected = sorted(center_points.keys())
    expected = EXPECTED_UPPER if jaw == "upper" else EXPECTED_LOWER

    # Missing tooth detection
    missing_teeth = _detect_missing_teeth(center_points, teeth_detected, expected, jaw)

    # Overbite classification (only if both upper and lower incisors present)
    overbite = _classify_overbite(center_points, jaw)

    # Arch metrics
    arch_centroid, arch_width, arch_depth = _compute_arch_metrics(center_points)

    logger.info(
        "Center points detected: %d teeth, %d missing, arch=%.1fmm wide x %.1fmm deep",
        len(teeth_detected), len(missing_teeth), arch_width, arch_depth,
    )

    return CenterPointResult(
        center_points=center_points,
        missing_teeth=missing_teeth,
        overbite=overbite,
        jaw=jaw,
        teeth_detected=teeth_detected,
        teeth_expected=expected,
        arch_centroid=arch_centroid,
        arch_width_mm=arch_width,
        arch_depth_mm=arch_depth,
    )


# ---------------------------------------------------------------------------
# Helper functions
# ---------------------------------------------------------------------------

def _get_tooth_vertex_positions(
    cells: np.ndarray,
    points: np.ndarray,
    face_mask: np.ndarray,
) -> np.ndarray:
    """Get all unique vertex positions for faces matching the mask."""
    tooth_faces = cells[face_mask]
    unique_verts = np.unique(tooth_faces.ravel())
    return points[unique_verts]


def _detect_missing_teeth(
    center_points: dict[int, ToothCenterPoint],
    detected: list[int],
    expected: list[int],
    jaw: str,
) -> list[MissingToothInfo]:
    """Detect missing teeth by checking gaps in the expected arch sequence."""
    missing: list[MissingToothInfo] = []

    for fdi in expected:
        if fdi in center_points:
            continue

        # This tooth was expected but not detected
        # Find mesial and distal neighbors
        mesial, distal = _find_neighbors(fdi, detected, jaw)

        # Estimate position by interpolating between neighbors
        estimated_pos = [0.0, 0.0, 0.0]
        gap_width = 0.0

        if mesial is not None and distal is not None:
            mc = np.array(center_points[mesial].centroid)
            dc = np.array(center_points[distal].centroid)
            estimated_pos = ((mc + dc) / 2).tolist()
            gap_width = float(np.linalg.norm(mc - dc))
        elif mesial is not None:
            estimated_pos = center_points[mesial].centroid[:]
        elif distal is not None:
            estimated_pos = center_points[distal].centroid[:]

        missing.append(MissingToothInfo(
            fdi=fdi,
            expected_position=estimated_pos,
            gap_width_mm=round(gap_width, 2),
            mesial_neighbor=mesial,
            distal_neighbor=distal,
        ))

    return missing


def _find_neighbors(
    fdi: int,
    detected: list[int],
    jaw: str,
) -> tuple[int | None, int | None]:
    """Find the nearest mesial and distal detected teeth for a given FDI.

    Mesial = toward midline, distal = away from midline.
    """
    quadrant = get_quadrant(fdi)
    tooth_num = fdi % 10

    # Same-quadrant teeth sorted by tooth number
    same_quad = [d for d in detected if get_quadrant(d) == quadrant]
    same_quad.sort(key=lambda x: x % 10)

    mesial = None  # toward midline (lower tooth numbers)
    distal = None  # away from midline (higher tooth numbers)

    for d in same_quad:
        d_num = d % 10
        if d_num < tooth_num:
            mesial = d  # closer to midline
        elif d_num > tooth_num and distal is None:
            distal = d  # further from midline

    # If no mesial in same quadrant, check contralateral
    if mesial is None:
        contra_quad = {1: 2, 2: 1, 3: 4, 4: 3}[quadrant]
        contra_teeth = [d for d in detected if get_quadrant(d) == contra_quad]
        if contra_teeth:
            # Closest contralateral tooth (central incisor)
            contra_teeth.sort(key=lambda x: x % 10)
            mesial = contra_teeth[0]

    return mesial, distal


def _classify_overbite(
    center_points: dict[int, ToothCenterPoint],
    jaw: str,
) -> OverbiteClassification | None:
    """Classify overbite based on upper/lower incisor vertical overlap.

    Only possible when we have both upper and lower central incisors.
    Since we typically process one jaw at a time, this may return None.
    For single-jaw analysis, we estimate from crown tip positions.
    """
    # Upper central incisors: 11, 21
    # Lower central incisors: 31, 41
    upper_incisors = [fdi for fdi in [11, 21] if fdi in center_points]
    lower_incisors = [fdi for fdi in [31, 41] if fdi in center_points]

    if not upper_incisors and not lower_incisors:
        return None

    if upper_incisors and lower_incisors:
        # True overbite measurement: vertical overlap
        upper_tips = np.array([center_points[f].crown_tip for f in upper_incisors])
        lower_tips = np.array([center_points[f].crown_tip for f in lower_incisors])
        upper_y = np.mean(upper_tips[:, 1])
        lower_y = np.mean(lower_tips[:, 1])
        overlap = upper_y - lower_y  # positive = upper below lower (normal for upper jaw)
    else:
        # Single jaw: estimate from incisor vs molar heights
        if jaw == "upper":
            incisors = [f for f in [11, 12, 21, 22] if f in center_points]
            molars = [f for f in [16, 17, 26, 27] if f in center_points]
        else:
            incisors = [f for f in [31, 32, 41, 42] if f in center_points]
            molars = [f for f in [36, 37, 46, 47] if f in center_points]

        if not incisors or not molars:
            return None

        incisor_y = np.mean([center_points[f].crown_tip[1] for f in incisors])
        molar_y = np.mean([center_points[f].crown_tip[1] for f in molars])
        # Curve of Spee approximation
        overlap = abs(incisor_y - molar_y)

    overlap_mm = abs(float(overlap))

    if overlap_mm > 4.0:
        return OverbiteClassification(
            type="deep",
            measurement_mm=round(overlap_mm, 2),
            description=f"Deep overbite: {overlap_mm:.1f}mm vertical overlap (normal < 4mm)",
        )
    elif overlap_mm < 0.5:
        return OverbiteClassification(
            type="open",
            measurement_mm=round(overlap_mm, 2),
            description=f"Open bite tendency: {overlap_mm:.1f}mm overlap",
        )
    elif overlap_mm < 1.0:
        return OverbiteClassification(
            type="edge_to_edge",
            measurement_mm=round(overlap_mm, 2),
            description=f"Edge-to-edge bite: {overlap_mm:.1f}mm overlap",
        )
    else:
        return OverbiteClassification(
            type="normal",
            measurement_mm=round(overlap_mm, 2),
            description=f"Normal overbite: {overlap_mm:.1f}mm",
        )


def _compute_arch_metrics(
    center_points: dict[int, ToothCenterPoint],
) -> tuple[list[float], float, float]:
    """Compute arch centroid, width, and depth.

    Returns:
        (arch_centroid [x,y,z], width_mm, depth_mm)
    """
    if not center_points:
        return [0.0, 0.0, 0.0], 0.0, 0.0

    centroids = np.array([cp.centroid for cp in center_points.values()])
    arch_centroid = centroids.mean(axis=0).tolist()

    # Arch width: max X extent
    width = float(np.max(centroids[:, 0]) - np.min(centroids[:, 0]))

    # Arch depth: max Z extent (anterior-posterior)
    depth = float(np.max(centroids[:, 2]) - np.min(centroids[:, 2]))

    return arch_centroid, round(width, 2), round(depth, 2)
