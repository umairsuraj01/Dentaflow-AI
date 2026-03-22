# treatment_report.py — Comprehensive treatment report generation.
#
# Compiles all analysis results into a structured report that can be
# serialized to JSON or used as input for PDF generation.
#
# Report sections:
#   1. Patient/case metadata
#   2. Tooth inventory (segmented teeth with FDI numbers)
#   3. Dental analysis (space, Bolton, arch form, overjet/overbite, midline)
#   4. Treatment plan (staging, movements, attachments)
#   5. Clinical recommendations and warnings

from __future__ import annotations

import logging
from dataclasses import dataclass, field, asdict
from datetime import datetime

import numpy as np

logger = logging.getLogger(__name__)


@dataclass
class ToothSummary:
    """Summary for one tooth in the report."""
    fdi: int
    tooth_name: str
    centroid: list[float]
    width_mm: float
    movement_mm: float
    movement_description: str
    attachments: list[str]
    clinical_notes: list[str] = field(default_factory=list)


@dataclass
class AnalysisSummary:
    """Summary of all dental analyses."""
    space_analysis: dict | None = None
    bolton_analysis: dict | None = None
    arch_form: dict | None = None
    overjet_overbite: dict | None = None
    midline: dict | None = None
    occlusal_plane: dict | None = None


@dataclass
class StagingSummary:
    """Summary of treatment staging."""
    total_stages: int
    estimated_duration_weeks: int    # stages × 2 weeks
    max_movement_tooth: int | None   # FDI of tooth with most movement
    max_movement_mm: float
    easing: str
    sequencing: str
    collision_free: bool
    warnings: list[str] = field(default_factory=list)


@dataclass
class TreatmentReport:
    """Complete treatment report."""
    report_id: str
    generated_at: str
    jaw: str
    teeth_count: int
    tooth_summaries: list[ToothSummary]
    analysis: AnalysisSummary
    staging: StagingSummary | None
    attachment_count: int
    ipr_total_mm: float
    recommendations: list[str]
    warnings: list[str]
    difficulty_rating: str          # "simple", "moderate", "complex"


def generate_treatment_report(
    tooth_data: dict[int, dict],
    jaw: str,
    analysis_results: dict | None = None,
    staging_plan: dict | None = None,
    attachment_plan: dict | None = None,
    ipr_plan: dict | None = None,
    report_id: str | None = None,
) -> TreatmentReport:
    """Generate a comprehensive treatment report.

    Args:
        tooth_data: {fdi: {"centroid", "bbox_min", "bbox_max"}}
        jaw: "upper" or "lower"
        analysis_results: Output from run_full_analysis (as dict).
        staging_plan: Output from compute_staging_plan (as dict).
        attachment_plan: Output from plan_attachments (as dict).
        ipr_plan: Output from compute_ipr_plan (as dict).
        report_id: Custom report ID (auto-generated if None).

    Returns:
        TreatmentReport with all sections populated.
    """
    from ai.utils.fdi_numbering import get_tooth_name, get_quadrant

    if report_id is None:
        report_id = f"RPT-{datetime.now().strftime('%Y%m%d%H%M%S')}"

    jaw_quadrants = (1, 2) if jaw == "upper" else (3, 4)
    jaw_teeth = {
        fdi: data for fdi, data in tooth_data.items()
        if fdi != 0 and get_quadrant(fdi) in jaw_quadrants
    }

    # Build tooth summaries
    tooth_summaries = _build_tooth_summaries(
        jaw_teeth, jaw, analysis_results, staging_plan, attachment_plan,
    )

    # Build analysis summary
    analysis = _build_analysis_summary(analysis_results)

    # Build staging summary
    staging = _build_staging_summary(staging_plan)

    # Attachment count
    attachment_count = 0
    if attachment_plan:
        attachment_count = attachment_plan.get("total_attachments", 0)

    # IPR total
    ipr_total = 0.0
    if ipr_plan:
        ipr_total = ipr_plan.get("total_ipr_mm", 0.0)

    # Generate recommendations and warnings
    recommendations = _generate_recommendations(
        analysis_results, staging_plan, attachment_plan, ipr_plan, jaw_teeth,
    )
    warnings = _collect_warnings(staging_plan, attachment_plan, ipr_plan)

    # Difficulty rating
    difficulty = _assess_difficulty(
        jaw_teeth, staging_plan, attachment_count, ipr_total,
    )

    report = TreatmentReport(
        report_id=report_id,
        generated_at=datetime.now().isoformat(),
        jaw=jaw,
        teeth_count=len(jaw_teeth),
        tooth_summaries=tooth_summaries,
        analysis=analysis,
        staging=staging,
        attachment_count=attachment_count,
        ipr_total_mm=round(ipr_total, 2),
        recommendations=recommendations,
        warnings=warnings,
        difficulty_rating=difficulty,
    )

    logger.info(
        "Report %s: %d teeth, %d attachments, %.1fmm IPR, %s difficulty",
        report_id, len(jaw_teeth), attachment_count, ipr_total, difficulty,
    )

    return report


