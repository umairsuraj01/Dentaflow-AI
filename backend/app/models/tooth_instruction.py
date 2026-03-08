# tooth_instruction.py — Per-tooth clinical instructions from the dentist.

import uuid
from datetime import datetime

from sqlalchemy import DateTime, Float, ForeignKey, Integer, String, Text, func
from sqlalchemy.dialects.postgresql import UUID as PG_UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.constants import InstructionSeverity, ToothInstructionType
from app.database.base import Base

UUID = PG_UUID(as_uuid=True)


class ToothInstruction(Base):
    """Clinical instruction for a specific tooth on a case."""

    __tablename__ = "tooth_instructions"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID, primary_key=True, default=uuid.uuid4
    )
    case_id: Mapped[uuid.UUID] = mapped_column(
        UUID, ForeignKey("cases.id"), nullable=False, index=True
    )
    dentist_id: Mapped[uuid.UUID] = mapped_column(
        UUID, ForeignKey("users.id"), nullable=False
    )
    fdi_tooth_number: Mapped[int] = mapped_column(Integer, nullable=False)
    instruction_type: Mapped[str] = mapped_column(String(50), nullable=False)
    numeric_value: Mapped[float | None] = mapped_column(Float, nullable=True)
    note_text: Mapped[str | None] = mapped_column(Text, nullable=True)
    severity: Mapped[str] = mapped_column(
        String(20), nullable=False, default=InstructionSeverity.MUST_RESPECT.value
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )
    updated_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True, onupdate=func.now()
    )

    case: Mapped["Case"] = relationship(  # noqa: F821
        "Case", back_populates="tooth_instructions"
    )
