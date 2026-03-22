# staging_engine.py — Enhanced treatment staging engine.
#
# Builds on app/services/auto_staging.py with additional features:
#   1. Movement sequencing (prioritize certain movements over others)
#   2. Collision-aware staging (validate each stage for collisions)
#   3. Easing curves (ease-in/ease-out for smoother tooth movement)
#   4. Multi-phase staging (e.g., level first, then align, then detail)
#
# This module computes stages from target movements without database access.
# The API layer (auto_staging.py) handles persistence.

from __future__ import annotations

import logging
import math
from dataclasses import dataclass, field

import numpy as np

from ai.analysis.collision_detection import detect_collisions_bbox
from ai.analysis.stage_validator import validate_stages, ValidationReport

logger = logging.getLogger(__name__)

# Clinical limits
MAX_TRANSLATION_PER_STAGE_MM = 0.25
MAX_ROTATION_PER_STAGE_DEG = 2.0
MIN_STAGES = 1
MAX_STAGES = 80


@dataclass
class MovementTarget:
    """Target movement for one tooth."""
    fdi: int
    pos_x: float = 0.0    # mm
    pos_y: float = 0.0
    pos_z: float = 0.0
    rot_x: float = 0.0    # degrees
    rot_y: float = 0.0
    rot_z: float = 0.0
    do_not_move: bool = False
    max_movement_mm: float | None = None
    sensitive_root: bool = False


@dataclass
class StageData:
    """Transforms for all teeth at one stage."""
    stage_index: int
    label: str
    transforms: dict[int, dict]   # {fdi: {"pos_x", "pos_y", "pos_z", "rot_x", "rot_y", "rot_z"}}


@dataclass
class StagingPlan:
    """Complete staging plan output."""
    total_stages: int
    stages: list[StageData]
    per_tooth_stages: dict[int, int]
    validation: ValidationReport | None
    warnings: list[str] = field(default_factory=list)


def compute_staging_plan(
    tooth_data: dict[int, dict],
    targets: list[MovementTarget],
    jaw: str,
    max_translation: float = MAX_TRANSLATION_PER_STAGE_MM,
    max_rotation: float = MAX_ROTATION_PER_STAGE_DEG,
    easing: str = "linear",
    validate: bool = True,
    sequencing: str = "simultaneous",
) -> StagingPlan:
    """Compute treatment stages from movement targets.

    Args:
        tooth_data: {fdi: {"centroid", "bbox_min", "bbox_max"}}
        targets: List of MovementTarget with final positions.
        jaw: "upper" or "lower"
        max_translation: Max mm per stage (default 0.25).
        max_rotation: Max degrees per stage (default 2.0).
        easing: "linear", "ease_in_out", "ease_in", "ease_out"
        validate: Whether to run collision/feasibility validation.
        sequencing: "simultaneous" (all at once), "anterior_first",
                    "posterior_first", "leveling_first"

    Returns:
        StagingPlan with all computed stages and optional validation.
    """
    warnings: list[str] = []
    per_tooth_stages: dict[int, int] = {}

    # Apply constraints
    _apply_constraints(targets, warnings)

    # Compute per-tooth stage requirements
    for t in targets:
        if t.do_not_move:
            per_tooth_stages[t.fdi] = 0
            continue

        tooth_max_trans = max_translation
        tooth_max_rot = max_rotation
        if t.sensitive_root:
            tooth_max_trans *= 0.5
            tooth_max_rot *= 0.5

        trans_stages = _translation_stages(t, tooth_max_trans)
        rot_stages = _rotation_stages(t, tooth_max_rot)
        per_tooth_stages[t.fdi] = max(trans_stages, rot_stages)

    total_stages = max(per_tooth_stages.values()) if per_tooth_stages else 0
    total_stages = max(MIN_STAGES, min(total_stages, MAX_STAGES))

    if total_stages == MAX_STAGES:
        warnings.append(f"Treatment capped at {MAX_STAGES} stages.")

    # Apply sequencing offsets
    offsets = _compute_sequencing_offsets(targets, sequencing, per_tooth_stages)

    # Adjust total stages for sequencing
    if offsets:
        max_end = max(
            offsets.get(t.fdi, 0) + per_tooth_stages.get(t.fdi, 0)
            for t in targets
        )
        total_stages = max(MIN_STAGES, min(max_end, MAX_STAGES))

    # Generate stages with easing
    stages: list[StageData] = []
    easing_fn = _get_easing_function(easing)

    for stage_idx in range(total_stages + 1):
        transforms: dict[int, dict] = {}

        for t in targets:
            if t.do_not_move or per_tooth_stages.get(t.fdi, 0) == 0:
                transforms[t.fdi] = _zero_transform()
                continue

            tooth_stages = per_tooth_stages[t.fdi]
            offset = offsets.get(t.fdi, 0)

            # Effective stage for this tooth (accounting for offset)
            effective_stage = stage_idx - offset
            if effective_stage <= 0:
                transforms[t.fdi] = _zero_transform()
                continue

            raw_progress = min(effective_stage / tooth_stages, 1.0)
            progress = easing_fn(raw_progress)

            transforms[t.fdi] = {
                "pos_x": round(t.pos_x * progress, 4),
                "pos_y": round(t.pos_y * progress, 4),
                "pos_z": round(t.pos_z * progress, 4),
                "rot_x": round(t.rot_x * progress, 4),
                "rot_y": round(t.rot_y * progress, 4),
                "rot_z": round(t.rot_z * progress, 4),
            }

        label = "Initial" if stage_idx == 0 else f"Stage {stage_idx}"
        stages.append(StageData(
            stage_index=stage_idx,
            label=label,
            transforms=transforms,
        ))

    # Validation
    validation = None
    if validate and tooth_data:
        stage_transform_list = [s.transforms for s in stages]
        validation = validate_stages(
            tooth_data, stage_transform_list, jaw,
            max_translation, max_rotation,
        )
        if not validation.is_feasible:
            warnings.append(
                f"Validation found {validation.stages_with_errors} stages with errors."
            )

    logger.info(
        "Staging plan (%s): %d stages, %d teeth, easing=%s, sequencing=%s",
        jaw, total_stages, len(targets), easing, sequencing,
    )

    return StagingPlan(
        total_stages=total_stages,
        stages=stages,
        per_tooth_stages=per_tooth_stages,
        validation=validation,
        warnings=warnings,
    )


