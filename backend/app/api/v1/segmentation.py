# segmentation.py — AI segmentation API endpoints.

from uuid import UUID, uuid4
from pathlib import Path

from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import FileResponse, Response
from sqlalchemy.ext.asyncio import AsyncSession
from pydantic import BaseModel

from app.database.connection import get_db
from app.middleware.auth_middleware import get_current_user, require_roles
from app.constants import UserRole
from app.models.user import User
from app.schemas.common import ApiResponse
from app.schemas.segmentation import (
    AIStatsResponse,
    CorrectionCreate,
    CorrectionResponse,
    ReprocessRequest,
    SegmentationJobStatus,
    SegmentationResultResponse,
)
from app.services.segmentation_service import SegmentationService

router = APIRouter(prefix="/ai", tags=["AI Segmentation"])


# ---------------------------------------------------------------------------
# Run segmentation on local file (dev mode, sync — no Celery/Redis needed)
# Returns face-level data for 3D viewer coloring
# ---------------------------------------------------------------------------

class MeshRepairRequest(BaseModel):
    file_path: str
    fill_holes: bool = True
    remove_islands: bool = True
    remove_spikes: bool = True
    fix_normals: bool = True
    smooth: bool = True
    smooth_iterations: int = 10


@router.post("/repair-mesh", response_model=ApiResponse[dict])
async def repair_mesh_endpoint(
    data: MeshRepairRequest,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> ApiResponse[dict]:
    """Run automatic mesh repair on an STL file.

    Phase 1: Hole filling, island removal, spike removal, normal fixing,
    Taubin smoothing, and quality assessment.
    """
    try:
        from ai.pipeline.mesh_repair import repair_mesh

        result = repair_mesh(
            file_path=data.file_path,
            fill_holes=data.fill_holes,
            remove_islands=data.remove_islands,
            remove_spikes=data.remove_spikes,
            fix_normals=data.fix_normals,
            smooth=data.smooth,
            smooth_iterations=data.smooth_iterations,
        )

        # Save repaired mesh to temp location
        import tempfile
        repaired_path = Path(tempfile.mkdtemp()) / "repaired.stl"
        result.mesh.export(str(repaired_path))

        return ApiResponse(
            success=True,
            message=f"Mesh repaired: {len(result.repairs_applied)} fixes applied",
            data={
                "repaired_file_path": str(repaired_path),
                "repairs_applied": result.repairs_applied,
                "processing_time": result.processing_time_seconds,
                "holes_filled": result.holes_filled,
                "islands_removed": result.islands_removed,
                "spikes_removed": result.spikes_removed,
                "normals_fixed": result.normals_fixed,
                "faces_smoothed": result.faces_smoothed,
                "quality_before": {
                    "score": result.quality_before.quality_score,
                    "is_watertight": result.quality_before.is_watertight,
                    "is_manifold": result.quality_before.is_manifold,
                    "vertex_count": result.quality_before.vertex_count,
                    "face_count": result.quality_before.face_count,
                    "hole_count": result.quality_before.hole_count,
                    "components": result.quality_before.connected_components,
                    "degenerate_faces": result.quality_before.degenerate_face_count,
                    "non_manifold_edges": result.quality_before.non_manifold_edges,
                    "bounding_box": result.quality_before.bounding_box_size,
                    "surface_area": result.quality_before.surface_area,
                    "volume": result.quality_before.volume,
                },
                "quality_after": {
                    "score": result.quality_after.quality_score,
                    "is_watertight": result.quality_after.is_watertight,
                    "is_manifold": result.quality_after.is_manifold,
                    "vertex_count": result.quality_after.vertex_count,
                    "face_count": result.quality_after.face_count,
                    "hole_count": result.quality_after.hole_count,
                    "components": result.quality_after.connected_components,
                    "degenerate_faces": result.quality_after.degenerate_face_count,
                    "non_manifold_edges": result.quality_after.non_manifold_edges,
                    "bounding_box": result.quality_after.bounding_box_size,
                    "surface_area": result.quality_after.surface_area,
                    "volume": result.quality_after.volume,
                },
            },
        )
    except Exception as exc:
        import traceback
        return ApiResponse(
            success=False,
            message=f"Mesh repair failed: {exc}",
            data={"traceback": traceback.format_exc()},
        )


class CenterPointRequest(BaseModel):
    file_path: str
    jaw: str | None = None


@router.post("/center-points", response_model=ApiResponse[dict])
async def detect_center_points_endpoint(
    data: CenterPointRequest,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> ApiResponse[dict]:
    """Run segmentation + center point detection on an STL file.

    Phase 3: Detects tooth center points, crown tips, missing teeth,
    overbite classification, and arch metrics.
    """
    try:
        from ai.pipeline.pipeline_manager import run_full_pipeline
        from ai.pipeline.center_point_detector import detect_center_points

        # Step 1: Segmentation
        output = run_full_pipeline(file_path=data.file_path, jaw=data.jaw)

        # Step 2: Center point detection
        result = detect_center_points(
            stl_path=data.file_path,
            face_labels=output.face_labels,
            face_probs=output.face_probs,
            jaw=output.jaw,
        )

        return ApiResponse(
            success=True,
            message=f"Detected {len(result.teeth_detected)} tooth center points",
            data={
                "jaw": result.jaw,
                "teeth_detected": result.teeth_detected,
                "teeth_expected": result.teeth_expected,
                "center_points": {
                    str(fdi): {
                        "fdi": cp.fdi,
                        "centroid": cp.centroid,
                        "crown_tip": cp.crown_tip,
                        "buccal_point": cp.buccal_point,
                        "face_count": cp.face_count,
                        "confidence": cp.confidence,
                        "surface_area": cp.surface_area,
                    }
                    for fdi, cp in result.center_points.items()
                },
                "missing_teeth": [
                    {
                        "fdi": mt.fdi,
                        "expected_position": mt.expected_position,
                        "gap_width_mm": mt.gap_width_mm,
                        "mesial_neighbor": mt.mesial_neighbor,
                        "distal_neighbor": mt.distal_neighbor,
                    }
                    for mt in result.missing_teeth
                ],
                "overbite": {
                    "type": result.overbite.type,
                    "measurement_mm": result.overbite.measurement_mm,
                    "description": result.overbite.description,
                } if result.overbite else None,
                "arch_centroid": result.arch_centroid,
                "arch_width_mm": result.arch_width_mm,
                "arch_depth_mm": result.arch_depth_mm,
            },
        )
    except Exception as exc:
        import traceback
        return ApiResponse(
            success=False,
            message=f"Center point detection failed: {exc}",
            data={"traceback": traceback.format_exc()},
        )


class CastTrimRequest(BaseModel):
    file_path: str
    jaw: str | None = None
    extraction_id: str | None = None
    offset_mm: float = 2.0
    smooth_trim_line: bool = True
    flatten_base: bool = True
    base_thickness_mm: float = 3.0


@router.post("/trim-cast", response_model=ApiResponse[dict])
async def trim_cast_endpoint(
    data: CastTrimRequest,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> ApiResponse[dict]:
    """Run segmentation + cast trimming on an STL file.

    Phase 5: Detects arch boundary, generates trim line, trims model,
    and optionally flattens the base.
    """
    try:
        from ai.pipeline.cast_trimmer import trim_cast
        import numpy as np
        import tempfile

        # Load face_labels from extraction cache if available
        face_labels = None
        jaw = data.jaw
        if data.extraction_id:
            cache_dir = _TEETH_CACHE_DIR / data.extraction_id
            labels_path = cache_dir / "face_labels.npy"
            jaw_path = cache_dir / "jaw.txt"
            if labels_path.exists():
                face_labels = np.load(str(labels_path))
                if jaw_path.exists() and not jaw:
                    jaw = jaw_path.read_text().strip()

        if face_labels is None:
            # Fallback: run full pipeline
            from ai.pipeline.pipeline_manager import run_full_pipeline
            output = run_full_pipeline(file_path=data.file_path, jaw=data.jaw)
            face_labels = output.face_labels
            jaw = output.jaw

        # Cast trimming
        result = trim_cast(
            stl_path=data.file_path,
            face_labels=face_labels,
            jaw=jaw or "upper",
            offset_mm=data.offset_mm,
            smooth_trim_line=data.smooth_trim_line,
            flatten_base=data.flatten_base,
            base_thickness_mm=data.base_thickness_mm,
        )

        # Save trimmed mesh
        trimmed_path = Path(tempfile.mkdtemp()) / "trimmed.stl"
        trimmed_path.write_bytes(result.trimmed_stl_bytes)

        return ApiResponse(
            success=True,
            message=f"Cast trimmed: {result.faces_removed} faces removed",
            data={
                "trimmed_file_path": str(trimmed_path),
                "faces_removed": result.faces_removed,
                "faces_kept": result.faces_kept,
                "original_face_count": result.original_face_count,
                "base_flattened": result.base_flattened,
                "processing_time": result.processing_time_seconds,
                "jaw": result.jaw,
                "trim_plane": {
                    "origin": result.trim_plane.origin,
                    "normal": result.trim_plane.normal,
                    "offset_mm": result.trim_plane.offset_mm,
                },
                "trim_line_point_count": len(result.trim_line_points),
            },
        )
    except Exception as exc:
        import traceback
        return ApiResponse(
            success=False,
            message=f"Cast trimming failed: {exc}",
            data={"traceback": traceback.format_exc()},
        )


class PrintValidateRequest(BaseModel):
    file_path: str


@router.post("/validate-print", response_model=ApiResponse[dict])
async def validate_print_endpoint(
    data: PrintValidateRequest,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> ApiResponse[dict]:
    """Validate a mesh for 3D printing (Phase 10)."""
    try:
        import trimesh
        from ai.pipeline.print_exporter import validate_for_printing

        mesh = trimesh.load(data.file_path)
        result = validate_for_printing(mesh)

        return ApiResponse(
            success=True,
            message="Print validation complete",
            data={
                "is_watertight": result.is_watertight,
                "is_manifold": result.is_manifold,
                "has_degenerate_faces": result.has_degenerate_faces,
                "degenerate_face_count": result.degenerate_face_count,
                "min_wall_thickness_mm": result.min_wall_thickness_mm,
                "volume_mm3": result.volume_mm3,
                "surface_area_mm2": result.surface_area_mm2,
                "bounding_box_mm": list(result.bounding_box_mm),
                "face_count": result.face_count,
                "vertex_count": result.vertex_count,
                "is_printable": result.is_printable,
                "issues": result.issues,
            },
        )
    except Exception as exc:
        import traceback
        return ApiResponse(
            success=False,
            message=f"Print validation failed: {exc}",
            data={"traceback": traceback.format_exc()},
        )


class SupportEstimateRequest(BaseModel):
    file_path: str
    orientation: str = "occlusal_up"


@router.post("/estimate-supports", response_model=ApiResponse[dict])
async def estimate_supports_endpoint(
    data: SupportEstimateRequest,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> ApiResponse[dict]:
    """Estimate support material for 3D printing (Phase 10)."""
    try:
        import trimesh
        from ai.pipeline.print_exporter import estimate_supports, PrintOrientation

        mesh = trimesh.load(data.file_path)
        orientation = PrintOrientation(data.orientation)
        result = estimate_supports(mesh, orientation=orientation)

        return ApiResponse(
            success=True,
            message="Support estimation complete",
            data={
                "support_volume_mm3": result.support_volume_mm3,
                "overhang_area_mm2": result.overhang_area_mm2,
                "overhang_face_count": result.overhang_face_count,
                "support_percentage": result.support_percentage,
                "recommended_orientation": result.recommended_orientation,
            },
        )
    except Exception as exc:
        import traceback
        return ApiResponse(
            success=False,
            message=f"Support estimation failed: {exc}",
            data={"traceback": traceback.format_exc()},
        )


class SegmentLocalRequest(BaseModel):
    file_path: str
    jaw: str | None = None  # "upper" or "lower", auto-detected if None


@router.post("/segment", response_model=ApiResponse[dict])
async def segment_file(
    data: SegmentLocalRequest,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> ApiResponse[dict]:
    """Run AI segmentation on a file and return face-level color data."""
    try:
        from ai.pipeline.pipeline_manager import run_full_pipeline
        from ai.utils.fdi_numbering import class_to_fdi, get_tooth_name
        from ai.utils.visualization import get_fdi_color_map

        output = run_full_pipeline(
            file_path=data.file_path,
            jaw=data.jaw,
        )

        # Build per-face FDI numbers (for click-to-select)
        face_fdi = [
            int(class_to_fdi(int(l), jaw=output.jaw))
            for l in output.face_labels
        ]

        return ApiResponse(
            success=True,
            message="Segmentation complete",
            data={
                "teeth_found": output.teeth_found,
                "total_faces": output.total_faces,
                "total_points": output.total_faces * 3,  # STL: 3 vertices per face
                "processing_time": output.processing_time_seconds,
                "model_version": output.model_version,
                "confidence_scores": {str(k): v for k, v in output.confidence_scores.items()},
                "jaw": output.jaw,
                "face_labels": face_fdi,
                "fdi_color_map": get_fdi_color_map(),
                "fdi_name_map": {
                    fdi: get_tooth_name(fdi) for fdi in output.teeth_found
                },
                "restricted_fdi": [],
                "overridden_count": 0,
            },
        )
    except Exception as exc:
        import traceback
        return ApiResponse(
            success=False,
            message=f"Segmentation failed: {exc}",
            data={"traceback": traceback.format_exc()},
        )


# ---------------------------------------------------------------------------
# Serve local STL files for the 3D viewer (dev mode)
# ---------------------------------------------------------------------------

@router.get("/serve-file")
async def serve_local_file(
    path: str = Query(...),
    user: User = Depends(get_current_user),
) -> FileResponse:
    """DEV ONLY: Serve a local file for the 3D viewer."""
    from app.config import get_settings
    settings = get_settings()
    if settings.environment != "development":
        raise Exception("Only available in dev mode")
    file_path = Path(path)
    if not file_path.exists():
        raise Exception(f"File not found: {path}")
    media_type = "application/octet-stream"
    if file_path.suffix.lower() == ".stl":
        media_type = "model/stl"
    return FileResponse(str(file_path), media_type=media_type)


# ---------------------------------------------------------------------------
# Standard CRUD endpoints
# ---------------------------------------------------------------------------

@router.get(
    "/segmentation/{case_file_id}",
    response_model=ApiResponse[SegmentationResultResponse],
)
async def get_segmentation(
    case_file_id: str,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> ApiResponse[SegmentationResultResponse]:
    """Get the latest AI segmentation result for a case file."""
    service = SegmentationService(db)
    result = await service.get_segmentation(UUID(case_file_id))
    return ApiResponse(
        success=True,
        message="Segmentation result retrieved",
        data=SegmentationResultResponse.model_validate(result),
    )


@router.post(
    "/segmentation/{case_id}/{case_file_id}/process",
    response_model=ApiResponse[dict],
)
async def trigger_segmentation(
    case_id: str,
    case_file_id: str,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> ApiResponse[dict]:
    """Trigger AI segmentation processing for a case file."""
    service = SegmentationService(db)
    job_id = await service.trigger_segmentation(UUID(case_file_id), UUID(case_id))
    return ApiResponse(
        success=True,
        message="AI segmentation started",
        data={"job_id": job_id},
    )


@router.post(
    "/segmentation/reprocess",
    response_model=ApiResponse[dict],
)
async def reprocess_segmentation(
    data: ReprocessRequest,
    user: User = Depends(require_roles(UserRole.TECHNICIAN, UserRole.SUPER_ADMIN)),
    db: AsyncSession = Depends(get_db),
) -> ApiResponse[dict]:
    """Re-run AI segmentation on a previously processed file."""
    service = SegmentationService(db)
    from app.models.case_file import CaseFile
    case_file = await db.get(CaseFile, data.case_file_id)
    if not case_file:
        return ApiResponse(success=False, message="Case file not found")
    job_id = await service.trigger_segmentation(data.case_file_id, case_file.case_id)
    return ApiResponse(
        success=True,
        message="AI reprocessing started",
        data={"job_id": job_id},
    )


@router.get(
    "/segmentation/{case_file_id}/status",
    response_model=ApiResponse[SegmentationJobStatus],
)
async def get_job_status(
    case_file_id: str,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> ApiResponse[SegmentationJobStatus]:
    """Get current AI processing job status for a case file."""
    service = SegmentationService(db)
    status = await service.get_job_status(UUID(case_file_id))
    return ApiResponse(
        success=True,
        message="Job status retrieved",
        data=status,
    )


@router.post(
    "/corrections/{case_file_id}",
    response_model=ApiResponse[CorrectionResponse],
)
async def create_correction(
    case_file_id: str,
    data: CorrectionCreate,
    user: User = Depends(require_roles(UserRole.TECHNICIAN, UserRole.SUPER_ADMIN)),
    db: AsyncSession = Depends(get_db),
) -> ApiResponse[CorrectionResponse]:
    """Submit a technician correction to AI segmentation."""
    service = SegmentationService(db)
    correction = await service.create_correction(UUID(case_file_id), data, user)
    return ApiResponse(
        success=True,
        message="Correction saved",
        data=CorrectionResponse.model_validate(correction),
    )


@router.get(
    "/corrections/{case_file_id}",
    response_model=ApiResponse[list[CorrectionResponse]],
)
async def list_corrections(
    case_file_id: str,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> ApiResponse[list[CorrectionResponse]]:
    """List all corrections for a case file."""
    service = SegmentationService(db)
    corrections = await service.list_corrections(UUID(case_file_id))
    return ApiResponse(
        success=True,
        message="Corrections retrieved",
        data=[CorrectionResponse.model_validate(c) for c in corrections],
    )


@router.get("/stats", response_model=ApiResponse[AIStatsResponse])
async def get_ai_stats(
    user: User = Depends(require_roles(UserRole.SUPER_ADMIN, UserRole.LAB_MANAGER)),
    db: AsyncSession = Depends(get_db),
) -> ApiResponse[AIStatsResponse]:
    """Get aggregate AI pipeline statistics."""
    service = SegmentationService(db)
    stats = await service.get_ai_stats()
    return ApiResponse(
        success=True,
        message="AI stats retrieved",
        data=stats,
    )


# ---------------------------------------------------------------------------
# Tooth mesh extraction — split segmented arch into individual tooth STLs
# ---------------------------------------------------------------------------

_TEETH_CACHE_DIR = Path("/tmp/dentaflow-teeth")


class ExtractTeethRequest(BaseModel):
    file_path: str
    jaw: str | None = None  # "upper" or "lower", auto-detected if None


@router.post("/extract-teeth", response_model=ApiResponse[dict])
async def extract_teeth(
    data: ExtractTeethRequest,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> ApiResponse[dict]:
    """Run segmentation and extract individual tooth meshes.

    Returns download URLs for each tooth and the gum mesh, plus
    centroid / bounding-box metadata for 3D viewer positioning.
    """
    try:
        from ai.pipeline.pipeline_manager import run_full_pipeline
        from ai.utils.tooth_extractor import extract_tooth_meshes
        from ai.data.mesh_loader import load_mesh

        # 1. Run segmentation pipeline
        output = run_full_pipeline(
            file_path=data.file_path,
            jaw=data.jaw,
        )

        if output.face_labels is None:
            return ApiResponse(
                success=False,
                message="Segmentation produced no face labels",
                data={},
            )

        # 2. Load the original mesh and extract tooth sub-meshes
        mesh = load_mesh(data.file_path)
        tooth_data = extract_tooth_meshes(
            mesh, output.face_labels, jaw=output.jaw,
        )

        if not tooth_data:
            return ApiResponse(
                success=False,
                message="No tooth meshes could be extracted",
                data={},
            )

        # 3. Persist extracted STLs to a temp cache directory
        extraction_id = str(uuid4())
        cache_dir = _TEETH_CACHE_DIR / extraction_id
        cache_dir.mkdir(parents=True, exist_ok=True)

        # Save face_labels + jaw for downstream tools (cast-trim, base-gen)
        import numpy as _np
        _np.save(str(cache_dir / "face_labels.npy"), output.face_labels)
        (cache_dir / "jaw.txt").write_text(output.jaw)

        teeth_response: dict[str, dict] = {}
        gum_mesh_url: str | None = None

        for fdi, td in tooth_data.items():
            filename = f"{fdi}.stl"
            (cache_dir / filename).write_bytes(td.stl_bytes)

            mesh_url = f"/api/v1/ai/tooth-mesh/{extraction_id}/{fdi}"

            if fdi == 0:
                gum_mesh_url = mesh_url
            else:
                teeth_response[str(fdi)] = {
                    "mesh_url": mesh_url,
                    "centroid": td.centroid,
                    "bbox_min": td.bbox_min,
                    "bbox_max": td.bbox_max,
                }

        return ApiResponse(
            success=True,
            message=f"Extracted {len(teeth_response)} teeth",
            data={
                "extraction_id": extraction_id,
                "teeth": teeth_response,
                "gum_mesh_url": gum_mesh_url,
                "jaw": output.jaw,
            },
        )
    except Exception as exc:
        import traceback
        return ApiResponse(
            success=False,
            message=f"Tooth extraction failed: {exc}",
            data={"traceback": traceback.format_exc()},
        )


class ExtractFromLabelsRequest(BaseModel):
    file_path: str
    face_labels: list[int]  # per-face class indices (0=gum, 1-14=teeth)
    jaw: str  # "upper" or "lower"


@router.post("/extract-teeth-from-labels", response_model=ApiResponse[dict])
async def extract_teeth_from_labels(
    data: ExtractFromLabelsRequest,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> ApiResponse[dict]:
    """Extract tooth meshes from user-corrected face labels (no re-segmentation).

    Called after the user reviews and optionally edits the AI segmentation
    using the brush tool. Skips the AI pipeline and goes directly to
    mesh extraction.
    """
    try:
        import numpy as np
        from ai.utils.tooth_extractor import extract_tooth_meshes
        from ai.data.mesh_loader import load_mesh

        mesh = load_mesh(data.file_path)
        face_labels = np.array(data.face_labels, dtype=np.int64)

        if len(face_labels) != len(mesh.faces):
            return ApiResponse(
                success=False,
                message=f"face_labels length ({len(face_labels)}) != mesh faces ({len(mesh.faces)})",
                data={},
            )

        tooth_data = extract_tooth_meshes(mesh, face_labels, jaw=data.jaw)

        if not tooth_data:
            return ApiResponse(success=False, message="No tooth meshes extracted", data={})

        extraction_id = str(uuid4())
        cache_dir = _TEETH_CACHE_DIR / extraction_id
        cache_dir.mkdir(parents=True, exist_ok=True)

        # Save face_labels + jaw for downstream tools (cast-trim, base-gen)
        np.save(str(cache_dir / "face_labels.npy"), face_labels)
        (cache_dir / "jaw.txt").write_text(data.jaw)

        teeth_response: dict[str, dict] = {}
        gum_mesh_url: str | None = None

        for fdi, td in tooth_data.items():
            filename = f"{fdi}.stl"
            (cache_dir / filename).write_bytes(td.stl_bytes)
            mesh_url = f"/api/v1/ai/tooth-mesh/{extraction_id}/{fdi}"

            if fdi == 0:
                gum_mesh_url = mesh_url
            else:
                teeth_response[str(fdi)] = {
                    "mesh_url": mesh_url,
                    "centroid": td.centroid,
                    "bbox_min": td.bbox_min,
                    "bbox_max": td.bbox_max,
                }

        return ApiResponse(
            success=True,
            message=f"Extracted {len(teeth_response)} teeth from corrected labels",
            data={
                "extraction_id": extraction_id,
                "teeth": teeth_response,
                "gum_mesh_url": gum_mesh_url,
                "jaw": data.jaw,
            },
        )
    except Exception as exc:
        import traceback
        return ApiResponse(
            success=False,
            message=f"Extraction from labels failed: {exc}",
            data={"traceback": traceback.format_exc()},
        )


@router.get("/tooth-mesh/{extraction_id}/{fdi}")
async def get_tooth_mesh(
    extraction_id: str,
    fdi: int,
    user: User = Depends(get_current_user),
) -> Response:
    """Serve an individual extracted tooth (or gum) mesh STL file."""
    stl_path = _TEETH_CACHE_DIR / extraction_id / f"{fdi}.stl"
    if not stl_path.exists():
        raise HTTPException(
            status_code=404,
            detail=f"Tooth mesh not found: extraction={extraction_id}, fdi={fdi}",
        )
    return FileResponse(
        str(stl_path),
        media_type="model/stl",
        filename=f"tooth_{fdi}.stl",
    )
