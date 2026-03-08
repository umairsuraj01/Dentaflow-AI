# treatment_plan_service.py — Business logic for treatment plan operations.

from __future__ import annotations

import uuid
import logging

from sqlalchemy.ext.asyncio import AsyncSession

from app.constants import TreatmentPlanStatus
from app.exceptions import BadRequestError, NotFoundError
from app.models.tooth_transform import ToothTransform
from app.models.treatment_plan import TreatmentPlan
from app.models.treatment_step import TreatmentStep
from app.models.user import User
from app.repositories.treatment_plan_repository import (
    TreatmentPlanRepository,
    TreatmentStepRepository,
    ToothTransformRepository,
)
from app.schemas.treatment import (
    TreatmentPlanCreate,
    TreatmentPlanUpdate,
    TreatmentStepCreate,
    ToothTransformBatchUpdate,
)

logger = logging.getLogger(__name__)


class TreatmentPlanService:
    """Treatment plan business logic."""

    def __init__(self, db: AsyncSession) -> None:
        self.db = db
        self.plan_repo = TreatmentPlanRepository(db)
        self.step_repo = TreatmentStepRepository(db)
        self.transform_repo = ToothTransformRepository(db)

    # ------------------------------------------------------------------
    # Plans
    # ------------------------------------------------------------------

    async def create_plan(
        self, data: TreatmentPlanCreate, user: User,
    ) -> TreatmentPlan:
        """Create a new treatment plan for a case."""
        plan = TreatmentPlan(
            id=uuid.uuid4(),
            case_id=data.case_id,
            created_by_id=user.id,
            name=data.name,
            description=data.description,
            extraction_id=data.extraction_id,
            total_steps=0,
            status=TreatmentPlanStatus.DRAFT.value,
        )
        return await self.plan_repo.create(plan)

    async def get_plan(self, plan_id: uuid.UUID) -> TreatmentPlan:
        """Get a plan with all steps and transforms."""
        plan = await self.plan_repo.get_with_steps(plan_id)
        if not plan:
            raise NotFoundError("Treatment plan")
        return plan

    async def list_plans_for_case(
        self, case_id: uuid.UUID,
    ) -> list[TreatmentPlan]:
        """List all treatment plans for a case."""
        return await self.plan_repo.list_by_case(case_id)

    async def update_plan(
        self, plan_id: uuid.UUID, data: TreatmentPlanUpdate,
    ) -> TreatmentPlan:
        """Update treatment plan metadata."""
        plan = await self.plan_repo.get_with_steps(plan_id)
        if not plan:
            raise NotFoundError("Treatment plan")

        if data.name is not None:
            plan.name = data.name
        if data.description is not None:
            plan.description = data.description
        if data.extraction_id is not None:
            plan.extraction_id = data.extraction_id
        if data.status is not None:
            # Validate status value
            try:
                TreatmentPlanStatus(data.status)
            except ValueError:
                raise BadRequestError(
                    f"Invalid status. Must be one of: "
                    f"{[s.value for s in TreatmentPlanStatus]}"
                )
            plan.status = data.status

        return await self.plan_repo.update(plan)

    async def delete_plan(self, plan_id: uuid.UUID) -> None:
        """Delete a treatment plan and all its steps/transforms."""
        plan = await self.plan_repo.get_by_id(plan_id)
        if not plan:
            raise NotFoundError("Treatment plan")
        await self.plan_repo.delete(plan)

    # ------------------------------------------------------------------
    # Steps
    # ------------------------------------------------------------------

    async def add_step(
        self, plan_id: uuid.UUID, data: TreatmentStepCreate,
    ) -> TreatmentStep:
        """Add a step with transforms to a plan."""
        plan = await self.plan_repo.get_by_id(plan_id)
        if not plan:
            raise NotFoundError("Treatment plan")

        # Check for duplicate step number
        existing = await self.step_repo.get_by_plan_and_number(
            plan_id, data.step_number,
        )
        if existing:
            raise BadRequestError(
                f"Step number {data.step_number} already exists in this plan"
            )

        step = TreatmentStep(
            id=uuid.uuid4(),
            plan_id=plan_id,
            step_number=data.step_number,
            label=data.label,
            notes=data.notes,
        )
        step = await self.step_repo.create(step)

        # Create transforms for this step
        for t in data.transforms:
            transform = ToothTransform(
                id=uuid.uuid4(),
                step_id=step.id,
                fdi_number=t.fdi_number,
                pos_x=t.pos_x,
                pos_y=t.pos_y,
                pos_z=t.pos_z,
                rot_x=t.rot_x,
                rot_y=t.rot_y,
                rot_z=t.rot_z,
            )
            self.db.add(transform)
        await self.db.flush()

        # Update plan total_steps
        plan.total_steps = await self.step_repo.count_by_plan(plan_id)
        await self.db.flush()

        # Reload step with transforms
        step = await self.step_repo.get_by_plan_and_number(
            plan_id, data.step_number,
        )
        return step

    async def update_step_transforms(
        self,
        plan_id: uuid.UUID,
        step_number: int,
        data: ToothTransformBatchUpdate,
    ) -> TreatmentStep:
        """Replace all transforms for a step (batch update)."""
        step = await self.step_repo.get_by_plan_and_number(plan_id, step_number)
        if not step:
            raise NotFoundError("Treatment step")

        # Delete existing transforms and replace
        await self.transform_repo.delete_by_step(step.id)

        for t in data.transforms:
            transform = ToothTransform(
                id=uuid.uuid4(),
                step_id=step.id,
                fdi_number=t.fdi_number,
                pos_x=t.pos_x,
                pos_y=t.pos_y,
                pos_z=t.pos_z,
                rot_x=t.rot_x,
                rot_y=t.rot_y,
                rot_z=t.rot_z,
            )
            self.db.add(transform)
        await self.db.flush()

        # Reload step with new transforms
        return await self.step_repo.get_by_plan_and_number(plan_id, step_number)

    async def delete_step(
        self, plan_id: uuid.UUID, step_number: int,
    ) -> None:
        """Delete a step and its transforms from a plan."""
        plan = await self.plan_repo.get_by_id(plan_id)
        if not plan:
            raise NotFoundError("Treatment plan")

        deleted = await self.step_repo.delete_by_plan_and_number(
            plan_id, step_number,
        )
        if not deleted:
            raise NotFoundError("Treatment step")

        # Update plan total_steps
        plan.total_steps = await self.step_repo.count_by_plan(plan_id)
        await self.db.flush()
