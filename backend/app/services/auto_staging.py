# auto_staging.py — Compute treatment stages from initial → target positions.
#
# The doctor/technician sets the FINAL target transform for each tooth.
# This service auto-computes intermediate stages respecting clinical limits:
#   - Max translation per stage: 0.25mm
#   - Max rotation per stage: 2°
#   - Tooth instructions (DO_NOT_MOVE, LIMIT_MOVEMENT_MM, etc.)
#
# The number of stages is determined by the tooth requiring the most stages.

from __future__ import annotations

import math
import logging
from dataclasses import dataclass, field

logger = logging.getLogger(__name__)

# ── Clinical limits per stage (per aligner tray, ~2 weeks wear) ──────

MAX_TRANSLATION_PER_STAGE_MM = 0.25   # mm per stage
MAX_ROTATION_PER_STAGE_DEG = 2.0      # degrees per stage
MIN_STAGES = 1
MAX_STAGES = 80  # safety cap


@dataclass
class ToothTarget:
    """Final target transform for one tooth."""
    fdi_number: int
    pos_x: float = 0.0  # mm
    pos_y: float = 0.0
    pos_z: float = 0.0
    rot_x: float = 0.0  # degrees
    rot_y: float = 0.0
    rot_z: float = 0.0


@dataclass
class ToothConstraint:
    """Clinical constraint for a tooth from doctor instructions."""
    fdi_number: int
    do_not_move: bool = False
    max_movement_mm: float | None = None  # from LIMIT_MOVEMENT_MM instruction
    avoid_tipping: bool = False
    avoid_rotation: bool = False
    sensitive_root: bool = False


@dataclass
class StagedTransform:
    """Single tooth transform at one stage."""
    fdi_number: int
    pos_x: float = 0.0
    pos_y: float = 0.0
    pos_z: float = 0.0
    rot_x: float = 0.0
    rot_y: float = 0.0
    rot_z: float = 0.0


@dataclass
class StagingResult:
    """Result of auto-staging computation."""
    total_stages: int
    stages: list[list[StagedTransform]]  # stages[stage_idx] = list of transforms
    warnings: list[str] = field(default_factory=list)
    per_tooth_stages: dict[int, int] = field(default_factory=dict)  # fdi → required stages


