# treatment_plan.py — Treatment plan model for a dental case.

import uuid
from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, Integer, String, Text, func
from sqlalchemy.dialects.postgresql import UUID as PG_UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database.base import Base

UUID = PG_UUID(as_uuid=True)


class TreatmentPlan(Base):
    """A treatment plan associated with a dental case."""

    __tablename__ = "treatment_plans"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID, primary_key=True, default=uuid.uuid4,
    )
    case_id: Mapped[uuid.UUID] = mapped_column(
        UUID, ForeignKey("cases.id"), nullable=False, index=True,
    )
    created_by_id: Mapped[uuid.UUID] = mapped_column(
        UUID, ForeignKey("users.id"), nullable=False, index=True,
    )
    name: Mapped[str] = mapped_column(String(200), nullable=False)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    extraction_id: Mapped[str | None] = mapped_column(
        String(100), nullable=True,
    )
    total_steps: Mapped[int] = mapped_column(Integer, default=0)
    status: Mapped[str] = mapped_column(String(20), default="DRAFT")
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(),
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now(),
    )

    steps: Mapped[list["TreatmentStep"]] = relationship(  # noqa: F821
        "TreatmentStep",
        back_populates="plan",
        cascade="all, delete-orphan",
        order_by="TreatmentStep.step_number",
    )
