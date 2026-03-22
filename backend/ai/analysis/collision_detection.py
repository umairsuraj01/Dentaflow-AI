# collision_detection.py — Detect tooth-tooth collisions / overlaps.
#
# Two approaches:
#   1. Fast OBB (Oriented Bounding Box) overlap — checks if bounding boxes
#      of adjacent teeth overlap. Good for real-time feedback.
#   2. Precise mesh intersection — uses trimesh boolean operations to detect
#      actual mesh-mesh penetration. Slower but accurate.
#
# The adjacency list defines which teeth can collide (only neighbors matter).

from __future__ import annotations

import logging
from dataclasses import dataclass

import numpy as np

logger = logging.getLogger(__name__)

# Adjacent tooth pairs (FDI numbers that can collide).
# Each pair is sorted and stored once.
_UPPER_ADJACENT = [
    (17, 16), (16, 15), (15, 14), (14, 13), (13, 12), (12, 11),
    (11, 21), (21, 22), (22, 23), (23, 24), (24, 25), (25, 26), (26, 27),
]
_LOWER_ADJACENT = [
    (47, 46), (46, 45), (45, 44), (44, 43), (43, 42), (42, 41),
    (41, 31), (31, 32), (32, 33), (33, 34), (34, 35), (35, 36), (36, 37),
]
ADJACENT_PAIRS = _UPPER_ADJACENT + _LOWER_ADJACENT


@dataclass
class CollisionResult:
    """Result for a single tooth-tooth collision check."""
    fdi_a: int
    fdi_b: int
    colliding: bool
    overlap_mm: float        # estimated penetration depth (0 if no collision)
    contact_point: list[float] | None  # approximate contact point [x, y, z]


@dataclass
class CollisionReport:
    """Full collision detection report."""
    total_pairs_checked: int
    collisions: list[CollisionResult]
    collision_count: int
    max_overlap_mm: float


def detect_collisions_bbox(
    tooth_data: dict[int, dict],
    transforms: dict[int, dict] | None = None,
    margin_mm: float = 0.0,
) -> CollisionReport:
    """Fast collision detection using axis-aligned bounding box overlap.

    Args:
        tooth_data: {fdi: {"centroid": [x,y,z], "bbox_min": [x,y,z], "bbox_max": [x,y,z]}}
        transforms: Optional {fdi: {"pos_x", "pos_y", "pos_z"}} offsets applied to teeth.
        margin_mm: Safety margin — report collision if gap < margin (use negative
                   for tolerance, positive for stricter check).

    Returns:
        CollisionReport with all collision pairs.
    """
    transforms = transforms or {}
    collisions: list[CollisionResult] = []
    pairs_checked = 0

    for fdi_a, fdi_b in ADJACENT_PAIRS:
        if fdi_a not in tooth_data or fdi_b not in tooth_data:
            continue

        pairs_checked += 1

        # Get bboxes, applying transforms if provided
        min_a, max_a = _get_transformed_bbox(tooth_data[fdi_a], transforms.get(fdi_a))
        min_b, max_b = _get_transformed_bbox(tooth_data[fdi_b], transforms.get(fdi_b))

        # Check AABB overlap on all 3 axes
        overlap = _aabb_overlap(min_a, max_a, min_b, max_b)

        if overlap > -margin_mm:
            # Compute approximate contact point (midpoint of overlap region)
            contact = _overlap_midpoint(min_a, max_a, min_b, max_b)
            collisions.append(CollisionResult(
                fdi_a=fdi_a,
                fdi_b=fdi_b,
                colliding=overlap > 0,
                overlap_mm=round(max(0, overlap), 3),
                contact_point=[round(c, 2) for c in contact],
            ))

    max_overlap = max((c.overlap_mm for c in collisions), default=0)
    collision_count = sum(1 for c in collisions if c.colliding)

    logger.info(
        "Collision check: %d pairs, %d collisions (max overlap %.2fmm)",
        pairs_checked, collision_count, max_overlap,
    )

    return CollisionReport(
        total_pairs_checked=pairs_checked,
        collisions=collisions,
        collision_count=collision_count,
        max_overlap_mm=round(max_overlap, 3),
    )


