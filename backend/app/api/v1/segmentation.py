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

class SegmentLocalRequest(BaseModel):
    file_path: str


@router.post("/segment", response_model=ApiResponse[dict])
async def segment_file(
    data: SegmentLocalRequest,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> ApiResponse[dict]:
    """Run AI segmentation on a file and return face-level color data.
    In dev mode runs synchronously. In production dispatches to Celery.
    """
    from app.config import get_settings
    settings = get_settings()

    try:
        from ai.pipeline.pipeline_manager import run_full_pipeline
        from ai.utils.fdi_numbering import class_to_fdi, get_tooth_name
        from ai.utils.visualization import get_fdi_color_map

        output = run_full_pipeline(
            file_path=data.file_path,
            instructions={},
            generate_face_data=True,
        )

        # Build per-face FDI numbers (for click-to-select)
        face_fdi = []
        if output.face_labels is not None:
            face_fdi = [int(class_to_fdi(int(l))) for l in output.face_labels]

        return ApiResponse(
            success=True,
            message="Segmentation complete",
            data={
                "teeth_found": output.teeth_found,
                "total_points": output.total_points,
                "processing_time": output.processing_time_seconds,
                "model_version": output.model_version,
                "confidence_scores": output.confidence_scores,
                "restricted_fdi": output.restricted_fdi,
                "overridden_count": output.overridden_points_count,
                "face_labels": face_fdi,
                "fdi_color_map": get_fdi_color_map(),
                "fdi_name_map": {
                    fdi: get_tooth_name(fdi) for fdi in output.teeth_found
                },
                "total_faces": len(face_fdi),
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
        from ai.utils.fdi_numbering import class_to_fdi
        from ai.utils.tooth_extractor import extract_tooth_meshes
        from ai.data.mesh_loader import load_mesh

        # 1. Run segmentation pipeline (reuse existing logic)
        output = run_full_pipeline(
            file_path=data.file_path,
            instructions={},
            generate_face_data=True,
        )

        if output.face_labels is None:
            return ApiResponse(
                success=False,
                message="Segmentation produced no face labels",
                data={},
            )

        # 2. Load the original mesh and extract tooth sub-meshes
        mesh = load_mesh(data.file_path)
        tooth_data = extract_tooth_meshes(mesh, output.face_labels)

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
            },
        )
    except Exception as exc:
        import traceback
        return ApiResponse(
            success=False,
            message=f"Tooth extraction failed: {exc}",
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
