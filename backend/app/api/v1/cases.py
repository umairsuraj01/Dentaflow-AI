# cases.py — Case management route handlers.

from uuid import UUID

from fastapi import APIRouter, Depends, Query
from pydantic import BaseModel
from sqlalchemy import or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database.connection import get_db
from app.middleware.auth_middleware import get_current_user
from app.models.user import User
from app.schemas.case import (
    CaseAssign, CaseCreate, CaseNoteCreate, CaseNoteResponse,
    CaseResponse, CaseUpdate, DashboardStats,
    UploadConfirm, UploadUrlRequest, UploadUrlResponse, CaseFileResponse,
)
from app.schemas.common import ApiResponse, PaginatedResponse
from app.services.case_service import CaseService
from app.services.file_service import FileService

router = APIRouter(prefix="/cases", tags=["Cases"])


@router.post("", response_model=ApiResponse[CaseResponse])
async def create_case(
    data: CaseCreate,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> ApiResponse[CaseResponse]:
    """Create a new dental case."""
    service = CaseService(db)
    case = await service.create(data, user)
    return ApiResponse(
        success=True, message="Case created",
        data=CaseResponse.model_validate(case),
    )


@router.get("", response_model=ApiResponse[PaginatedResponse[CaseResponse]])
async def list_cases(
    status: str | None = Query(None),
    search: str | None = Query(None),
    page: int = Query(1, ge=1),
    per_page: int = Query(20, ge=1, le=100),
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> ApiResponse[PaginatedResponse[CaseResponse]]:
    """List cases filtered by user role."""
    service = CaseService(db)
    skip = (page - 1) * per_page
    cases, total = await service.list_cases(user, status, search, skip, per_page)
    return ApiResponse(
        success=True, message="Cases retrieved",
        data=PaginatedResponse(
            items=[CaseResponse.model_validate(c) for c in cases],
            total=total, page=page, per_page=per_page,
            total_pages=(total + per_page - 1) // per_page,
        ),
    )


@router.get("/search")
async def search_global(
    q: str = "",
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Global search across cases and patients."""
    if not q or len(q) < 2:
        return ApiResponse(
            success=True, message="Search results",
            data={"cases": [], "patients": []},
        )
    from app.models.patient import Patient
    from app.models.case import Case

    case_q = (
        select(Case)
        .where(
            Case.dentist_id == user.id,
            or_(
                Case.case_number.ilike(f"%{q}%"),
                Case.chief_complaint.ilike(f"%{q}%"),
            ),
        )
        .limit(5)
    )
    cases = (await db.execute(case_q)).scalars().all()

    pat_q = (
        select(Patient)
        .where(
            Patient.dentist_id == user.id,
            Patient.is_deleted == False,
            or_(
                Patient.first_name.ilike(f"%{q}%"),
                Patient.last_name.ilike(f"%{q}%"),
                Patient.patient_reference.ilike(f"%{q}%"),
            ),
        )
        .limit(5)
    )
    patients = (await db.execute(pat_q)).scalars().all()

    return ApiResponse(
        success=True,
        message="Search results",
        data={
            "cases": [
                {
                    "id": str(c.id),
                    "case_number": c.case_number,
                    "status": c.status,
                    "treatment_type": c.treatment_type,
                }
                for c in cases
            ],
            "patients": [
                {
                    "id": str(p.id),
                    "first_name": p.first_name,
                    "last_name": p.last_name,
                    "patient_reference": p.patient_reference,
                }
                for p in patients
            ],
        },
    )


@router.get("/{case_id}", response_model=ApiResponse[CaseResponse])
async def get_case(
    case_id: str,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> ApiResponse[CaseResponse]:
    """Get full case details."""
    service = CaseService(db)
    case = await service.get(UUID(case_id), user)
    return ApiResponse(
        success=True, message="Case retrieved",
        data=CaseResponse.model_validate(case),
    )


@router.put("/{case_id}", response_model=ApiResponse[CaseResponse])
async def update_case(
    case_id: str, data: CaseUpdate,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> ApiResponse[CaseResponse]:
    """Update case details (draft only)."""
    service = CaseService(db)
    case = await service.update(UUID(case_id), data, user)
    return ApiResponse(
        success=True, message="Case updated",
        data=CaseResponse.model_validate(case),
    )


@router.post("/{case_id}/submit", response_model=ApiResponse[CaseResponse])
async def submit_case(
    case_id: str,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> ApiResponse[CaseResponse]:
    """Submit a draft case for processing."""
    service = CaseService(db)
    case = await service.submit(UUID(case_id), user)
    return ApiResponse(
        success=True, message="Case submitted",
        data=CaseResponse.model_validate(case),
    )


@router.post("/{case_id}/assign", response_model=ApiResponse[CaseResponse])
async def assign_case(
    case_id: str, data: CaseAssign,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> ApiResponse[CaseResponse]:
    """Assign a technician to a case."""
    service = CaseService(db)
    case = await service.assign(UUID(case_id), data.technician_id, user)
    return ApiResponse(
        success=True, message="Case assigned",
        data=CaseResponse.model_validate(case),
    )


@router.post("/{case_id}/approve", response_model=ApiResponse[CaseResponse])
async def approve_case(
    case_id: str,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> ApiResponse[CaseResponse]:
    """Dentist approves a case."""
    service = CaseService(db)
    case = await service.approve(UUID(case_id), user)
    return ApiResponse(
        success=True, message="Case approved",
        data=CaseResponse.model_validate(case),
    )


class RevisionRequest(BaseModel):
    """Reason for requesting revision."""
    reason: str


@router.post("/{case_id}/request-revision", response_model=ApiResponse[CaseResponse])
async def request_revision(
    case_id: str, data: RevisionRequest,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> ApiResponse[CaseResponse]:
    """Dentist requests revision on a case."""
    service = CaseService(db)
    case = await service.request_revision(UUID(case_id), user, data.reason)
    return ApiResponse(
        success=True, message="Revision requested",
        data=CaseResponse.model_validate(case),
    )


@router.post("/{case_id}/cancel", response_model=ApiResponse[CaseResponse])
async def cancel_case(
    case_id: str,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> ApiResponse[CaseResponse]:
    """Cancel a case."""
    service = CaseService(db)
    case = await service.cancel(UUID(case_id), user)
    return ApiResponse(
        success=True, message="Case cancelled",
        data=CaseResponse.model_validate(case),
    )


# -- Files -----------------------------------------------------------------

@router.post("/{case_id}/files/upload-url", response_model=ApiResponse[UploadUrlResponse])
async def get_upload_url(
    case_id: str, data: UploadUrlRequest,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> ApiResponse[UploadUrlResponse]:
    """Get a presigned S3 URL for file upload."""
    file_svc = FileService(db)
    url, file_id, s3_key = await file_svc.create_upload_url(
        UUID(case_id), data.file_type, data.original_filename,
        data.file_size_bytes, data.mime_type, user,
    )
    return ApiResponse(
        success=True, message="Upload URL generated",
        data=UploadUrlResponse(upload_url=url, file_id=file_id, s3_key=s3_key),
    )


@router.post("/{case_id}/files/confirm", response_model=ApiResponse[CaseFileResponse])
async def confirm_upload(
    case_id: str, data: UploadConfirm,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> ApiResponse[CaseFileResponse]:
    """Confirm file upload completion."""
    file_svc = FileService(db)
    case_file = await file_svc.confirm_upload(data.file_id)
    return ApiResponse(
        success=True, message="Upload confirmed",
        data=CaseFileResponse.model_validate(case_file),
    )


@router.get("/{case_id}/files", response_model=ApiResponse[list[CaseFileResponse]])
async def list_files(
    case_id: str,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> ApiResponse[list[CaseFileResponse]]:
    """List all files for a case."""
    file_svc = FileService(db)
    files = await file_svc.list_files(UUID(case_id))
    return ApiResponse(
        success=True, message="Files retrieved",
        data=[CaseFileResponse.model_validate(f) for f in files],
    )


@router.delete("/{case_id}/files/{file_id}", response_model=ApiResponse[None])
async def delete_file(
    case_id: str, file_id: str,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> ApiResponse[None]:
    """Delete a case file."""
    file_svc = FileService(db)
    await file_svc.delete_file(UUID(file_id))
    return ApiResponse(success=True, message="File deleted")


@router.get("/{case_id}/files/{file_id}/download")
async def download_file(
    case_id: str, file_id: str,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> ApiResponse[dict[str, str]]:
    """Get presigned download URL for a file."""
    file_svc = FileService(db)
    url = await file_svc.get_download_url(UUID(file_id))
    return ApiResponse(
        success=True, message="Download URL generated",
        data={"download_url": url},
    )


# -- Notes -----------------------------------------------------------------

@router.post("/{case_id}/notes", response_model=ApiResponse[CaseNoteResponse])
async def add_note(
    case_id: str, data: CaseNoteCreate,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> ApiResponse[CaseNoteResponse]:
    """Add a note to a case."""
    service = CaseService(db)
    note = await service.add_note(UUID(case_id), data, user)
    return ApiResponse(
        success=True, message="Note added",
        data=CaseNoteResponse.model_validate(note),
    )


@router.get("/{case_id}/notes", response_model=ApiResponse[list[CaseNoteResponse]])
async def list_notes(
    case_id: str,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> ApiResponse[list[CaseNoteResponse]]:
    """List notes for a case."""
    service = CaseService(db)
    notes = await service.list_notes(UUID(case_id), user)
    return ApiResponse(
        success=True, message="Notes retrieved",
        data=[CaseNoteResponse.model_validate(n) for n in notes],
    )
