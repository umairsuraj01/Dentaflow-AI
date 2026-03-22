# stage_validator.py — Validate treatment stages for clinical feasibility.
#
# Checks performed per stage:
#   1. Collision detection (teeth overlapping)
#   2. Movement magnitude limits (per-stage max translation/rotation)
#   3. Total movement feasibility (physiological limits)
#   4. Sequential consistency (no teleporting teeth)
#   5. Anchorage checks (enough teeth staying still to anchor movement)

from __future__ import annotations

import logging
from dataclasses import dataclass, field

import numpy as np

from ai.analysis.collision_detection import detect_collisions_bbox

logger = logging.getLogger(__name__)

# Clinical limits
MAX_TOTAL_TRANSLATION_MM = 20.0   # maximum total translation for any tooth
MAX_TOTAL_ROTATION_DEG = 40.0     # maximum total rotation for any tooth
MAX_INTER_STAGE_JUMP_MM = 1.0     # max position change between consecutive stages
MIN_ANCHORAGE_TEETH = 4           # minimum teeth not moving to provide anchorage


@dataclass
class StageIssue:
    """A single validation issue found in a stage."""
    stage_index: int
    severity: str          # "error", "warning", "info"
    category: str          # "collision", "movement_limit", "feasibility", "consistency", "anchorage"
    fdi: int | None        # tooth involved (None for general issues)
    message: str


@dataclass
class StageValidationResult:
    """Validation result for a single stage."""
    stage_index: int
    is_valid: bool
    collision_count: int
    max_overlap_mm: float
    issues: list[StageIssue]


@dataclass
class ValidationReport:
    """Complete validation report for all stages."""
    total_stages: int
    stages_valid: int
    stages_with_errors: int
    stages_with_warnings: int
    stage_results: list[StageValidationResult]
    global_issues: list[StageIssue]
    is_feasible: bool      # overall treatment feasibility


def validate_stages(
    tooth_data: dict[int, dict],
    stages: list[dict[int, dict]],
    jaw: str,
    max_translation_per_stage: float = 0.25,
    max_rotation_per_stage: float = 2.0,
    collision_margin_mm: float = 0.0,
) -> ValidationReport:
    """Validate all treatment stages.

    Args:
        tooth_data: {fdi: {"centroid", "bbox_min", "bbox_max"}}
        stages: List of stage dicts {fdi: {"pos_x", "pos_y", "pos_z", "rot_x", "rot_y", "rot_z"}}
        jaw: "upper" or "lower"
        max_translation_per_stage: Maximum mm per stage.
        max_rotation_per_stage: Maximum degrees per stage.
        collision_margin_mm: Safety margin for collision detection.

    Returns:
        ValidationReport with per-stage and global issues.
    """
    from ai.utils.fdi_numbering import get_quadrant

    jaw_quadrants = (1, 2) if jaw == "upper" else (3, 4)
    jaw_teeth = [fdi for fdi in tooth_data if get_quadrant(fdi) in jaw_quadrants]

    stage_results: list[StageValidationResult] = []
    global_issues: list[StageIssue] = []

    for stage_idx, stage_transforms in enumerate(stages):
        issues: list[StageIssue] = []

        # 1. Collision detection
        report = detect_collisions_bbox(tooth_data, stage_transforms, collision_margin_mm)
        if report.collision_count > 0:
            for c in report.collisions:
                if c.colliding:
                    issues.append(StageIssue(
                        stage_index=stage_idx,
                        severity="error",
                        category="collision",
                        fdi=c.fdi_a,
                        message=f"Collision between {c.fdi_a}-{c.fdi_b}: {c.overlap_mm:.2f}mm overlap",
                    ))

        # 2. Per-stage movement limits
        if stage_idx > 0:
            prev_transforms = stages[stage_idx - 1]
            _check_inter_stage_limits(
                stage_idx, prev_transforms, stage_transforms,
                jaw_teeth, max_translation_per_stage, max_rotation_per_stage,
                issues,
            )

        # 3. Total movement feasibility
        _check_total_movement(stage_idx, stage_transforms, jaw_teeth, issues)

        # 4. Anchorage check
        _check_anchorage(stage_idx, stage_transforms, jaw_teeth, issues)

        has_errors = any(i.severity == "error" for i in issues)
        stage_results.append(StageValidationResult(
            stage_index=stage_idx,
            is_valid=not has_errors,
            collision_count=report.collision_count,
            max_overlap_mm=report.max_overlap_mm,
            issues=issues,
        ))

    # Global checks
    if stages:
        _check_sequential_consistency(stages, jaw_teeth, global_issues)

    stages_valid = sum(1 for s in stage_results if s.is_valid)
    stages_with_errors = sum(1 for s in stage_results if not s.is_valid)
    stages_with_warnings = sum(
        1 for s in stage_results
        if any(i.severity == "warning" for i in s.issues)
    )
    is_feasible = stages_with_errors == 0 and not any(
        i.severity == "error" for i in global_issues
    )

    logger.info(
        "Stage validation (%s): %d stages, %d valid, %d errors, feasible=%s",
        jaw, len(stages), stages_valid, stages_with_errors, is_feasible,
    )

    return ValidationReport(
        total_stages=len(stages),
        stages_valid=stages_valid,
        stages_with_errors=stages_with_errors,
        stages_with_warnings=stages_with_warnings,
        stage_results=stage_results,
        global_issues=global_issues,
        is_feasible=is_feasible,
    )


