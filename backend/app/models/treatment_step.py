# treatment_step.py — Individual step within a treatment plan.

import uuid
from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, Integer, String, Text, func
from sqlalchemy.dialects.postgresql import UUID as PG_UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database.base import Base

UUID = PG_UUID(as_uuid=True)


class TreatmentStep(Base):
    """A single step in a treatment plan (step 0 = initial position)."""

    __tablename__ = "treatment_steps"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID, primary_key=True, default=uuid.uuid4,
    )
    plan_id: Mapped[uuid.UUID] = mapped_column(
        UUID, ForeignKey("treatment_plans.id"), nullable=False, index=True,
    )
    step_number: Mapped[int] = mapped_column(Integer, nullable=False)
    label: Mapped[str | None] = mapped_column(String(100), nullable=True)
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(),
    )

    plan: Mapped["TreatmentPlan"] = relationship(  # noqa: F821
        "TreatmentPlan", back_populates="steps",
    )
    transforms: Mapped[list["ToothTransform"]] = relationship(  # noqa: F821
        "ToothTransform",
        back_populates="step",
        cascade="all, delete-orphan",
    )