# ---------------------------------------------------------------------------
# Constraints
# ---------------------------------------------------------------------------

def _apply_constraints(targets: list[MovementTarget], warnings: list[str]) -> None:
    """Apply movement constraints in-place."""
    for t in targets:
        if t.do_not_move:
            if _has_movement(t):
                warnings.append(
                    f"FDI {t.fdi}: marked DO_NOT_MOVE but has targets — zeroed."
                )
                t.pos_x = t.pos_y = t.pos_z = 0.0
                t.rot_x = t.rot_y = t.rot_z = 0.0

        if t.max_movement_mm is not None:
            total = math.sqrt(t.pos_x**2 + t.pos_y**2 + t.pos_z**2)
            if total > t.max_movement_mm:
                scale = t.max_movement_mm / total
                t.pos_x *= scale
                t.pos_y *= scale
                t.pos_z *= scale
                warnings.append(
                    f"FDI {t.fdi}: translation {total:.1f}mm scaled to limit {t.max_movement_mm:.1f}mm."
                )


# ---------------------------------------------------------------------------
# Sequencing
# ---------------------------------------------------------------------------

def _compute_sequencing_offsets(
    targets: list[MovementTarget],
    sequencing: str,
    per_tooth_stages: dict[int, int],
) -> dict[int, int]:
    """Compute stage offsets for movement sequencing."""
    offsets: dict[int, int] = {}

    if sequencing == "simultaneous":
        return offsets  # all start at stage 0

    elif sequencing == "anterior_first":
        # Anteriors (incisors + canines) start first, posteriors delayed
        max_anterior = 0
        for t in targets:
            tooth_num = t.fdi % 10
            if tooth_num <= 3:  # incisors + canines
                offsets[t.fdi] = 0
                max_anterior = max(max_anterior, per_tooth_stages.get(t.fdi, 0))
            else:
                offsets[t.fdi] = max(1, max_anterior // 2)  # posteriors start halfway

    elif sequencing == "posterior_first":
        max_posterior = 0
        for t in targets:
            tooth_num = t.fdi % 10
            if tooth_num > 3:  # premolars + molars
                offsets[t.fdi] = 0
                max_posterior = max(max_posterior, per_tooth_stages.get(t.fdi, 0))
            else:
                offsets[t.fdi] = max(1, max_posterior // 2)

    elif sequencing == "leveling_first":
        # Vertical movements (pos_y) first, then horizontal
        for t in targets:
            if abs(t.pos_y) > 0.3:  # has vertical component
                offsets[t.fdi] = 0
            else:
                # Delay horizontal-only movements
                max_vertical_stages = max(
                    (per_tooth_stages.get(tt.fdi, 0) for tt in targets if abs(tt.pos_y) > 0.3),
                    default=0,
                )
                offsets[t.fdi] = max(1, max_vertical_stages // 2)

    return offsets


# ---------------------------------------------------------------------------
# Easing functions
# ---------------------------------------------------------------------------

def _get_easing_function(easing: str):
    """Return an easing function that maps [0,1] → [0,1]."""
    if easing == "ease_in_out":
        return lambda t: t * t * (3 - 2 * t)  # smoothstep
    elif easing == "ease_in":
        return lambda t: t * t
    elif easing == "ease_out":
        return lambda t: t * (2 - t)
    else:  # linear
        return lambda t: t


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _zero_transform() -> dict:
    return {"pos_x": 0.0, "pos_y": 0.0, "pos_z": 0.0, "rot_x": 0.0, "rot_y": 0.0, "rot_z": 0.0}


def _has_movement(t: MovementTarget) -> bool:
    return any(v != 0 for v in [t.pos_x, t.pos_y, t.pos_z, t.rot_x, t.rot_y, t.rot_z])


def _translation_stages(t: MovementTarget, max_per_stage: float) -> int:
    total = math.sqrt(t.pos_x**2 + t.pos_y**2 + t.pos_z**2)
    return math.ceil(total / max_per_stage) if total > 0 else 0


def _rotation_stages(t: MovementTarget, max_per_stage: float) -> int:
    total = max(abs(t.rot_x), abs(t.rot_y), abs(t.rot_z))
    return math.ceil(total / max_per_stage) if total > 0 else 0
