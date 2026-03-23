# tooth_instruction_service.py — Business logic for per-tooth clinical instructions.

import uuid
from collections import defaultdict

from sqlalchemy.ext.asyncio import AsyncSession

from app.constants import CaseStatus, UserRole
from app.exceptions import AuthorizationError, NotFoundError, ValidationError
from app.models.tooth_instruction import ToothInstruction
from app.models.user import User
from app.repositories.tooth_instruction_repository import ToothInstructionRepository
from app.schemas.tooth_instruction import (
    ToothInstructionCreate,
    ToothInstructionResponse,
    ToothInstructionSummary,
    ToothInstructionUpdate,
)


class ToothInstructionService:
    """Handles CRUD for per-tooth clinical instructions."""

    def __init__(self, db: AsyncSession) -> None:
        self.repo = ToothInstructionRepository(db)

    async def add(
        self, case_id: uuid.UUID, data: ToothInstructionCreate,
        dentist: User, case_status: str,
    ) -> ToothInstruction:
        """Add an instruction for a tooth on a case."""
        self._check_editable(case_status)
        instruction = ToothInstruction(
            case_id=case_id,
            dentist_id=dentist.id,
            fdi_tooth_number=data.fdi_tooth_number,
            instruction_type=data.instruction_type.value,
            numeric_value=data.numeric_value,
            note_text=data.note_text,
            severity=data.severity.value,
        )
        return await self.repo.create(instruction)

    async def list_by_case(
        self, case_id: uuid.UUID
    ) -> list[ToothInstruction]:
        """Get all instructions for a case."""
        return await self.repo.list_by_case(case_id)

    async def get_summary(
        self, case_id: uuid.UUID
    ) -> ToothInstructionSummary:
        """Build an aggregated summary grouped by tooth."""
        instructions = await self.repo.list_by_case(case_id)
        restricted = await self.repo.get_restricted_teeth(case_id)
        by_tooth: dict[str, list[ToothInstructionResponse]] = defaultdict(list)
        for inst in instructions:
            key = str(inst.fdi_tooth_number)
            by_tooth[key].append(
                ToothInstructionResponse.model_validate(inst)
            )
        return ToothInstructionSummary(
            instructions_by_tooth=dict(by_tooth),
            restricted_fdi_numbers=restricted,
            total_count=len(instructions),
        )

    async def update(
        self, instruction_id: uuid.UUID, data: ToothInstructionUpdate,
        user: User, case_status: str,
    ) -> ToothInstruction:
        """Update an existing instruction."""
        self._check_editable(case_status)
        instruction = await self.repo.get_by_id(instruction_id)
        if not instruction:
            raise NotFoundError("Tooth instruction")
        if instruction.dentist_id != user.id and user.role != UserRole.SUPER_ADMIN.value:
            raise AuthorizationError("Not your instruction")
        for field, value in data.model_dump(exclude_unset=True).items():
            val = value.value if hasattr(value, "value") else value
            setattr(instruction, field, val)
        return await self.repo.update(instruction)

    async def delete(
        self, instruction_id: uuid.UUID, user: User, case_status: str
    ) -> None:
        """Delete an instruction (only before submission)."""
        self._check_editable(case_status)
        instruction = await self.repo.get_by_id(instruction_id)
        if not instruction:
            raise NotFoundError("Tooth instruction")
        if instruction.dentist_id != user.id and user.role != UserRole.SUPER_ADMIN.value:
            raise AuthorizationError("Not your instruction")
        await self.repo.delete(instruction)

    def _check_editable(self, case_status: str) -> None:
        """Verify case is still in an editable state."""
        if case_status not in (CaseStatus.DRAFT.value, CaseStatus.SUBMITTED.value):
            raise ValidationError(
                "Instructions can only be modified before processing"
            )
