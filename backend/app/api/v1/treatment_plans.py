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
    AutoStageRequest,
    AutoStageResponse,
)
from app.services.treatment_plan_service import TreatmentPlanService
from app.services.auto_staging import (
    compute_stages,
    ToothTarget,
    ToothConstraint,
)

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


# ---------------------------------------------------------------------------
# Auto-Staging
# ---------------------------------------------------------------------------

@router.post(
    "/auto-stage",
    response_model=ApiResponse[AutoStageResponse],
)
async def auto_stage(
    data: AutoStageRequest,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> ApiResponse[AutoStageResponse]:
    """Auto-compute treatment stages from target transforms.

    The doctor sets the final target for each tooth. This endpoint computes
    how many stages are needed (based on 0.25mm/stage, 2°/stage limits),
    respects tooth instructions (DO_NOT_MOVE, LIMIT_MOVEMENT, etc.),
    and creates all intermediate steps in the plan.
    """
    service = TreatmentPlanService(db)
    plan = await service.get_plan(UUID(data.plan_id))

    # Build targets
    targets = [
        ToothTarget(
            fdi_number=t.fdi_number,
            pos_x=t.pos_x, pos_y=t.pos_y, pos_z=t.pos_z,
            rot_x=t.rot_x, rot_y=t.rot_y, rot_z=t.rot_z,
        )
        for t in data.targets
    ]

    # Fetch tooth instructions for this case to build constraints
    from app.repositories.tooth_instruction_repository import ToothInstructionRepository
    ti_repo = ToothInstructionRepository(db)
    instructions = await ti_repo.list_by_case(plan.case_id)

    constraints = []
    for inst in instructions:
        c = ToothConstraint(fdi_number=inst.fdi_tooth_number)
        if inst.instruction_type == "CROWN_DO_NOT_MOVE":
            c.do_not_move = True
        elif inst.instruction_type == "IMPLANT":
            c.do_not_move = True
        elif inst.instruction_type == "BRIDGE_ANCHOR":
            c.do_not_move = True
        elif inst.instruction_type == "ANKYLOSIS_SUSPECTED":
            c.do_not_move = True
        elif inst.instruction_type == "LIMIT_MOVEMENT_MM":
            c.max_movement_mm = inst.numeric_value or 2.0
        elif inst.instruction_type == "AVOID_TIPPING":
            c.avoid_tipping = True
        elif inst.instruction_type == "AVOID_ROTATION":
            c.avoid_rotation = True
        elif inst.instruction_type == "SENSITIVE_ROOT":
            c.sensitive_root = True
        constraints.append(c)

    # Compute stages
    result = compute_stages(
        targets=targets,
        constraints=constraints,
        custom_max_translation=data.max_translation_per_stage,
        custom_max_rotation=data.max_rotation_per_stage,
    )

    # Delete existing steps (except step 0 if it exists)
    for step in plan.steps:
        if step.step_number > 0:
            await service.delete_step(plan.id, step.step_number)

    # Ensure step 0 exists (initial position)
    from app.schemas.treatment import TreatmentStepCreate, ToothTransformCreate
    step0 = next((s for s in plan.steps if s.step_number == 0), None)
    if not step0:
        await service.add_step(
            plan.id,
            TreatmentStepCreate(
                step_number=0,
                label="Initial",
                transforms=[
                    ToothTransformCreate(fdi_number=t.fdi_number)
                    for t in data.targets
                ],
            ),
        )

    # Create computed stages
    for stage_idx in range(1, result.total_stages + 1):
        stage_data = result.stages[stage_idx]
        await service.add_step(
            plan.id,
            TreatmentStepCreate(
                step_number=stage_idx,
                label=f"Stage {stage_idx}",
                transforms=[
                    ToothTransformCreate(
                        fdi_number=st.fdi_number,
                        pos_x=round(st.pos_x, 4),
                        pos_y=round(st.pos_y, 4),
                        pos_z=round(st.pos_z, 4),
                        rot_x=round(st.rot_x, 4),
                        rot_y=round(st.rot_y, 4),
                        rot_z=round(st.rot_z, 4),
                    )
                    for st in stage_data
                ],
            ),
        )

    return ApiResponse(
        success=True,
        message=f"Auto-staged {result.total_stages} stages for {len(targets)} teeth",
        data=AutoStageResponse(
            total_stages=result.total_stages,
            warnings=result.warnings,
            per_tooth_stages=result.per_tooth_stages,
        ),
    )
