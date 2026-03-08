# tooth_instruction_repository.py — Data access for tooth instructions.

import uuid

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.constants import InstructionSeverity
from app.models.tooth_instruction import ToothInstruction
from app.repositories.base_repository import BaseRepository


class ToothInstructionRepository(BaseRepository[ToothInstruction]):
    """Tooth instruction database operations."""

    def __init__(self, db: AsyncSession) -> None:
        super().__init__(ToothInstruction, db)

    async def list_by_case(
        self, case_id: uuid.UUID
    ) -> list[ToothInstruction]:
        """Get all instructions for a case sorted by FDI number."""
        stmt = (
            select(ToothInstruction)
            .where(ToothInstruction.case_id == case_id)
            .order_by(ToothInstruction.fdi_tooth_number)
        )
        result = await self.db.execute(stmt)
        return list(result.scalars().all())

    async def get_restricted_teeth(
        self, case_id: uuid.UUID
    ) -> list[int]:
        """Get FDI numbers of teeth with MUST_RESPECT severity."""
        stmt = (
            select(ToothInstruction.fdi_tooth_number)
            .where(
                ToothInstruction.case_id == case_id,
                ToothInstruction.severity == InstructionSeverity.MUST_RESPECT.value,
            )
            .distinct()
        )
        result = await self.db.execute(stmt)
        return list(result.scalars().all())
