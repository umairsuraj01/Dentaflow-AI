# analysis.py — Dental analysis API endpoints.
#
# Provides occlusal plane detection, space analysis, Bolton analysis,
# arch form analysis, overjet/overbite, and midline assessment.

from __future__ import annotations

from pathlib import Path
from dataclasses import asdict

from fastapi import APIRouter, Depends
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession

from app.database.connection import get_db
from app.middleware.auth_middleware import get_current_user
from app.models.user import User
from app.schemas.common import ApiResponse

router = APIRouter(prefix="/ai", tags=["Dental Analysis"])


class AnalyzeRequest(BaseModel):
    file_path: str
    jaw: str | None = None  # "upper" or "lower", auto-detected if None
    extraction_id: str | None = None  # reuse teeth from Step 2 extraction


class DualArchAnalyzeRequest(BaseModel):
    upper_file_path: str
    lower_file_path: str


@router.post("/analyze", response_model=ApiResponse[dict])
async def analyze_arch(
    data: AnalyzeRequest,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> ApiResponse[dict]:
    """Run dental analysis on a single arch.

    Returns: space analysis, arch form, tooth measurements, occlusal plane.
    """
    try:
        from ai.analysis.occlusal_plane import detect_occlusal_plane
        from ai.analysis.dental_analysis import run_full_analysis

        # Use cached extraction from Step 2 if available, else run pipeline
        tooth_data, jaw, teeth_found = _get_tooth_data_and_jaw(data)

        # Occlusal plane
        plane = detect_occlusal_plane(tooth_data, jaw=jaw)

        # Dental analysis (single arch)
        analysis = run_full_analysis(tooth_data, jaw=jaw)

        return ApiResponse(
            success=True,
            message="Dental analysis complete",
            data={
                "jaw": jaw,
                "teeth_found": teeth_found,
                "occlusal_plane": asdict(plane),
                "tooth_measurements": [asdict(m) for m in analysis.tooth_measurements],
                "space_analysis": asdict(analysis.space_analysis) if analysis.space_analysis else None,
                "arch_form": _arch_form_to_dict(analysis.arch_form) if analysis.arch_form else None,
                "midline": asdict(analysis.midline) if analysis.midline else None,
                "confidence_scores": {},
            },
        )
    except Exception as exc:
        import traceback
        return ApiResponse(
            success=False,
            message=f"Analysis failed: {exc}",
            data={"traceback": traceback.format_exc()},
        )


@router.post("/analyze-dual", response_model=ApiResponse[dict])
async def analyze_dual_arch(
    data: DualArchAnalyzeRequest,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> ApiResponse[dict]:
    """Run dental analysis on both arches.

    Returns: all single-arch analyses plus Bolton, overjet/overbite, midline.
    """
    try:
        from ai.pipeline.pipeline_manager import run_full_pipeline
        from ai.utils.tooth_extractor import extract_tooth_meshes
        from ai.data.mesh_loader import load_mesh
        from ai.analysis.occlusal_plane import detect_occlusal_plane
        from ai.analysis.dental_analysis import run_full_analysis

        # Process upper arch
        upper_output = run_full_pipeline(file_path=data.upper_file_path, jaw="upper")
        upper_mesh = load_mesh(data.upper_file_path)
        upper_tooth_meshes = extract_tooth_meshes(
            upper_mesh, upper_output.face_labels, jaw="upper"
        )
        upper_data = _tooth_meshes_to_dict(upper_tooth_meshes)

        # Process lower arch
        lower_output = run_full_pipeline(file_path=data.lower_file_path, jaw="lower")
        lower_mesh = load_mesh(data.lower_file_path)
        lower_tooth_meshes = extract_tooth_meshes(
            lower_mesh, lower_output.face_labels, jaw="lower"
        )
        lower_data = _tooth_meshes_to_dict(lower_tooth_meshes)

        # Occlusal planes
        upper_plane = detect_occlusal_plane(upper_data, jaw="upper")
        lower_plane = detect_occlusal_plane(lower_data, jaw="lower")

        # Full analysis (upper as primary, lower as opposite)
        upper_analysis = run_full_analysis(
            upper_data, jaw="upper",
            opposite_tooth_data=lower_data, opposite_jaw="lower",
        )
        lower_analysis = run_full_analysis(
            lower_data, jaw="lower",
            opposite_tooth_data=upper_data, opposite_jaw="upper",
        )

        return ApiResponse(
            success=True,
            message="Dual-arch analysis complete",
            data={
                "upper": {
                    "teeth_found": upper_output.teeth_found,
                    "occlusal_plane": asdict(upper_plane),
                    "space_analysis": asdict(upper_analysis.space_analysis) if upper_analysis.space_analysis else None,
                    "arch_form": _arch_form_to_dict(upper_analysis.arch_form) if upper_analysis.arch_form else None,
                    "tooth_measurements": [asdict(m) for m in upper_analysis.tooth_measurements],
                },
                "lower": {
                    "teeth_found": lower_output.teeth_found,
                    "occlusal_plane": asdict(lower_plane),
                    "space_analysis": asdict(lower_analysis.space_analysis) if lower_analysis.space_analysis else None,
                    "arch_form": _arch_form_to_dict(lower_analysis.arch_form) if lower_analysis.arch_form else None,
                    "tooth_measurements": [asdict(m) for m in lower_analysis.tooth_measurements],
                },
                "bolton_analysis": asdict(upper_analysis.bolton_analysis) if upper_analysis.bolton_analysis else None,
                "overjet_overbite": asdict(upper_analysis.overjet_overbite) if upper_analysis.overjet_overbite else None,
                "midline": asdict(upper_analysis.midline) if upper_analysis.midline else None,
            },
        )
    except Exception as exc:
        import traceback
        return ApiResponse(
            success=False,
            message=f"Dual-arch analysis failed: {exc}",
            data={"traceback": traceback.format_exc()},
        )


# ---------------------------------------------------------------------------
# Phase C: Collision Detection, Arch Form Snap, IPR Simulation
# ---------------------------------------------------------------------------

class CollisionCheckRequest(BaseModel):
    file_path: str
    jaw: str | None = None
    extraction_id: str | None = None
    transforms: dict[str, dict] | None = None  # {fdi_str: {pos_x, pos_y, pos_z}}


@router.post("/collisions", response_model=ApiResponse[dict])
async def check_collisions(
    data: CollisionCheckRequest,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> ApiResponse[dict]:
    """Detect tooth-tooth collisions, optionally with transforms applied."""
    try:
        from ai.analysis.collision_detection import detect_collisions_bbox

        tooth_data = _get_tooth_data(data.file_path, data.jaw, getattr(data, 'extraction_id', None))
        transforms = None
        if data.transforms:
            transforms = {int(k): v for k, v in data.transforms.items()}

        report = detect_collisions_bbox(tooth_data, transforms)

        return ApiResponse(
            success=True,
            message=f"{report.collision_count} collisions detected",
            data={
                "total_pairs_checked": report.total_pairs_checked,
                "collision_count": report.collision_count,
                "max_overlap_mm": report.max_overlap_mm,
                "collisions": [asdict(c) for c in report.collisions],
            },
        )
    except Exception as exc:
        import traceback
        return ApiResponse(
            success=False, message=f"Collision check failed: {exc}",
            data={"traceback": traceback.format_exc()},
        )


class SnapToArchRequest(BaseModel):
    file_path: str
    jaw: str | None = None
    extraction_id: str | None = None
    arch_type: str = "parabolic"  # "parabolic", "brader", "catenary"
    custom_width: float | None = None
    custom_depth: float | None = None


@router.post("/snap-to-arch", response_model=ApiResponse[dict])
async def snap_to_arch_endpoint(
    data: SnapToArchRequest,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> ApiResponse[dict]:
    """Compute target transforms to snap teeth onto an ideal arch form."""
    try:
        from ai.analysis.arch_form_tool import fit_arch_form, snap_to_arch, generate_arch_curve_points

        tooth_data, jaw = _get_tooth_data_with_jaw(data.file_path, data.jaw, getattr(data, 'extraction_id', None))

        fit = fit_arch_form(
            tooth_data, jaw, data.arch_type,
            data.custom_width, data.custom_depth,
        )
        targets = snap_to_arch(
            tooth_data, jaw, data.arch_type,
            data.custom_width, data.custom_depth,
        )
        curve_points = generate_arch_curve_points(
            data.arch_type, fit.arch_width_mm, fit.arch_depth_mm,
        )

        return ApiResponse(
            success=True,
            message=f"Arch fit: {fit.arch_type}, {len(targets)} teeth need movement",
            data={
                "arch_type": fit.arch_type,
                "jaw": jaw,
                "arch_width_mm": fit.arch_width_mm,
                "arch_depth_mm": fit.arch_depth_mm,
                "fit_error_mm": fit.fit_error_mm,
                "total_movement_mm": fit.total_movement_mm,
                "ideal_positions": {str(k): v for k, v in fit.ideal_positions.items()},
                "required_movements": {str(k): v for k, v in fit.required_movements.items()},
                "targets": {str(k): v for k, v in targets.items()},
                "arch_curve_points": curve_points,
            },
        )
    except Exception as exc:
        import traceback
        return ApiResponse(
            success=False, message=f"Snap-to-arch failed: {exc}",
            data={"traceback": traceback.format_exc()},
        )


class IPRRequest(BaseModel):
    file_path: str
    jaw: str | None = None
    extraction_id: str | None = None
    crowding_mm: float | None = None  # auto-computed if None


@router.post("/ipr-plan", response_model=ApiResponse[dict])
async def compute_ipr(
    data: IPRRequest,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> ApiResponse[dict]:
    """Compute IPR (interproximal reduction) plan for an arch."""
    try:
        from ai.analysis.ipr_simulation import compute_ipr_plan
        from ai.analysis.dental_analysis import measure_teeth, compute_space_analysis

        tooth_data, jaw = _get_tooth_data_with_jaw(data.file_path, data.jaw, getattr(data, 'extraction_id', None))

        # Auto-compute crowding if not provided
        crowding = data.crowding_mm
        if crowding is None:
            measurements = measure_teeth(tooth_data)
            space = compute_space_analysis(measurements, jaw)
            crowding = max(0, -space.discrepancy_mm)  # positive = crowding

        plan = compute_ipr_plan(tooth_data, jaw, crowding)

        return ApiResponse(
            success=True,
            message=f"IPR plan: {plan.total_ipr_mm}mm across {len([c for c in plan.contacts if c.suggested_ipr_mm > 0])} contacts",
            data={
                "jaw": jaw,
                "crowding_mm": plan.crowding_mm,
                "total_ipr_mm": plan.total_ipr_mm,
                "total_space_gained_mm": plan.total_space_gained_mm,
                "ipr_sufficient": plan.ipr_sufficient,
                "warnings": plan.warnings,
                "contacts": [asdict(c) for c in plan.contacts],
            },
        )
    except Exception as exc:
        import traceback
        return ApiResponse(
            success=False, message=f"IPR plan failed: {exc}",
            data={"traceback": traceback.format_exc()},
        )


class InterproximalDistancesRequest(BaseModel):
    file_path: str
    jaw: str | None = None
    extraction_id: str | None = None
    transforms: dict[str, dict] | None = None


@router.post("/interproximal-distances", response_model=ApiResponse[dict])
async def get_interproximal_distances(
    data: InterproximalDistancesRequest,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> ApiResponse[dict]:
    """Get distances between adjacent teeth (for contact analysis)."""
    try:
        from ai.analysis.collision_detection import compute_interproximal_distances

        tooth_data = _get_tooth_data(data.file_path, data.jaw, getattr(data, 'extraction_id', None))
        transforms = None
        if data.transforms:
            transforms = {int(k): v for k, v in data.transforms.items()}

        distances = compute_interproximal_distances(tooth_data, transforms)

        return ApiResponse(
            success=True,
            message=f"Computed {len(distances)} interproximal distances",
            data={"distances": distances},
        )
    except Exception as exc:
        import traceback
        return ApiResponse(
            success=False, message=f"Distance computation failed: {exc}",
            data={"traceback": traceback.format_exc()},
        )


# ---------------------------------------------------------------------------
# Phase D: Smart Staging, Attachments, Validation
# ---------------------------------------------------------------------------

class StagingRequest(BaseModel):
    file_path: str
    jaw: str | None = None
    extraction_id: str | None = None
    targets: dict[str, dict]       # {fdi_str: {"pos_x", "pos_y", "pos_z", "rot_x", "rot_y", "rot_z"}}
    constraints: dict[str, dict] | None = None  # {fdi_str: {"do_not_move", "max_movement_mm", ...}}
    max_translation_per_stage: float | None = None
    max_rotation_per_stage: float | None = None
    easing: str = "linear"         # "linear", "ease_in_out", "ease_in", "ease_out"
    sequencing: str = "simultaneous"  # "simultaneous", "anterior_first", "posterior_first", "leveling_first"
    validate: bool = True


@router.post("/staging-plan", response_model=ApiResponse[dict])
async def compute_staging(
    data: StagingRequest,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> ApiResponse[dict]:
    """Compute treatment stages with collision validation and easing."""
    try:
        from ai.analysis.staging_engine import compute_staging_plan, MovementTarget

        tooth_data, jaw = _get_tooth_data_with_jaw(data.file_path, data.jaw, getattr(data, 'extraction_id', None))
        constraints = data.constraints or {}

        targets = []
        for fdi_str, t in data.targets.items():
            fdi = int(fdi_str)
            c = constraints.get(fdi_str, {})
            targets.append(MovementTarget(
                fdi=fdi,
                pos_x=t.get("pos_x", 0), pos_y=t.get("pos_y", 0), pos_z=t.get("pos_z", 0),
                rot_x=t.get("rot_x", 0), rot_y=t.get("rot_y", 0), rot_z=t.get("rot_z", 0),
                do_not_move=c.get("do_not_move", False),
                max_movement_mm=c.get("max_movement_mm"),
                sensitive_root=c.get("sensitive_root", False),
            ))

        plan = compute_staging_plan(
            tooth_data, targets, jaw,
            max_translation=data.max_translation_per_stage or 0.25,
            max_rotation=data.max_rotation_per_stage or 2.0,
            easing=data.easing,
            validate=data.validate,
            sequencing=data.sequencing,
        )

        # Serialize stages
        stages_out = []
        for s in plan.stages:
            stages_out.append({
                "stage_index": s.stage_index,
                "label": s.label,
                "transforms": {str(k): v for k, v in s.transforms.items()},
            })

        # Serialize validation
        validation_out = None
        if plan.validation:
            v = plan.validation
            validation_out = {
                "is_feasible": v.is_feasible,
                "stages_valid": v.stages_valid,
                "stages_with_errors": v.stages_with_errors,
                "stages_with_warnings": v.stages_with_warnings,
                "stage_issues": [
                    {
                        "stage_index": sr.stage_index,
                        "collision_count": sr.collision_count,
                        "issues": [
                            {"severity": i.severity, "category": i.category, "fdi": i.fdi, "message": i.message}
                            for i in sr.issues
                        ],
                    }
                    for sr in v.stage_results if sr.issues
                ],
            }

        return ApiResponse(
            success=True,
            message=f"Staging plan: {plan.total_stages} stages for {len(targets)} teeth",
            data={
                "total_stages": plan.total_stages,
                "jaw": jaw,
                "per_tooth_stages": {str(k): v for k, v in plan.per_tooth_stages.items()},
                "stages": stages_out,
                "validation": validation_out,
                "warnings": plan.warnings,
            },
        )
    except Exception as exc:
        import traceback
        return ApiResponse(
            success=False, message=f"Staging plan failed: {exc}",
            data={"traceback": traceback.format_exc()},
        )


class AttachmentRequest(BaseModel):
    file_path: str
    jaw: str | None = None
    extraction_id: str | None = None
    targets: dict[str, dict]  # {fdi_str: {"pos_x", "pos_y", "pos_z", "rot_x", "rot_y", "rot_z"}}


@router.post("/attachments", response_model=ApiResponse[dict])
async def plan_attachments_endpoint(
    data: AttachmentRequest,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> ApiResponse[dict]:
    """Recommend attachment types and positions based on planned movements."""
    try:
        from ai.analysis.attachment_planner import plan_attachments

        tooth_data, jaw = _get_tooth_data_with_jaw(data.file_path, data.jaw, getattr(data, 'extraction_id', None))
        targets = {int(k): v for k, v in data.targets.items()}

        plan = plan_attachments(tooth_data, targets, jaw)

        return ApiResponse(
            success=True,
            message=f"{plan.total_attachments} attachments on {len(plan.teeth_with_attachments)} teeth",
            data={
                "jaw": jaw,
                "total_attachments": plan.total_attachments,
                "teeth_with_attachments": plan.teeth_with_attachments,
                "teeth_without_attachments": plan.teeth_without_attachments,
                "attachments": [asdict(a) for a in plan.attachments],
                "warnings": plan.warnings,
            },
        )
    except Exception as exc:
        import traceback
        return ApiResponse(
            success=False, message=f"Attachment planning failed: {exc}",
            data={"traceback": traceback.format_exc()},
        )


class ValidateStagesRequest(BaseModel):
    file_path: str
    jaw: str | None = None
    extraction_id: str | None = None
    stages: list[dict[str, dict]]  # list of {fdi_str: {"pos_x", ...}}


@router.post("/validate-stages", response_model=ApiResponse[dict])
async def validate_stages_endpoint(
    data: ValidateStagesRequest,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> ApiResponse[dict]:
    """Validate treatment stages for collisions, movement limits, and feasibility."""
    try:
        from ai.analysis.stage_validator import validate_stages

        tooth_data, jaw = _get_tooth_data_with_jaw(data.file_path, data.jaw, getattr(data, 'extraction_id', None))

        # Convert string keys to int
        stages = [{int(k): v for k, v in s.items()} for s in data.stages]

        report = validate_stages(tooth_data, stages, jaw)

        return ApiResponse(
            success=True,
            message=f"Validation: {'feasible' if report.is_feasible else 'NOT feasible'} — "
                    f"{report.stages_valid}/{report.total_stages} stages valid",
            data={
                "is_feasible": report.is_feasible,
                "total_stages": report.total_stages,
                "stages_valid": report.stages_valid,
                "stages_with_errors": report.stages_with_errors,
                "stages_with_warnings": report.stages_with_warnings,
                "stage_results": [
                    {
                        "stage_index": sr.stage_index,
                        "is_valid": sr.is_valid,
                        "collision_count": sr.collision_count,
                        "max_overlap_mm": sr.max_overlap_mm,
                        "issues": [
                            {"severity": i.severity, "category": i.category, "fdi": i.fdi, "message": i.message}
                            for i in sr.issues
                        ],
                    }
                    for sr in report.stage_results
                ],
                "global_issues": [
                    {"severity": i.severity, "category": i.category, "fdi": i.fdi, "message": i.message}
                    for i in report.global_issues
                ],
            },
        )
    except Exception as exc:
        import traceback
        return ApiResponse(
            success=False, message=f"Stage validation failed: {exc}",
            data={"traceback": traceback.format_exc()},
        )


# ---------------------------------------------------------------------------
# Phase E: Doctor Review & Output
# ---------------------------------------------------------------------------

class TreatmentReportRequest(BaseModel):
    file_path: str
    jaw: str | None = None
    extraction_id: str | None = None
    targets: dict[str, dict] | None = None     # movement targets
    constraints: dict[str, dict] | None = None  # tooth constraints
    crowding_mm: float | None = None


@router.post("/treatment-report", response_model=ApiResponse[dict])
async def generate_report(
    data: TreatmentReportRequest,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> ApiResponse[dict]:
    """Generate a comprehensive treatment report with all analyses."""
    try:
        from ai.analysis.dental_analysis import run_full_analysis
        from ai.analysis.treatment_report import generate_treatment_report, report_to_dict

        tooth_data, jaw = _get_tooth_data_with_jaw(data.file_path, data.jaw, getattr(data, 'extraction_id', None))

        # Run dental analysis
        analysis = run_full_analysis(tooth_data, jaw=jaw)
        analysis_dict = {
            "tooth_measurements": [asdict(m) for m in analysis.tooth_measurements],
            "space_analysis": asdict(analysis.space_analysis) if analysis.space_analysis else None,
            "arch_form": _arch_form_to_dict(analysis.arch_form) if analysis.arch_form else None,
            "overjet_overbite": asdict(analysis.overjet_overbite) if analysis.overjet_overbite else None,
            "midline": asdict(analysis.midline) if analysis.midline else None,
        }

        # Optional: compute staging and attachments if targets provided
        staging_dict = None
        attachment_dict = None
        ipr_dict = None

        if data.targets:
            from ai.analysis.staging_engine import compute_staging_plan, MovementTarget
            from ai.analysis.attachment_planner import plan_attachments
            from ai.analysis.ipr_simulation import compute_ipr_plan

            targets_int = {int(k): v for k, v in data.targets.items()}
            constraints = data.constraints or {}

            # Staging
            movement_targets = [
                MovementTarget(
                    fdi=int(fdi_str),
                    pos_x=t.get("pos_x", 0), pos_y=t.get("pos_y", 0), pos_z=t.get("pos_z", 0),
                    rot_x=t.get("rot_x", 0), rot_y=t.get("rot_y", 0), rot_z=t.get("rot_z", 0),
                    do_not_move=constraints.get(fdi_str, {}).get("do_not_move", False),
                )
                for fdi_str, t in data.targets.items()
            ]
            plan = compute_staging_plan(tooth_data, movement_targets, jaw, validate=True)
            staging_dict = {
                "total_stages": plan.total_stages,
                "per_tooth_stages": {str(k): v for k, v in plan.per_tooth_stages.items()},
                "stages": [
                    {"stage_index": s.stage_index, "label": s.label,
                     "transforms": {str(k): v for k, v in s.transforms.items()}}
                    for s in plan.stages
                ],
                "warnings": plan.warnings,
                "validation": {
                    "is_feasible": plan.validation.is_feasible,
                    "stages_with_errors": plan.validation.stages_with_errors,
                } if plan.validation else None,
            }

            # Attachments
            att_plan = plan_attachments(tooth_data, targets_int, jaw)
            attachment_dict = {
                "total_attachments": att_plan.total_attachments,
                "teeth_with_attachments": att_plan.teeth_with_attachments,
                "attachments": [asdict(a) for a in att_plan.attachments],
                "warnings": att_plan.warnings,
            }

            # IPR
            crowding = data.crowding_mm
            if crowding is None and analysis.space_analysis:
                crowding = max(0, -analysis.space_analysis.discrepancy_mm)
            ipr = compute_ipr_plan(tooth_data, jaw, crowding or 0)
            ipr_dict = {
                "total_ipr_mm": ipr.total_ipr_mm,
                "ipr_sufficient": ipr.ipr_sufficient,
                "contacts": [asdict(c) for c in ipr.contacts],
                "warnings": ipr.warnings,
            }

        report = generate_treatment_report(
            tooth_data, jaw,
            analysis_results=analysis_dict,
            staging_plan=staging_dict,
            attachment_plan=attachment_dict,
            ipr_plan=ipr_dict,
        )

        return ApiResponse(
            success=True,
            message=f"Treatment report generated: {report.difficulty_rating} case",
            data=report_to_dict(report),
        )
    except Exception as exc:
        import traceback
        return ApiResponse(
            success=False, message=f"Report generation failed: {exc}",
            data={"traceback": traceback.format_exc()},
        )


class ClinicalSummaryRequest(BaseModel):
    file_path: str
    jaw: str | None = None
    extraction_id: str | None = None
    targets: dict[str, dict] | None = None
    crowding_mm: float | None = None
    format: str = "json"  # "json" or "text"


@router.post("/clinical-summary", response_model=ApiResponse[dict])
async def get_clinical_summary(
    data: ClinicalSummaryRequest,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> ApiResponse[dict]:
    """Generate a clinical summary for doctor review."""
    try:
        from ai.analysis.dental_analysis import run_full_analysis
        from ai.analysis.treatment_summary import generate_clinical_summary, summary_to_text

        tooth_data, jaw = _get_tooth_data_with_jaw(data.file_path, data.jaw, getattr(data, 'extraction_id', None))

        analysis = run_full_analysis(tooth_data, jaw=jaw)
        analysis_dict = {
            "space_analysis": asdict(analysis.space_analysis) if analysis.space_analysis else None,
            "arch_form": _arch_form_to_dict(analysis.arch_form) if analysis.arch_form else None,
            "bolton_analysis": asdict(analysis.bolton_analysis) if analysis.bolton_analysis else None,
            "overjet_overbite": asdict(analysis.overjet_overbite) if analysis.overjet_overbite else None,
            "midline": asdict(analysis.midline) if analysis.midline else None,
        }

        summary = generate_clinical_summary(
            tooth_data, jaw, analysis_results=analysis_dict,
        )

        result = {
            "title": summary.title,
            "jaw": summary.jaw,
            "overall_assessment": summary.overall_assessment,
            "treatment_goals": summary.treatment_goals,
            "estimated_duration": summary.estimated_duration,
            "complexity": summary.complexity,
            "sections": [
                {"heading": s.heading, "content": s.content, "findings": s.findings}
                for s in summary.sections
            ],
        }

        if data.format == "text":
            result["text"] = summary_to_text(summary)

        return ApiResponse(
            success=True,
            message=f"Clinical summary: {summary.complexity}",
            data=result,
        )
    except Exception as exc:
        import traceback
        return ApiResponse(
            success=False, message=f"Clinical summary failed: {exc}",
            data={"traceback": traceback.format_exc()},
        )


class StageExportRequest(BaseModel):
    file_path: str
    jaw: str | None = None
    extraction_id: str | None = None
    stages: list[dict[str, dict]]  # list of {fdi_str: {"pos_x", ...}}
    stage_indices: list[int] | None = None  # export only specific stages


@router.post("/export-stage-summary", response_model=ApiResponse[dict])
async def export_stage_summary_endpoint(
    data: StageExportRequest,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> ApiResponse[dict]:
    """Export stage transform summary (lightweight, no STL data)."""
    try:
        from ai.analysis.stage_exporter import export_stage_summary

        _, jaw = _get_tooth_data_with_jaw(data.file_path, data.jaw, getattr(data, 'extraction_id', None))

        stages = [{int(k): v for k, v in s.items()} for s in data.stages]
        summary = export_stage_summary(stages, jaw)

        return ApiResponse(
            success=True,
            message=f"Stage summary: {summary['total_stages']} stages",
            data=summary,
        )
    except Exception as exc:
        import traceback
        return ApiResponse(
            success=False, message=f"Stage export failed: {exc}",
            data={"traceback": traceback.format_exc()},
        )


class TransformMatricesRequest(BaseModel):
    stages: list[dict[str, dict]]  # list of {fdi_str: {"pos_x", ...}}


@router.post("/transform-matrices", response_model=ApiResponse[dict])
async def get_transform_matrices(
    data: TransformMatricesRequest,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> ApiResponse[dict]:
    """Get 4x4 transformation matrices for frontend Three.js rendering."""
    try:
        from ai.analysis.stage_exporter import compute_transform_matrices

        stages = [{int(k): v for k, v in s.items()} for s in data.stages]
        matrices = compute_transform_matrices(stages)

        # Convert int keys to strings for JSON
        result = [
            {str(fdi): mat for fdi, mat in stage.items()}
            for stage in matrices
        ]

        return ApiResponse(
            success=True,
            message=f"Transform matrices for {len(stages)} stages",
            data={"stages": result},
        )
    except Exception as exc:
        import traceback
        return ApiResponse(
            success=False, message=f"Transform matrix computation failed: {exc}",
            data={"traceback": traceback.format_exc()},
        )


# ---------------------------------------------------------------------------
# Shared helpers
# ---------------------------------------------------------------------------

# Cache for extracted tooth data to avoid re-running segmentation
_tooth_data_cache: dict[str, tuple[dict, str]] = {}


def _get_tooth_data(
    file_path: str,
    jaw: str | None = None,
    extraction_id: str | None = None,
) -> dict[int, dict]:
    """Get tooth data (with caching) for analysis endpoints."""
    tooth_data, _ = _get_tooth_data_with_jaw(file_path, jaw, extraction_id)
    return tooth_data


def _get_tooth_data_with_jaw(
    file_path: str,
    jaw: str | None = None,
    extraction_id: str | None = None,
) -> tuple[dict[int, dict], str]:
    """Get tooth data and jaw type.

    If extraction_id is provided, loads from cached extraction (Step 2 results).
    Otherwise falls back to running the full pipeline from scratch.
    """
    # Prefer extraction_id — reuses user-approved segmentation from Step 2
    if extraction_id:
        tooth_data = _load_tooth_data_from_extraction(extraction_id)
        return tooth_data, jaw or "upper"

    cache_key = f"{file_path}:{jaw}"
    if cache_key in _tooth_data_cache:
        return _tooth_data_cache[cache_key]

    from ai.pipeline.pipeline_manager import run_full_pipeline
    from ai.utils.tooth_extractor import extract_tooth_meshes
    from ai.data.mesh_loader import load_mesh

    output = run_full_pipeline(file_path=file_path, jaw=jaw)
    mesh = load_mesh(file_path)
    tooth_meshes = extract_tooth_meshes(mesh, output.face_labels, jaw=output.jaw)
    tooth_data = _tooth_meshes_to_dict(tooth_meshes)
    detected_jaw = output.jaw

    _tooth_data_cache[cache_key] = (tooth_data, detected_jaw)
    return tooth_data, detected_jaw


def _tooth_meshes_to_dict(tooth_meshes) -> dict[int, dict]:
    """Convert ToothMeshData objects to plain dicts for analysis functions."""
    return {
        fdi: {
            "centroid": td.centroid,
            "bbox_min": td.bbox_min,
            "bbox_max": td.bbox_max,
        }
        for fdi, td in tooth_meshes.items()
    }


_TEETH_CACHE_DIR = Path("/tmp/dentaflow-teeth")


def _extract_centroids_and_widths(
    tooth_data: dict[int, dict],
) -> tuple[dict[int, list[float]], dict[int, float]]:
    """Extract centroid positions and approximate widths from tooth_data.

    Returns (centroids, widths) dicts keyed by FDI.
    """
    centroids: dict[int, list[float]] = {}
    widths: dict[int, float] = {}
    for fdi, td in tooth_data.items():
        if fdi == 0:
            continue
        centroids[fdi] = td["centroid"]
        # Width from bounding box mesiodistal extent (x-axis)
        bmin, bmax = td.get("bbox_min", [0, 0, 0]), td.get("bbox_max", [0, 0, 0])
        widths[fdi] = abs(bmax[0] - bmin[0])
    return centroids, widths


def _load_tooth_data_from_extraction(extraction_id: str) -> dict[int, dict]:
    """Load tooth data (centroid, bbox) from a cached extraction directory.

    This reuses the teeth extracted in Step 2 (Review & Edit) so that
    subsequent analysis steps use the same segmentation the user approved.
    """
    import trimesh
    cache_dir = _TEETH_CACHE_DIR / extraction_id
    if not cache_dir.exists():
        raise ValueError(f"Extraction cache not found: {extraction_id}")

    tooth_data: dict[int, dict] = {}
    for stl_file in cache_dir.glob("*.stl"):
        fdi = int(stl_file.stem)
        if fdi == 0:
            continue  # skip gum mesh
        mesh = trimesh.load(str(stl_file))
        centroid = mesh.centroid.tolist()
        bbox_min = mesh.bounds[0].tolist()
        bbox_max = mesh.bounds[1].tolist()
        tooth_data[fdi] = {
            "centroid": centroid,
            "bbox_min": bbox_min,
            "bbox_max": bbox_max,
        }

    if not tooth_data:
        raise ValueError(f"No tooth meshes found in extraction: {extraction_id}")

    return tooth_data


def _get_tooth_data_and_jaw(data) -> tuple[dict[int, dict], str, list[int]]:
    """Get tooth_data and jaw from either extraction_id or by running pipeline.

    Returns (tooth_data, jaw, teeth_found).
    """
    if data.extraction_id:
        tooth_data = _load_tooth_data_from_extraction(data.extraction_id)
        jaw = data.jaw or "upper"
        teeth_found = sorted(tooth_data.keys())
        return tooth_data, jaw, teeth_found

    # Fallback: run full pipeline from scratch
    from ai.pipeline.pipeline_manager import run_full_pipeline
    from ai.utils.tooth_extractor import extract_tooth_meshes
    from ai.data.mesh_loader import load_mesh

    output = run_full_pipeline(file_path=data.file_path, jaw=data.jaw)
    mesh = load_mesh(data.file_path)
    tooth_meshes = extract_tooth_meshes(mesh, output.face_labels, jaw=output.jaw)
    tooth_data = _tooth_meshes_to_dict(tooth_meshes)
    return tooth_data, output.jaw, output.teeth_found


def _arch_form_to_dict(af) -> dict:
    """Convert ArchFormAnalysis to dict, serializing numpy arrays."""
    d = asdict(af)
    # tooth_positions keys are ints, JSON needs strings
    d["tooth_positions"] = {str(k): v for k, v in d["tooth_positions"].items()}
    return d


# ---------------------------------------------------------------------------
# Phase 6: Base Generation
# ---------------------------------------------------------------------------

class BaseGenerationRequest(BaseModel):
    file_path: str
    jaw: str | None = None
    extraction_id: str | None = None
    base_shape: str = "horseshoe"  # horseshoe, rectangular, rounded
    base_height_mm: float = 15.0
    base_thickness_mm: float = 5.0
    margin_mm: float = 3.0
    add_label_area: bool = True


@router.post("/generate-base", response_model=ApiResponse[dict])
async def generate_base_endpoint(
    data: BaseGenerationRequest,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> ApiResponse[dict]:
    """Generate a model base for 3D printing or articulator mounting (Phase 6)."""
    try:
        import trimesh
        import numpy as np
        from ai.pipeline.base_generator import (
            generate_base, BaseParameters, BaseShape,
        )
        from ai.pipeline.cast_trimmer import trim_cast

        # Load face_labels from extraction cache if available
        face_labels = None
        jaw = data.jaw
        _TEETH_CACHE = Path("/tmp/dentaflow-teeth")
        if data.extraction_id:
            cache_dir = _TEETH_CACHE / data.extraction_id
            labels_path = cache_dir / "face_labels.npy"
            jaw_path = cache_dir / "jaw.txt"
            if labels_path.exists():
                face_labels = np.load(str(labels_path))
                if jaw_path.exists() and not jaw:
                    jaw = jaw_path.read_text().strip()

        if face_labels is None:
            from ai.pipeline.pipeline_manager import run_full_pipeline
            output = run_full_pipeline(file_path=data.file_path, jaw=data.jaw)
            face_labels = output.face_labels
            jaw = output.jaw

        trim_result = trim_cast(
            stl_path=data.file_path,
            face_labels=face_labels,
            jaw=jaw or "upper",
        )

        cast_mesh = trimesh.load(trimesh.util.wrap_as_stream(trim_result.trimmed_stl_bytes), file_type="stl")

        shape_map = {
            "horseshoe": BaseShape.HORSESHOE,
            "rectangular": BaseShape.RECTANGULAR,
            "rounded": BaseShape.ROUNDED,
        }
        params = BaseParameters(
            shape=shape_map.get(data.base_shape, BaseShape.HORSESHOE),
            height_mm=data.base_height_mm,
            thickness_mm=data.base_thickness_mm,
            margin_mm=data.margin_mm,
            add_label_area=data.add_label_area,
        )

        result = generate_base(cast_mesh, jaw=jaw or "upper", params=params)

        # Save base mesh for 3D viewer download
        import tempfile
        base_file_path = None
        combined_file_path = None
        if result.base_mesh is not None:
            base_dir = Path(tempfile.mkdtemp())
            base_path = base_dir / "base.stl"
            result.base_mesh.export(str(base_path))
            base_file_path = str(base_path)

            # Also save combined (cast + base) mesh
            if result.combined_mesh is not None:
                combined_path = base_dir / "combined.stl"
                result.combined_mesh.export(str(combined_path))
                combined_file_path = str(combined_path)

        return ApiResponse(
            success=True,
            message=f"Base generated ({data.base_shape})",
            data={
                "arch_width_mm": result.arch_width_mm,
                "arch_depth_mm": result.arch_depth_mm,
                "base_width_mm": result.base_width_mm,
                "base_depth_mm": result.base_depth_mm,
                "base_height_mm": result.base_height_mm,
                "base_shape": result.base_shape,
                "processing_time": result.processing_time_seconds,
                "jaw": result.jaw,
                "base_file_path": base_file_path,
                "combined_file_path": combined_file_path,
            },
        )
    except Exception as exc:
        import traceback
        return ApiResponse(
            success=False,
            message=f"Base generation failed: {exc}",
            data={"traceback": traceback.format_exc()},
        )


# ---------------------------------------------------------------------------
# Phase 8: Movement Protocol & Distance Protocol
# ---------------------------------------------------------------------------

class MovementProtocolRequest(BaseModel):
    file_path: str
    jaw: str | None = None
    extraction_id: str | None = None
    targets: dict[str, dict[str, float]] | None = None  # {fdi: {pos_x, pos_y, pos_z, rot_x, rot_y, rot_z}}


@router.post("/movement-protocol", response_model=ApiResponse[dict])
async def movement_protocol_endpoint(
    data: MovementProtocolRequest,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> ApiResponse[dict]:
    """Generate per-tooth movement protocol table (Phase 8)."""
    try:
        from ai.pipeline.protocol_tables import generate_movement_protocol

        # Build start/end poses from targets
        start_poses: dict[int, list[float]] = {}
        end_poses: dict[int, list[float]] = {}

        tooth_data, jaw = _get_tooth_data_with_jaw(
            data.file_path, data.jaw, getattr(data, 'extraction_id', None)
        )
        centroids, _ = _extract_centroids_and_widths(tooth_data)

        if data.targets:
            # Use explicit targets provided by user
            for fdi_str, t in data.targets.items():
                fdi = int(fdi_str)
                if fdi in centroids:
                    start_poses[fdi] = centroids[fdi][:3]
                else:
                    start_poses[fdi] = [0.0, 0.0, 0.0]
                end_poses[fdi] = [
                    start_poses[fdi][0] + t.get("pos_x", 0),
                    start_poses[fdi][1] + t.get("pos_y", 0),
                    start_poses[fdi][2] + t.get("pos_z", 0),
                ]
        else:
            # No targets: compute from arch form fitting (ideal vs current positions)
            from ai.analysis.arch_form_tool import fit_arch_form
            arch = fit_arch_form(tooth_data, jaw=jaw or "upper")
            if arch and arch.required_movements:
                for fdi, mv in arch.required_movements.items():
                    fdi_int = int(fdi) if isinstance(fdi, str) else fdi
                    if fdi_int in centroids:
                        c = centroids[fdi_int]
                        start_poses[fdi_int] = c[:3]
                        end_poses[fdi_int] = [
                            c[0] + mv.get("dx", 0),
                            c[1],
                            c[2] + mv.get("dz", 0),
                        ]
            # Fallback: include all teeth with zero movement
            if not start_poses:
                for fdi, c in centroids.items():
                    start_poses[fdi] = c[:3]
                    end_poses[fdi] = c[:3]

        result = generate_movement_protocol(start_poses, end_poses)

        records = []
        for r in result.records:
            records.append({
                "fdi": r.fdi,
                "translation_mm": list(r.translation_mm),
                "rotation_deg": list(r.rotation_deg),
                "total_displacement_mm": r.total_displacement_mm,
                "total_rotation_deg": r.total_rotation_deg,
                "movement_type": r.movement_type,
            })

        return ApiResponse(
            success=True,
            message=f"Movement protocol: {len(records)} teeth",
            data={
                "stage": result.stage,
                "records": records,
                "total_teeth_moving": result.total_teeth_moving,
                "max_displacement_mm": result.max_displacement_mm,
                "max_rotation_deg": result.max_rotation_deg,
            },
        )
    except Exception as exc:
        import traceback
        return ApiResponse(
            success=False,
            message=f"Movement protocol failed: {exc}",
            data={"traceback": traceback.format_exc()},
        )


class DistanceProtocolRequest(BaseModel):
    file_path: str
    jaw: str | None = None
    extraction_id: str | None = None


@router.post("/distance-protocol", response_model=ApiResponse[dict])
async def distance_protocol_endpoint(
    data: DistanceProtocolRequest,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> ApiResponse[dict]:
    """Generate interproximal distance protocol (Phase 8)."""
    try:
        from ai.pipeline.protocol_tables import generate_distance_protocol

        tooth_data, jaw = _get_tooth_data_with_jaw(data.file_path, data.jaw, getattr(data, 'extraction_id', None))
        centroids, _ = _extract_centroids_and_widths(tooth_data)
        result = generate_distance_protocol(centroids, jaw=jaw or "upper")

        records = []
        for r in result.records:
            records.append({
                "fdi_a": r.fdi_a,
                "fdi_b": r.fdi_b,
                "distance_mm": r.distance_mm,
                "measurement_type": r.measurement_type,
            })

        return ApiResponse(
            success=True,
            message=f"Distance protocol: {len(records)} contacts",
            data={
                "records": records,
                "min_interproximal_mm": result.min_interproximal_mm,
                "max_interproximal_mm": result.max_interproximal_mm,
                "mean_interproximal_mm": result.mean_interproximal_mm,
            },
        )
    except Exception as exc:
        import traceback
        return ApiResponse(
            success=False,
            message=f"Distance protocol failed: {exc}",
            data={"traceback": traceback.format_exc()},
        )


class SpaceAnalysisRequest(BaseModel):
    file_path: str
    jaw: str | None = None
    extraction_id: str | None = None


@router.post("/space-analysis-summary", response_model=ApiResponse[dict])
async def space_analysis_summary_endpoint(
    data: SpaceAnalysisRequest,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> ApiResponse[dict]:
    """Generate space analysis summary (Phase 8)."""
    try:
        from ai.pipeline.protocol_tables import generate_space_analysis

        tooth_data, jaw = _get_tooth_data_with_jaw(data.file_path, data.jaw, getattr(data, 'extraction_id', None))
        centroids, widths = _extract_centroids_and_widths(tooth_data)
        result = generate_space_analysis(centroids, widths, jaw=jaw or "upper")

        return ApiResponse(
            success=True,
            message="Space analysis complete",
            data={
                "arch_perimeter_mm": result.arch_perimeter_mm,
                "tooth_material_mm": result.tooth_material_mm,
                "space_available_mm": result.space_available_mm,
                "crowding_mm": result.crowding_mm,
                "spacing_mm": result.spacing_mm,
                "bolton_ratio": result.bolton_ratio,
            },
        )
    except Exception as exc:
        import traceback
        return ApiResponse(
            success=False,
            message=f"Space analysis failed: {exc}",
            data={"traceback": traceback.format_exc()},
        )


# ---------------------------------------------------------------------------
# Phase 9: Gingiva Simulation
# ---------------------------------------------------------------------------

class GingivaSimRequest(BaseModel):
    file_path: str
    jaw: str | None = None
    extraction_id: str | None = None
    targets: dict[str, dict[str, float]] | None = None
    tissue_stiffness: float = 0.5


@router.post("/gingiva-simulation", response_model=ApiResponse[dict])
async def gingiva_simulation_endpoint(
    data: GingivaSimRequest,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> ApiResponse[dict]:
    """Simulate gingiva response to tooth movement (Phase 9)."""
    try:
        import io
        import trimesh
        from ai.pipeline.gingiva_simulator import simulate_gingiva
        import numpy as np

        jaw = data.jaw
        _TEETH_CACHE = Path("/tmp/dentaflow-teeth")

        # Load tooth STL files from extraction cache
        if data.extraction_id:
            cache_dir = _TEETH_CACHE / data.extraction_id
            jaw_path = cache_dir / "jaw.txt"
            if jaw_path.exists() and not jaw:
                jaw = jaw_path.read_text().strip()
        else:
            # Fallback: run pipeline and extract
            from ai.pipeline.pipeline_manager import run_full_pipeline
            from ai.utils.tooth_extractor import extract_tooth_meshes
            from ai.data.mesh_loader import load_mesh
            output = run_full_pipeline(file_path=data.file_path, jaw=data.jaw)
            jaw = output.jaw
            mesh = load_mesh(data.file_path)
            tooth_meshes_raw = extract_tooth_meshes(mesh, output.face_labels, jaw=jaw)
            # Save to temp cache
            from uuid import uuid4
            eid = str(uuid4())
            cache_dir = _TEETH_CACHE / eid
            cache_dir.mkdir(parents=True, exist_ok=True)
            for fdi, td in tooth_meshes_raw.items():
                (cache_dir / f"{fdi}.stl").write_bytes(td.stl_bytes)

        # Load meshes from cache directory
        gum_mesh = None
        tooth_meshes: dict[int, trimesh.Trimesh] = {}
        tooth_centroids: dict[int, list[float]] = {}

        for stl_file in cache_dir.glob("*.stl"):
            fdi = int(stl_file.stem)
            mesh_obj = trimesh.load(str(stl_file), file_type="stl")
            if fdi == 0:
                gum_mesh = mesh_obj
            else:
                tooth_meshes[fdi] = mesh_obj
                tooth_centroids[fdi] = mesh_obj.centroid.tolist()

        if gum_mesh is None:
            return ApiResponse(success=False, message="No gum mesh found in extraction cache", data={})

        # Build moved centroids from targets
        moved_centroids: dict[int, list[float]] = {}
        for fdi, c in tooth_centroids.items():
            if data.targets and str(fdi) in data.targets:
                t = data.targets[str(fdi)]
                moved_centroids[fdi] = [
                    c[0] + t.get("pos_x", 0),
                    c[1] + t.get("pos_y", 0),
                    c[2] + t.get("pos_z", 0),
                ]
            else:
                moved_centroids[fdi] = c

        result = simulate_gingiva(
            gum_mesh=gum_mesh,
            tooth_meshes=tooth_meshes,
            tooth_centroids=tooth_centroids,
            moved_centroids=moved_centroids,
            jaw=jaw or "upper",
            tissue_stiffness=data.tissue_stiffness,
        )

        papillae = []
        for p in result.papillae:
            papillae.append({
                "fdi_mesial": p.fdi_mesial,
                "fdi_distal": p.fdi_distal,
                "height_mm": p.height_mm,
                "width_mm": p.width_mm,
                "black_triangle_risk": p.black_triangle_risk,
            })

        return ApiResponse(
            success=True,
            message=f"Gingiva simulation complete: {len(papillae)} papillae",
            data={
                "papillae": papillae,
                "max_displacement_mm": result.max_displacement_mm,
                "mean_displacement_mm": result.mean_displacement_mm,
                "black_triangle_count": result.black_triangle_count,
                "tissue_health_score": result.tissue_health_score,
                "jaw": result.jaw,
            },
        )
    except Exception as exc:
        import traceback
        return ApiResponse(
            success=False,
            message=f"Gingiva simulation failed: {exc}",
            data={"traceback": traceback.format_exc()},
        )
