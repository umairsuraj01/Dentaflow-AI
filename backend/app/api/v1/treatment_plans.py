# treatment_plans.py — CRUD API endpoints for treatment plans.

from uuid import UUID

from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.database.connection import get_db
from app.middleware.auth_middleware import get_current_user
from app.models.user import User
from app.schemas.common import ApiResponse
from app.schemas.treatment import (
    TreatmentPlanCreate,
    TreatmentPlanListResponse,
    TreatmentPlanResponse,
    TreatmentPlanUpdate,
    TreatmentStepCreate,
    TreatmentStepResponse,
    ToothTransformBatchUpdate,
)
from app.services.treatment_plan_service import TreatmentPlanService

router = APIRouter(prefix="/treatment-plans", tags=["Treatment Plans"])


# ---------------------------------------------------------------------------
# Plan CRUD
# ---------------------------------------------------------------------------

@router.post("", response_model=ApiResponse[TreatmentPlanResponse])
async def create_plan(
    data: TreatmentPlanCreate,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> ApiResponse[TreatmentPlanResponse]:
    """Create a new treatment plan for a case."""
    service = TreatmentPlanService(db)
    plan = await service.create_plan(data, user)
    # Reload with steps for consistent response
    plan = await service.get_plan(plan.id)
    return ApiResponse(
        success=True,
        message="Treatment plan created",
        data=TreatmentPlanResponse.model_validate(plan),
    )


@router.get("/{plan_id}", response_model=ApiResponse[TreatmentPlanResponse])
async def get_plan(
    plan_id: str,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> ApiResponse[TreatmentPlanResponse]:
    """Get a treatment plan with all steps and transforms."""
    service = TreatmentPlanService(db)
    plan = await service.get_plan(UUID(plan_id))
    return ApiResponse(
        success=True,
        message="Treatment plan retrieved",
        data=TreatmentPlanResponse.model_validate(plan),
    )


@router.get(
    "/case/{case_id}",
    response_model=ApiResponse[list[TreatmentPlanListResponse]],
)
async def list_plans_for_case(
    case_id: str,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> ApiResponse[list[TreatmentPlanListResponse]]:
    """List all treatment plans for a case."""
    service = TreatmentPlanService(db)
    plans = await service.list_plans_for_case(UUID(case_id))
    return ApiResponse(
        success=True,
        message="Treatment plans retrieved",
        data=[TreatmentPlanListResponse.model_validate(p) for p in plans],
    )


@router.put("/{plan_id}", response_model=ApiResponse[TreatmentPlanResponse])
async def update_plan(
    plan_id: str,
    data: TreatmentPlanUpdate,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> ApiResponse[TreatmentPlanResponse]:
    """Update treatment plan metadata."""
    service = TreatmentPlanService(db)
    plan = await service.update_plan(UUID(plan_id), data)
    return ApiResponse(
        success=True,
        message="Treatment plan updated",
        data=TreatmentPlanResponse.model_validate(plan),
    )


@router.delete("/{plan_id}", response_model=ApiResponse[None])
async def delete_plan(
    plan_id: str,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> ApiResponse[None]:
    """Delete a treatment plan and all its steps."""
    service = TreatmentPlanService(db)
    await service.delete_plan(UUID(plan_id))
    return ApiResponse(
        success=True,
        message="Treatment plan deleted",
    )


# ---------------------------------------------------------------------------
# Step CRUD
# ---------------------------------------------------------------------------

@router.post(
    "/{plan_id}/steps",
    response_model=ApiResponse[TreatmentStepResponse],
)
async def add_step(
    plan_id: str,
    data: TreatmentStepCreate,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> ApiResponse[TreatmentStepResponse]:
    """Add a treatment step with transforms to a plan."""
    service = TreatmentPlanService(db)
    step = await service.add_step(UUID(plan_id), data)
    return ApiResponse(
        success=True,
        message="Treatment step added",
        data=TreatmentStepResponse.model_validate(step),
    )


@router.put(
    "/{plan_id}/steps/{step_number}",
    response_model=ApiResponse[TreatmentStepResponse],
)
async def update_step_transforms(
    plan_id: str,
    step_number: int,
    data: ToothTransformBatchUpdate,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> ApiResponse[TreatmentStepResponse]:
    """Batch-update all transforms for a step."""
    service = TreatmentPlanService(db)
    step = await service.update_step_transforms(
        UUID(plan_id), step_number, data,
    )
    return ApiResponse(
        success=True,
        message="Step transforms updated",
        data=TreatmentStepResponse.model_validate(step),
    )


@router.delete(
    "/{plan_id}/steps/{step_number}",
    response_model=ApiResponse[None],
)
async def delete_step(
    plan_id: str,
    step_number: int,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> ApiResponse[None]:
    """Delete a step and its transforms from a plan."""
    service = TreatmentPlanService(db)
    await service.delete_step(UUID(plan_id), step_number)
    return ApiResponse(
        success=True,
        message="Treatment step deleted",
    )