def report_to_dict(report: TreatmentReport) -> dict:
    """Convert TreatmentReport to a JSON-serializable dict."""
    d = asdict(report)
    # AnalysisSummary is already a dict of dicts
    return d


# ---------------------------------------------------------------------------
# Section builders
# ---------------------------------------------------------------------------

def _build_tooth_summaries(
    jaw_teeth: dict[int, dict],
    jaw: str,
    analysis_results: dict | None,
    staging_plan: dict | None,
    attachment_plan: dict | None,
) -> list[ToothSummary]:
    """Build per-tooth summaries."""
    from ai.utils.fdi_numbering import get_tooth_name

    summaries = []
    measurements = {}
    if analysis_results and "tooth_measurements" in analysis_results:
        for m in analysis_results["tooth_measurements"]:
            measurements[m.get("fdi", m.get("fdi_number"))] = m

    movements = {}
    if staging_plan and "per_tooth_stages" in staging_plan:
        for fdi_str, stages in staging_plan.get("per_tooth_stages", {}).items():
            movements[int(fdi_str)] = stages

    attachments_by_tooth: dict[int, list[str]] = {}
    if attachment_plan and "attachments" in attachment_plan:
        for att in attachment_plan["attachments"]:
            fdi = att.get("fdi")
            att_type = att.get("attachment_type", "unknown")
            attachments_by_tooth.setdefault(fdi, []).append(att_type)

    for fdi in sorted(jaw_teeth.keys()):
        data = jaw_teeth[fdi]
        m = measurements.get(fdi, {})
        width = m.get("mesiodistal_width_mm", 0.0)

        # Movement magnitude
        move_mm = 0.0
        move_desc = "No movement"
        if staging_plan and "stages" in staging_plan:
            stages = staging_plan["stages"]
            if stages:
                final = stages[-1].get("transforms", {}).get(str(fdi), {})
                px = final.get("pos_x", 0)
                py = final.get("pos_y", 0)
                pz = final.get("pos_z", 0)
                move_mm = float(np.sqrt(px**2 + py**2 + pz**2))
                if move_mm > 0.1:
                    move_desc = f"{move_mm:.1f}mm translation"
                    ry = final.get("rot_y", 0)
                    if abs(ry) > 1:
                        move_desc += f" + {abs(ry):.0f}° rotation"

        summaries.append(ToothSummary(
            fdi=fdi,
            tooth_name=get_tooth_name(fdi),
            centroid=data["centroid"] if isinstance(data["centroid"], list) else list(data["centroid"]),
            width_mm=round(width, 1),
            movement_mm=round(move_mm, 2),
            movement_description=move_desc,
            attachments=attachments_by_tooth.get(fdi, []),
        ))

    return summaries


def _build_analysis_summary(analysis_results: dict | None) -> AnalysisSummary:
    """Build analysis summary from analysis results."""
    if not analysis_results:
        return AnalysisSummary()

    return AnalysisSummary(
        space_analysis=analysis_results.get("space_analysis"),
        bolton_analysis=analysis_results.get("bolton_analysis"),
        arch_form=analysis_results.get("arch_form"),
        overjet_overbite=analysis_results.get("overjet_overbite"),
        midline=analysis_results.get("midline"),
        occlusal_plane=analysis_results.get("occlusal_plane"),
    )


