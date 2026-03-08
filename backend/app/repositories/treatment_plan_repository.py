# treatment_plan_repository.py — Data access for treatment plans, steps, and transforms.

import uuid

from sqlalchemy import select, delete
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.models.treatment_plan import TreatmentPlan
from app.models.treatment_step import TreatmentStep
from app.models.tooth_transform import ToothTransform
from app.repositories.base_repository import BaseRepository


class TreatmentPlanRepository(BaseRepository[TreatmentPlan]):
    """Treatment plan database operations."""

    def __init__(self, db: AsyncSession) -> None:
        super().__init__(TreatmentPlan, db)

    async def get_with_steps(
        self, plan_id: uuid.UUID,
    ) -> TreatmentPlan | None:
        """Get a plan with all steps and their transforms eagerly loaded."""
        stmt = (
            select(TreatmentPlan)
            .where(TreatmentPlan.id == plan_id)
            .options(
                selectinload(TreatmentPlan.steps)
                .selectinload(TreatmentStep.transforms),
            )
        )
        result = await self.db.execute(stmt)
        return result.scalar_one_or_none()

    async def list_by_case(
        self, case_id: uuid.UUID,
    ) -> list[TreatmentPlan]:
        """List all plans for a case (without steps)."""
        stmt = (
            select(TreatmentPlan)
            .where(TreatmentPlan.case_id == case_id)
            .order_by(TreatmentPlan.created_at.desc())
        )
        result = await self.db.execute(stmt)
        return list(result.scalars().all())


class TreatmentStepRepository(BaseRepository[TreatmentStep]):
    """Treatment step database operations."""

    def __init__(self, db: AsyncSession) -> None:
        super().__init__(TreatmentStep, db)

    async def get_by_plan_and_number(
        self, plan_id: uuid.UUID, step_number: int,
    ) -> TreatmentStep | None:
        """Get a specific step by plan ID and step number."""
        stmt = (
            select(TreatmentStep)
            .where(
                TreatmentStep.plan_id == plan_id,
                TreatmentStep.step_number == step_number,
            )
            .options(selectinload(TreatmentStep.transforms))
        )
        result = await self.db.execute(stmt)
        return result.scalar_one_or_none()

    async def delete_by_plan_and_number(
        self, plan_id: uuid.UUID, step_number: int,
    ) -> bool:
        """Delete a step (and cascade to transforms) by plan + step number."""
        step = await self.get_by_plan_and_number(plan_id, step_number)
        if not step:
            return False
        await self.db.delete(step)
        await self.db.flush()
        return True

    async def count_by_plan(self, plan_id: uuid.UUID) -> int:
        """Count steps belonging to a plan."""
        from sqlalchemy import func
        stmt = (
            select(func.count())
            .select_from(TreatmentStep)
            .where(TreatmentStep.plan_id == plan_id)
        )
        result = await self.db.execute(stmt)
        return result.scalar_one()


class ToothTransformRepository(BaseRepository[ToothTransform]):
    """Tooth transform database operations."""

    def __init__(self, db: AsyncSession) -> None:
        super().__init__(ToothTransform, db)

    async def delete_by_step(self, step_id: uuid.UUID) -> None:
        """Remove all transforms for a step (before batch replace)."""
        stmt = delete(ToothTransform).where(ToothTransform.step_id == step_id)
        await self.db.execute(stmt)
        await self.db.flush()
