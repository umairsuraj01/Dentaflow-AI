# treatment_summary.py — Generate clinical treatment summary text.
#
# Produces a human-readable clinical summary from analysis data,
# suitable for doctor review, patient communication, or medical records.

from __future__ import annotations

import logging
from dataclasses import dataclass

logger = logging.getLogger(__name__)


@dataclass
class ClinicalSummary:
    """Structured clinical summary for treatment review."""
    title: str
    jaw: str
    sections: list[SummarySection]
    overall_assessment: str
    treatment_goals: list[str]
    estimated_duration: str
    complexity: str


@dataclass
class SummarySection:
    """One section of the clinical summary."""
    heading: str
    content: str
    findings: list[str]


def generate_clinical_summary(
    tooth_data: dict[int, dict],
    jaw: str,
    analysis_results: dict | None = None,
    staging_plan: dict | None = None,
    attachment_plan: dict | None = None,
    ipr_plan: dict | None = None,
) -> ClinicalSummary:
    """Generate a clinical summary for doctor review.

    Args:
        tooth_data: {fdi: {"centroid", "bbox_min", "bbox_max"}}
        jaw: "upper" or "lower"
        analysis_results: From run_full_analysis (as dict).
        staging_plan: From compute_staging_plan (as dict).
        attachment_plan: From plan_attachments (as dict).
        ipr_plan: From compute_ipr_plan (as dict).

    Returns:
        ClinicalSummary with all sections.
    """
    from ai.utils.fdi_numbering import get_quadrant

    jaw_label = "Maxillary" if jaw == "upper" else "Mandibular"
    jaw_quadrants = (1, 2) if jaw == "upper" else (3, 4)
    teeth_count = sum(
        1 for fdi in tooth_data
        if fdi != 0 and get_quadrant(fdi) in jaw_quadrants
    )

    sections = []

    # 1. Tooth Inventory
    sections.append(_tooth_inventory_section(tooth_data, jaw, teeth_count))

    # 2. Space Analysis
    if analysis_results:
        space_section = _space_analysis_section(analysis_results)
        if space_section:
            sections.append(space_section)

    # 3. Arch Form
    if analysis_results and analysis_results.get("arch_form"):
        sections.append(_arch_form_section(analysis_results))

    # 4. Bolton Analysis (if dual-arch)
    if analysis_results and analysis_results.get("bolton_analysis"):
        sections.append(_bolton_section(analysis_results))

    # 5. IPR Plan
    if ipr_plan:
        sections.append(_ipr_section(ipr_plan))

    # 6. Staging
    if staging_plan:
        sections.append(_staging_section(staging_plan))

    # 7. Attachments
    if attachment_plan:
        sections.append(_attachment_section(attachment_plan))

    # Overall assessment
    overall = _overall_assessment(analysis_results, staging_plan, ipr_plan, teeth_count)
    goals = _treatment_goals(analysis_results, ipr_plan)
    duration = _estimate_duration(staging_plan)
    complexity = _assess_complexity_label(staging_plan, attachment_plan, ipr_plan)

    return ClinicalSummary(
        title=f"{jaw_label} Arch Treatment Summary",
        jaw=jaw,
        sections=sections,
        overall_assessment=overall,
        treatment_goals=goals,
        estimated_duration=duration,
        complexity=complexity,
    )


def summary_to_text(summary: ClinicalSummary) -> str:
    """Convert ClinicalSummary to plain text for display/export."""
    lines = []
    lines.append(f"{'=' * 60}")
    lines.append(f"  {summary.title}")
    lines.append(f"{'=' * 60}")
    lines.append("")

    for section in summary.sections:
        lines.append(f"## {section.heading}")
        lines.append(section.content)
        for finding in section.findings:
            lines.append(f"  - {finding}")
        lines.append("")

    lines.append("## Overall Assessment")
    lines.append(summary.overall_assessment)
    lines.append("")

    lines.append("## Treatment Goals")
    for i, goal in enumerate(summary.treatment_goals, 1):
        lines.append(f"  {i}. {goal}")
    lines.append("")

    lines.append(f"Estimated Duration: {summary.estimated_duration}")
    lines.append(f"Complexity: {summary.complexity}")
    lines.append(f"{'=' * 60}")

    return "\n".join(lines)