def _build_staging_summary(staging_plan: dict | None) -> StagingSummary | None:
    """Build staging summary."""
    if not staging_plan:
        return None

    total_stages = staging_plan.get("total_stages", 0)
    per_tooth = staging_plan.get("per_tooth_stages", {})

    max_fdi = None
    max_mm = 0.0
    if staging_plan.get("stages"):
        final_transforms = staging_plan["stages"][-1].get("transforms", {})
        for fdi_str, t in final_transforms.items():
            total = float(np.sqrt(
                t.get("pos_x", 0)**2 + t.get("pos_y", 0)**2 + t.get("pos_z", 0)**2
            ))
            if total > max_mm:
                max_mm = total
                max_fdi = int(fdi_str)

    validation = staging_plan.get("validation", {})
    collision_free = True
    if validation:
        collision_free = validation.get("is_feasible", True)

    return StagingSummary(
        total_stages=total_stages,
        estimated_duration_weeks=total_stages * 2,
        max_movement_tooth=max_fdi,
        max_movement_mm=round(max_mm, 2),
        easing=staging_plan.get("easing", "linear"),
        sequencing=staging_plan.get("sequencing", "simultaneous"),
        collision_free=collision_free,
        warnings=staging_plan.get("warnings", []),
    )


# ---------------------------------------------------------------------------
# Recommendations and difficulty
# ---------------------------------------------------------------------------

def _generate_recommendations(
    analysis: dict | None,
    staging: dict | None,
    attachments: dict | None,
    ipr: dict | None,
    jaw_teeth: dict,
) -> list[str]:
    """Generate clinical recommendations based on analysis results."""
    recs = []

    if analysis:
        space = analysis.get("space_analysis")
        if space:
            disc = space.get("discrepancy_mm", 0)
            if disc < -4:
                recs.append(
                    f"Significant crowding ({abs(disc):.1f}mm). "
                    "Consider IPR, expansion, or extraction."
                )
            elif disc < -1:
                recs.append(
                    f"Mild crowding ({abs(disc):.1f}mm). IPR likely sufficient."
                )
            elif disc > 3:
                recs.append(
                    f"Spacing present ({disc:.1f}mm). Space closure with elastics may be needed."
                )

        bolton = analysis.get("bolton_analysis")
        if bolton:
            interp = bolton.get("overall_interpretation", "")
            if "excess" in interp.lower():
                recs.append(f"Bolton discrepancy: {interp}. Consider IPR for size correction.")

    if ipr:
        total_ipr = ipr.get("total_ipr_mm", 0)
        if total_ipr > 0:
            n_contacts = sum(
                1 for c in ipr.get("contacts", [])
                if c.get("suggested_ipr_mm", 0) > 0
            )
            recs.append(
                f"IPR recommended: {total_ipr:.1f}mm across {n_contacts} contacts."
            )
        if not ipr.get("ipr_sufficient", True):
            recs.append("IPR alone insufficient. Additional mechanics required.")

    if attachments:
        n = attachments.get("total_attachments", 0)
        if n > 0:
            recs.append(f"{n} attachments recommended for optimal tooth control.")

    if staging:
        total = staging.get("total_stages", 0)
        if total > 0:
            weeks = total * 2
            recs.append(
                f"Treatment: {total} aligner stages (~{weeks} weeks / {weeks // 4} months)."
            )

    if not recs:
        recs.append("Teeth are well-aligned. Minor refinement only.")

    return recs


def _collect_warnings(
    staging: dict | None,
    attachments: dict | None,
    ipr: dict | None,
) -> list[str]:
    """Collect all warnings from sub-plans."""
    warnings = []
    if staging:
        warnings.extend(staging.get("warnings", []))
    if attachments:
        warnings.extend(attachments.get("warnings", []))
    if ipr:
        warnings.extend(ipr.get("warnings", []))
    return warnings


def _assess_difficulty(
    jaw_teeth: dict,
    staging: dict | None,
    attachment_count: int,
    ipr_total: float,
) -> str:
    """Rate treatment difficulty: simple, moderate, complex."""
    score = 0

    # Number of stages
    total_stages = 0
    if staging:
        total_stages = staging.get("total_stages", 0)

    if total_stages > 30:
        score += 3
    elif total_stages > 15:
        score += 2
    elif total_stages > 5:
        score += 1

    # Attachment count
    if attachment_count > 10:
        score += 2
    elif attachment_count > 5:
        score += 1

    # IPR amount
    if ipr_total > 4:
        score += 2
    elif ipr_total > 2:
        score += 1

    # Missing teeth
    expected = 14
    actual = len(jaw_teeth)
    if actual < expected - 2:
        score += 1

    if score >= 5:
        return "complex"
    elif score >= 2:
        return "moderate"
    return "simple"