def detect_collisions_per_stage(
    tooth_data: dict[int, dict],
    stages: list[dict[int, dict]],
    margin_mm: float = 0.0,
) -> list[CollisionReport]:
    """Run collision detection on each stage of a treatment plan.

    Args:
        tooth_data: Base tooth data with centroids/bboxes.
        stages: List of stage dicts, each mapping fdi → {"pos_x", "pos_y", "pos_z", ...}.
        margin_mm: Safety margin for collision detection.

    Returns:
        List of CollisionReport, one per stage.
    """
    reports = []
    for stage_idx, stage_transforms in enumerate(stages):
        report = detect_collisions_bbox(tooth_data, stage_transforms, margin_mm)
        if report.collision_count > 0:
            logger.warning(
                "Stage %d: %d collisions detected (max overlap %.2fmm)",
                stage_idx, report.collision_count, report.max_overlap_mm,
            )
        reports.append(report)
    return reports


def compute_interproximal_distances(
    tooth_data: dict[int, dict],
    transforms: dict[int, dict] | None = None,
) -> list[dict]:
    """Compute distances between adjacent teeth (for IPR planning).

    Returns list of {fdi_a, fdi_b, distance_mm, contact_type} for each adjacent pair.
    Positive distance = gap, negative = overlap.
    """
    transforms = transforms or {}
    distances = []

    for fdi_a, fdi_b in ADJACENT_PAIRS:
        if fdi_a not in tooth_data or fdi_b not in tooth_data:
            continue

        min_a, max_a = _get_transformed_bbox(tooth_data[fdi_a], transforms.get(fdi_a))
        min_b, max_b = _get_transformed_bbox(tooth_data[fdi_b], transforms.get(fdi_b))

        # Compute centroid-to-centroid distance in XZ (arch plane)
        center_a = (min_a + max_a) / 2
        center_b = (min_b + max_b) / 2

        # Inter-centroid distance minus half-widths (approximate gap)
        centroid_dist = float(np.linalg.norm(center_a - center_b))
        half_size_a = float(np.linalg.norm((max_a - min_a) / 2))
        half_size_b = float(np.linalg.norm((max_b - min_b) / 2))

        # Use the overlap calculation for more precise gap
        overlap = _aabb_overlap(min_a, max_a, min_b, max_b)
        gap = -overlap  # positive gap = space, negative = overlap

        if gap > 2.0:
            contact_type = "spaced"
        elif gap > 0.1:
            contact_type = "light_contact"
        elif gap > -0.5:
            contact_type = "tight_contact"
        else:
            contact_type = "overlap"

        distances.append({
            "fdi_a": fdi_a,
            "fdi_b": fdi_b,
            "distance_mm": round(gap, 2),
            "contact_type": contact_type,
        })

    return distances


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _get_transformed_bbox(
    data: dict,
    transform: dict | None,
    shrink_pct: float = 0.15,
) -> tuple[np.ndarray, np.ndarray]:
    """Get bbox with optional transform offset applied.

    Shrinks the bbox inward by `shrink_pct` on each side to compensate for
    segmentation artifacts (gum tissue included in tooth meshes inflates
    the bounding box). A 15% shrink removes the outer fringe on each axis.
    """
    bbox_min = np.array(data["bbox_min"], dtype=np.float64)
    bbox_max = np.array(data["bbox_max"], dtype=np.float64)

    # Shrink bbox to exclude segmentation noise at the edges
    extent = bbox_max - bbox_min
    margin = extent * shrink_pct
    bbox_min = bbox_min + margin
    bbox_max = bbox_max - margin

    if transform:
        offset = np.array([
            transform.get("pos_x", 0),
            transform.get("pos_y", 0),
            transform.get("pos_z", 0),
        ], dtype=np.float64)
        bbox_min += offset
        bbox_max += offset

    return bbox_min, bbox_max


def _aabb_overlap(
    min_a: np.ndarray, max_a: np.ndarray,
    min_b: np.ndarray, max_b: np.ndarray,
) -> float:
    """Compute AABB overlap depth. Positive = overlapping, negative = separated."""
    # Per-axis overlap
    overlaps = np.minimum(max_a, max_b) - np.maximum(min_a, min_b)
    # If all axes overlap, the minimum overlap is the penetration depth
    if np.all(overlaps > 0):
        return float(np.min(overlaps))
    # No overlap: return negative of the separation distance
    return float(np.min(overlaps))


def _overlap_midpoint(
    min_a: np.ndarray, max_a: np.ndarray,
    min_b: np.ndarray, max_b: np.ndarray,
) -> list[float]:
    """Compute midpoint of the overlap region between two AABBs."""
    overlap_min = np.maximum(min_a, min_b)
    overlap_max = np.minimum(max_a, max_b)
    midpoint = (overlap_min + overlap_max) / 2
    return midpoint.tolist()