# ---------------------------------------------------------------------------
# Section builders
# ---------------------------------------------------------------------------

def _tooth_inventory_section(
    tooth_data: dict, jaw: str, teeth_count: int,
) -> SummarySection:
    from ai.utils.fdi_numbering import get_tooth_name, get_quadrant

    jaw_quadrants = (1, 2) if jaw == "upper" else (3, 4)
    expected = 14
    missing = expected - teeth_count

    findings = []
    if teeth_count == expected:
        findings.append(f"Full dentition: {teeth_count} teeth present")
    elif missing > 0:
        findings.append(f"{teeth_count} teeth present, {missing} missing")
        present = [
            fdi for fdi in sorted(tooth_data.keys())
            if fdi != 0 and get_quadrant(fdi) in jaw_quadrants
        ]
        findings.append(f"Present: {', '.join(str(f) for f in present)}")

    return SummarySection(
        heading="Tooth Inventory",
        content=f"{teeth_count} of {expected} teeth detected in {'maxillary' if jaw == 'upper' else 'mandibular'} arch.",
        findings=findings,
    )


def _space_analysis_section(analysis: dict) -> SummarySection | None:
    space = analysis.get("space_analysis")
    if not space:
        return None

    disc = space.get("discrepancy_mm", 0)
    severity = space.get("severity", "normal")
    total_width = space.get("total_tooth_width_mm", 0)
    arch_length = space.get("arch_length_mm", 0)

    findings = [
        f"Total tooth width: {total_width:.1f}mm",
        f"Available arch length: {arch_length:.1f}mm",
        f"Discrepancy: {disc:+.1f}mm ({severity})",
    ]

    if disc < -1:
        content = f"Crowding of {abs(disc):.1f}mm detected."
    elif disc > 1:
        content = f"Spacing of {disc:.1f}mm detected."
    else:
        content = "Arch length and tooth size are well-matched."

    return SummarySection(
        heading="Space Analysis",
        content=content,
        findings=findings,
    )


def _arch_form_section(analysis: dict) -> SummarySection:
    af = analysis["arch_form"]
    return SummarySection(
        heading="Arch Form",
        content=f"Arch classified as {af.get('arch_form_type', 'unknown')}.",
        findings=[
            f"Arch width: {af.get('arch_width_mm', 0):.1f}mm",
            f"Arch depth: {af.get('arch_depth_mm', 0):.1f}mm",
        ],
    )


def _bolton_section(analysis: dict) -> SummarySection:
    bolton = analysis["bolton_analysis"]
    return SummarySection(
        heading="Bolton Analysis",
        content=f"Overall ratio: {bolton.get('overall_ratio', 0):.1f}% (ideal: 91.3%).",
        findings=[
            f"Overall: {bolton.get('overall_interpretation', 'N/A')}",
            f"Anterior: {bolton.get('anterior_interpretation', 'N/A')}",
        ],
    )


def _ipr_section(ipr: dict) -> SummarySection:
    total = ipr.get("total_ipr_mm", 0)
    n_contacts = sum(
        1 for c in ipr.get("contacts", [])
        if c.get("suggested_ipr_mm", 0) > 0
    )
    sufficient = ipr.get("ipr_sufficient", True)

    findings = [
        f"Total IPR: {total:.1f}mm across {n_contacts} contacts",
        f"IPR sufficient: {'Yes' if sufficient else 'No'}",
    ]
    for w in ipr.get("warnings", []):
        findings.append(f"Warning: {w}")

    return SummarySection(
        heading="IPR Plan",
        content=f"{'IPR recommended' if total > 0 else 'No IPR needed'}.",
        findings=findings,
    )


