# patients.py — Patient CRUD route handlers.

from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.database.connection import get_db
from app.middleware.auth_middleware import get_current_user
from app.models.user import User
from app.schemas.common import ApiResponse, PaginatedResponse
from app.schemas.patient import PatientCreate, PatientResponse, PatientUpdate
from app.services.patient_service import PatientService

router = APIRouter(prefix="/patients", tags=["Patients"])


@router.post("", response_model=ApiResponse[PatientResponse])
async def create_patient(
    data: PatientCreate,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> ApiResponse[PatientResponse]:
    """Create a new patient."""
    service = PatientService(db)
    patient = await service.create(data, user)
    return ApiResponse(
        success=True, message="Patient created",
        data=PatientResponse.model_validate(patient),
    )


@router.get("", response_model=ApiResponse[PaginatedResponse[PatientResponse]])
async def list_patients(
    search: str | None = Query(None),
    page: int = Query(1, ge=1),
    per_page: int = Query(20, ge=1, le=100),
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> ApiResponse[PaginatedResponse[PatientResponse]]:
    """List patients for the current dentist."""
    service = PatientService(db)
    skip = (page - 1) * per_page
    patients, total = await service.list_patients(user, search, skip, per_page)
    return ApiResponse(
        success=True, message="Patients retrieved",
        data=PaginatedResponse(
            items=[PatientResponse.model_validate(p) for p in patients],
            total=total, page=page, per_page=per_page,
            total_pages=(total + per_page - 1) // per_page,
        ),
    )


@router.get("/{patient_id}", response_model=ApiResponse[PatientResponse])
async def get_patient(
    patient_id: str,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> ApiResponse[PatientResponse]:
    """Get patient details."""
    service = PatientService(db)
    from uuid import UUID
    patient = await service.get(UUID(patient_id), user)
    return ApiResponse(
        success=True, message="Patient retrieved",
        data=PatientResponse.model_validate(patient),
    )


@router.put("/{patient_id}", response_model=ApiResponse[PatientResponse])
async def update_patient(
    patient_id: str, data: PatientUpdate,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> ApiResponse[PatientResponse]:
    """Update patient details."""
    service = PatientService(db)
    from uuid import UUID
    patient = await service.update(UUID(patient_id), data, user)
    return ApiResponse(
        success=True, message="Patient updated",
        data=PatientResponse.model_validate(patient),
    )


@router.delete("/{patient_id}", response_model=ApiResponse[None])
async def delete_patient(
    patient_id: str,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> ApiResponse[None]:
    """Soft-delete a patient."""
    service = PatientService(db)
    from uuid import UUID
    await service.soft_delete(UUID(patient_id), user)
    return ApiResponse(success=True, message="Patient deleted")
