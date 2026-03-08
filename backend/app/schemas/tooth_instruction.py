# tooth_instruction.py — Schemas for per-tooth clinical instructions.

import uuid
from datetime import datetime

from pydantic import BaseModel, Field, field_validator

from app.constants import InstructionSeverity, ToothInstructionType


class ToothInstructionCreate(BaseModel):
    """Add a clinical instruction for a specific tooth."""

    fdi_tooth_number: int = Field(..., ge=11, le=48, description="FDI tooth number 11-48")
    instruction_type: ToothInstructionType
    numeric_value: float | None = Field(
        None, ge=0, le=20, description="mm limit for LIMIT_MOVEMENT_MM"
    )
    note_text: str | None = Field(None, max_length=500)
    severity: InstructionSeverity = InstructionSeverity.MUST_RESPECT

    @field_validator("numeric_value")
    @classmethod
    def numeric_required_for_limit(
        cls, v: float | None, info: object
    ) -> float | None:
        """Require numeric_value when instruction is LIMIT_MOVEMENT_MM."""
        data = info.data if hasattr(info, "data") else {}
        if data.get("instruction_type") == ToothInstructionType.LIMIT_MOVEMENT_MM:
            if v is None:
                raise ValueError("numeric_value required for LIMIT_MOVEMENT_MM")
        return v


class ToothInstructionUpdate(BaseModel):
    """Update an existing tooth instruction."""

    instruction_type: ToothInstructionType | None = None
    numeric_value: float | None = Field(None, ge=0, le=20)
    note_text: str | None = Field(None, max_length=500)
    severity: InstructionSeverity | None = None


class ToothInstructionResponse(BaseModel):
    """Tooth instruction data returned from API."""

    id: uuid.UUID
    case_id: uuid.UUID
    dentist_id: uuid.UUID
    fdi_tooth_number: int
    instruction_type: ToothInstructionType
    numeric_value: float | None = None
    note_text: str | None = None
    severity: InstructionSeverity
    created_at: datetime
    updated_at: datetime | None = None

    model_config = {"from_attributes": True}


class ToothInstructionSummary(BaseModel):
    """Aggregated tooth instructions grouped by FDI number."""

    instructions_by_tooth: dict[str, list[ToothInstructionResponse]]
    restricted_fdi_numbers: list[int]
    total_count: int
