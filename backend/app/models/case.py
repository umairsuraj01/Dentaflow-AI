# case.py — Case ORM model representing a dental treatment case.

import uuid
from datetime import datetime

from sqlalchemy import (
    Boolean, DateTime, Float, ForeignKey, Integer, String, Text, func,
)
from sqlalchemy.dialects.postgresql import UUID as PG_UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.constants import CasePriority, CaseStatus, TreatmentType
from app.database.base import Base

UUID = PG_UUID(as_uuid=True)


class Case(Base):
    """Dental treatment case with lifecycle tracking."""

    __tablename__ = "cases"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID, primary_key=True, default=uuid.uuid4
    )
    patient_id: Mapped[uuid.UUID] = mapped_column(
        UUID, ForeignKey("patients.id"), nullable=False, index=True
    )
    dentist_id: Mapped[uuid.UUID] = mapped_column(
        UUID, ForeignKey("users.id"), nullable=False, index=True
    )
    technician_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID, ForeignKey("users.id"), nullable=True, index=True
    )
    case_number: Mapped[str] = mapped_column(
        String(20), unique=True, index=True, nullable=False
    )
    status: Mapped[str] = mapped_column(
        String(30), nullable=False, default=CaseStatus.DRAFT.value
    )
    treatment_type: Mapped[str] = mapped_column(
        String(30), nullable=False, default=TreatmentType.FULL_ARCH.value
    )
    priority: Mapped[str] = mapped_column(
        String(20), nullable=False, default=CasePriority.NORMAL.value
    )
    arch_type: Mapped[str | None] = mapped_column(String(30), nullable=True)
    chief_complaint: Mapped[str | None] = mapped_column(Text, nullable=True)
    treatment_goals: Mapped[str | None] = mapped_column(Text, nullable=True)
    special_instructions: Mapped[str | None] = mapped_column(Text, nullable=True)
    target_turnaround_days: Mapped[int] = mapped_column(Integer, default=3)
    price_usd: Mapped[float | None] = mapped_column(Float, nullable=True)
    due_date: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    submitted_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    managed_by_platform: Mapped[bool] = mapped_column(
        Boolean, default=False
    )
    completed_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )

    # Relationships for eager loading
    files: Mapped[list["CaseFile"]] = relationship(  # noqa: F821
        "CaseFile", back_populates="case", lazy="selectin"
    )
    notes: Mapped[list["CaseNote"]] = relationship(  # noqa: F821
        "CaseNote", back_populates="case", lazy="selectin"
    )
    tooth_instructions: Mapped[list["ToothInstruction"]] = relationship(  # noqa: F821
        "ToothInstruction", back_populates="case", lazy="selectin"
    )