def compute_stages(
    targets: list[ToothTarget],
    constraints: list[ToothConstraint] | None = None,
    custom_max_translation: float | None = None,
    custom_max_rotation: float | None = None,
) -> StagingResult:
    """Compute intermediate treatment stages from targets.

    Parameters
    ----------
    targets : list[ToothTarget]
        Final desired position/rotation for each tooth.
    constraints : list[ToothConstraint] | None
        Clinical constraints from doctor's tooth instructions.
    custom_max_translation : float | None
        Override max mm per stage (default 0.25).
    custom_max_rotation : float | None
        Override max degrees per stage (default 2.0).

    Returns
    -------
    StagingResult with computed stages and warnings.
    """
    max_trans = custom_max_translation or MAX_TRANSLATION_PER_STAGE_MM
    max_rot = custom_max_rotation or MAX_ROTATION_PER_STAGE_DEG

    constraint_map: dict[int, ToothConstraint] = {}
    if constraints:
        for c in constraints:
            constraint_map[c.fdi_number] = c

    warnings: list[str] = []
    per_tooth_stages: dict[int, int] = {}

    # ── Step 1: Compute how many stages each tooth needs ──────────

    for t in targets:
        c = constraint_map.get(t.fdi_number)

        # Enforce DO_NOT_MOVE
        if c and c.do_not_move:
            if _has_movement(t):
                warnings.append(
                    f"FDI {t.fdi_number}: marked DO_NOT_MOVE but has target movement — "
                    f"movement will be zeroed."
                )
                t.pos_x = t.pos_y = t.pos_z = 0.0
                t.rot_x = t.rot_y = t.rot_z = 0.0
            per_tooth_stages[t.fdi_number] = 0
            continue

        # Enforce LIMIT_MOVEMENT_MM
        if c and c.max_movement_mm is not None:
            total_trans = _total_translation(t)
            if total_trans > c.max_movement_mm:
                scale = c.max_movement_mm / total_trans
                t.pos_x *= scale
                t.pos_y *= scale
                t.pos_z *= scale
                warnings.append(
                    f"FDI {t.fdi_number}: total movement {total_trans:.1f}mm exceeds limit "
                    f"{c.max_movement_mm:.1f}mm — scaled down."
                )

        # Enforce AVOID_TIPPING (zero torque rotation)
        if c and c.avoid_tipping:
            if t.rot_x != 0:
                warnings.append(f"FDI {t.fdi_number}: tipping zeroed (AVOID_TIPPING).")
                t.rot_x = 0.0
            if t.rot_z != 0:
                t.rot_z = 0.0

        # Enforce AVOID_ROTATION
        if c and c.avoid_rotation:
            if t.rot_y != 0:
                warnings.append(f"FDI {t.fdi_number}: rotation zeroed (AVOID_ROTATION).")
                t.rot_y = 0.0

        # Use gentler limits for sensitive roots
        tooth_max_trans = max_trans
        tooth_max_rot = max_rot
        if c and c.sensitive_root:
            tooth_max_trans *= 0.5  # half speed for sensitive roots
            tooth_max_rot *= 0.5
            warnings.append(
                f"FDI {t.fdi_number}: sensitive root — using half-speed staging."
            )

        # Calculate required stages for this tooth
        trans_stages = _translation_stages(t, tooth_max_trans)
        rot_stages = _rotation_stages(t, tooth_max_rot)
        per_tooth_stages[t.fdi_number] = max(trans_stages, rot_stages)

    # ── Step 2: Total stages = max across all teeth ──────────────

    total_stages = max(per_tooth_stages.values()) if per_tooth_stages else 0
    total_stages = max(MIN_STAGES, min(total_stages, MAX_STAGES))

    if total_stages == MAX_STAGES:
        warnings.append(
            f"Treatment capped at {MAX_STAGES} stages — some movements may be incomplete."
        )

    logger.info(
        "Auto-staging: %d teeth, %d total stages (max per-tooth: %s)",
        len(targets), total_stages,
        {fdi: s for fdi, s in sorted(per_tooth_stages.items()) if s > 0},
    )

    # ── Step 3: Linearly interpolate each tooth across stages ────

    stages: list[list[StagedTransform]] = []

    for stage_idx in range(total_stages + 1):  # 0 = initial, 1..N = stages
        stage_transforms: list[StagedTransform] = []

        for t in targets:
            if stage_idx == 0:
                # Initial position: all zeros
                stage_transforms.append(StagedTransform(fdi_number=t.fdi_number))
                continue

            tooth_total = per_tooth_stages.get(t.fdi_number, 0)
            if tooth_total == 0:
                # No movement needed
                stage_transforms.append(StagedTransform(fdi_number=t.fdi_number))
                continue

            # Progress for this tooth (may finish before total_stages)
            progress = min(stage_idx / tooth_total, 1.0)

            stage_transforms.append(StagedTransform(
                fdi_number=t.fdi_number,
                pos_x=t.pos_x * progress,
                pos_y=t.pos_y * progress,
                pos_z=t.pos_z * progress,
                rot_x=t.rot_x * progress,
                rot_y=t.rot_y * progress,
                rot_z=t.rot_z * progress,
            ))

        stages.append(stage_transforms)

    return StagingResult(
        total_stages=total_stages,
        stages=stages,
        warnings=warnings,
        per_tooth_stages=per_tooth_stages,
    )


# ── Helpers ──────────────────────────────────────────────────────────

def _has_movement(t: ToothTarget) -> bool:
    return any(v != 0 for v in [t.pos_x, t.pos_y, t.pos_z, t.rot_x, t.rot_y, t.rot_z])


def _total_translation(t: ToothTarget) -> float:
    return math.sqrt(t.pos_x ** 2 + t.pos_y ** 2 + t.pos_z ** 2)


def _total_rotation(t: ToothTarget) -> float:
    return max(abs(t.rot_x), abs(t.rot_y), abs(t.rot_z))


def _translation_stages(t: ToothTarget, max_per_stage: float) -> int:
    total = _total_translation(t)
    if total <= 0:
        return 0
    return math.ceil(total / max_per_stage)


def _rotation_stages(t: ToothTarget, max_per_stage: float) -> int:
    total = _total_rotation(t)
    if total <= 0:
        return 0
    return math.ceil(total / max_per_stage)