# ---------------------------------------------------------------------------
# Validation checks
# ---------------------------------------------------------------------------

def _check_inter_stage_limits(
    stage_idx: int,
    prev: dict[int, dict],
    curr: dict[int, dict],
    jaw_teeth: list[int],
    max_trans: float,
    max_rot: float,
    issues: list[StageIssue],
) -> None:
    """Check that movement between consecutive stages is within limits."""
    for fdi in jaw_teeth:
        prev_t = prev.get(fdi, {})
        curr_t = curr.get(fdi, {})

        # Translation delta
        dx = curr_t.get("pos_x", 0) - prev_t.get("pos_x", 0)
        dy = curr_t.get("pos_y", 0) - prev_t.get("pos_y", 0)
        dz = curr_t.get("pos_z", 0) - prev_t.get("pos_z", 0)
        delta_trans = float(np.sqrt(dx**2 + dy**2 + dz**2))

        if delta_trans > max_trans * 1.5:  # 50% tolerance
            issues.append(StageIssue(
                stage_index=stage_idx,
                severity="error" if delta_trans > max_trans * 2 else "warning",
                category="movement_limit",
                fdi=fdi,
                message=f"FDI {fdi}: inter-stage translation {delta_trans:.2f}mm exceeds limit {max_trans:.2f}mm",
            ))

        # Rotation delta
        drx = abs(curr_t.get("rot_x", 0) - prev_t.get("rot_x", 0))
        dry = abs(curr_t.get("rot_y", 0) - prev_t.get("rot_y", 0))
        drz = abs(curr_t.get("rot_z", 0) - prev_t.get("rot_z", 0))
        delta_rot = max(drx, dry, drz)

        if delta_rot > max_rot * 1.5:
            issues.append(StageIssue(
                stage_index=stage_idx,
                severity="error" if delta_rot > max_rot * 2 else "warning",
                category="movement_limit",
                fdi=fdi,
                message=f"FDI {fdi}: inter-stage rotation {delta_rot:.1f}° exceeds limit {max_rot:.1f}°",
            ))


def _check_total_movement(
    stage_idx: int,
    transforms: dict[int, dict],
    jaw_teeth: list[int],
    issues: list[StageIssue],
) -> None:
    """Check that total cumulative movement is within physiological limits."""
    for fdi in jaw_teeth:
        t = transforms.get(fdi, {})
        total_trans = float(np.sqrt(
            t.get("pos_x", 0)**2 + t.get("pos_y", 0)**2 + t.get("pos_z", 0)**2
        ))
        total_rot = max(
            abs(t.get("rot_x", 0)),
            abs(t.get("rot_y", 0)),
            abs(t.get("rot_z", 0)),
        )

        if total_trans > MAX_TOTAL_TRANSLATION_MM:
            issues.append(StageIssue(
                stage_index=stage_idx,
                severity="error",
                category="feasibility",
                fdi=fdi,
                message=f"FDI {fdi}: total translation {total_trans:.1f}mm exceeds physiological limit {MAX_TOTAL_TRANSLATION_MM}mm",
            ))

        if total_rot > MAX_TOTAL_ROTATION_DEG:
            issues.append(StageIssue(
                stage_index=stage_idx,
                severity="error",
                category="feasibility",
                fdi=fdi,
                message=f"FDI {fdi}: total rotation {total_rot:.1f}° exceeds physiological limit {MAX_TOTAL_ROTATION_DEG}°",
            ))


def _check_anchorage(
    stage_idx: int,
    transforms: dict[int, dict],
    jaw_teeth: list[int],
    issues: list[StageIssue],
) -> None:
    """Check that enough teeth are stationary to provide anchorage."""
    stationary = 0
    for fdi in jaw_teeth:
        t = transforms.get(fdi, {})
        total_trans = float(np.sqrt(
            t.get("pos_x", 0)**2 + t.get("pos_y", 0)**2 + t.get("pos_z", 0)**2
        ))
        total_rot = max(
            abs(t.get("rot_x", 0)),
            abs(t.get("rot_y", 0)),
            abs(t.get("rot_z", 0)),
        )
        if total_trans < 0.1 and total_rot < 0.5:
            stationary += 1

    if stationary < MIN_ANCHORAGE_TEETH and len(jaw_teeth) >= MIN_ANCHORAGE_TEETH:
        issues.append(StageIssue(
            stage_index=stage_idx,
            severity="warning",
            category="anchorage",
            fdi=None,
            message=f"Only {stationary} stationary teeth — minimum {MIN_ANCHORAGE_TEETH} recommended for anchorage",
        ))


def _check_sequential_consistency(
    stages: list[dict[int, dict]],
    jaw_teeth: list[int],
    global_issues: list[StageIssue],
) -> None:
    """Check that tooth movements are monotonically progressing (no jumps back)."""
    for fdi in jaw_teeth:
        prev_total = 0.0
        reversals = 0
        for stage_idx, transforms in enumerate(stages):
            t = transforms.get(fdi, {})
            total = float(np.sqrt(
                t.get("pos_x", 0)**2 + t.get("pos_y", 0)**2 + t.get("pos_z", 0)**2
            ))
            if stage_idx > 0 and total < prev_total - 0.05:
                reversals += 1
            prev_total = total

        if reversals > 1:
            global_issues.append(StageIssue(
                stage_index=-1,
                severity="warning",
                category="consistency",
                fdi=fdi,
                message=f"FDI {fdi}: movement reverses direction {reversals} times — check staging logic",
            ))
