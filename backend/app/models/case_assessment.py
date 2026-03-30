# case_assessment.py — Technician assessment of a case after review.

import uuid
from datetime import datetime

from sqlalchemy import DateTime, Float, ForeignKey, Integer, String, Text, func
from sqlalchemy.dialects.postgresql import UUID as PG_UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database.base import Base

UUID = PG_UUID(as_uuid=True)


class CaseAssessment(Base):
    __tablename__ = "case_assessments"

    id: Mapped[uuid.UUID] = mapped_column(UUID, primary_key=True, default=uuid.uuid4)
    case_id: Mapped[uuid.UUID] = mapped_column(UUID, ForeignKey("cases.id"), nullable=False, index=True)
    assessor_id: Mapped[uuid.UUID] = mapped_column(UUID, ForeignKey("users.id"), nullable=False)
    feasibility_rating: Mapped[int] = mapped_column(Integer, default=5)  # 1-10
    estimated_complexity: Mapped[str] = mapped_column(String(20), default="MODERATE")  # SIMPLE/MODERATE/COMPLEX
    estimated_stages: Mapped[int | None] = mapped_column(Integer, nullable=True)
    recommended_modifications: Mapped[str | None] = mapped_column(Text, nullable=True)
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    assessor: Mapped["User"] = relationship("User", lazy="selectin")  # noqa: F821