def _staging_section(staging: dict) -> SummarySection:
    total = staging.get("total_stages", 0)
    weeks = total * 2

    findings = [
        f"Total stages: {total}",
        f"Estimated duration: {weeks} weeks ({weeks // 4} months)",
    ]
    for w in staging.get("warnings", []):
        findings.append(f"Warning: {w}")

    return SummarySection(
        heading="Treatment Staging",
        content=f"{total} aligner stages planned.",
        findings=findings,
    )


def _attachment_section(attachments: dict) -> SummarySection:
    total = attachments.get("total_attachments", 0)
    teeth = attachments.get("teeth_with_attachments", [])

    findings = [
        f"{total} attachments on {len(teeth)} teeth",
    ]
    if teeth:
        findings.append(f"Teeth with attachments: {', '.join(str(t) for t in teeth)}")

    return SummarySection(
        heading="Attachments",
        content=f"{total} attachments recommended.",
        findings=findings,
    )


# ---------------------------------------------------------------------------
# Assessment helpers
# ---------------------------------------------------------------------------

def _overall_assessment(
    analysis: dict | None,
    staging: dict | None,
    ipr: dict | None,
    teeth_count: int,
) -> str:
    parts = []

    if teeth_count < 12:
        parts.append(f"Partial dentition ({teeth_count} teeth).")

    if analysis:
        space = analysis.get("space_analysis")
        if space:
            disc = space.get("discrepancy_mm", 0)
            if disc < -4:
                parts.append("Significant crowding requiring multi-modal treatment.")
            elif disc < -1:
                parts.append("Mild to moderate crowding treatable with aligners.")
            elif disc > 3:
                parts.append("Generalized spacing present.")
            else:
                parts.append("Arch length adequate.")

    if staging:
        total = staging.get("total_stages", 0)
        if total > 30:
            parts.append("Complex treatment course anticipated.")
        elif total > 10:
            parts.append("Moderate treatment duration.")
        else:
            parts.append("Short treatment course expected.")

    return " ".join(parts) if parts else "Standard aligner treatment indicated."


def _treatment_goals(
    analysis: dict | None,
    ipr: dict | None,
) -> list[str]:
    goals = []

    if analysis:
        space = analysis.get("space_analysis")
        if space and space.get("discrepancy_mm", 0) < -1:
            goals.append("Resolve crowding and achieve proper alignment")
        elif space and space.get("discrepancy_mm", 0) > 1:
            goals.append("Close spaces and achieve proper contacts")

        if analysis.get("overjet_overbite"):
            oj = analysis["overjet_overbite"]
            if oj.get("overjet_mm", 0) > 4:
                goals.append("Reduce overjet to normal range (2-4mm)")
            if abs(oj.get("overbite_mm", 0)) > 4:
                goals.append("Correct overbite to normal range")

        if analysis.get("midline"):
            mid = analysis["midline"]
            if mid.get("deviation_mm", 0) > 2:
                goals.append("Correct midline deviation")

    goals.append("Achieve ideal arch form and interdigitation")

    if ipr and ipr.get("total_ipr_mm", 0) > 0:
        goals.append("Create space through controlled IPR")

    return goals


def _estimate_duration(staging: dict | None) -> str:
    if not staging:
        return "Not determined"
    total = staging.get("total_stages", 0)
    weeks = total * 2
    months = weeks / 4
    return f"~{weeks} weeks ({months:.0f} months) — {total} aligner stages"


def _assess_complexity_label(
    staging: dict | None,
    attachments: dict | None,
    ipr: dict | None,
) -> str:
    score = 0
    if staging:
        total = staging.get("total_stages", 0)
        if total > 30:
            score += 3
        elif total > 15:
            score += 2
        elif total > 5:
            score += 1

    if attachments:
        n = attachments.get("total_attachments", 0)
        if n > 10:
            score += 2
        elif n > 5:
            score += 1

    if ipr:
        total = ipr.get("total_ipr_mm", 0)
        if total > 4:
            score += 2
        elif total > 2:
            score += 1

    if score >= 5:
        return "Complex — experienced practitioner recommended"
    elif score >= 2:
        return "Moderate"
    return "Simple — straightforward aligner case"
