# correction.py — Technician corrections to AI segmentation → training data.

import uuid
from datetime import datetime

from sqlalchemy import (
    Boolean, DateTime, Float, ForeignKey, Integer, String, Text, func,
)
from sqlalchemy.dialects.postgresql import UUID as PG_UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database.base import Base

UUID = PG_UUID(as_uuid=True)


class Correction(Base):
    """A technician's correction to AI segmentation results."""

    __tablename__ = "corrections"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID, primary_key=True, default=uuid.uuid4,
    )
    case_file_id: Mapped[uuid.UUID] = mapped_column(
        UUID, ForeignKey("case_files.id"), nullable=False, index=True,
    )
    technician_id: Mapped[uuid.UUID] = mapped_column(
        UUID, ForeignKey("users.id"), nullable=False,
    )
    segmentation_result_id: Mapped[uuid.UUID] = mapped_column(
        UUID, ForeignKey("segmentation_results.id"), nullable=False,
    )
    original_segmentation_json: Mapped[str] = mapped_column(Text, nullable=False)
    corrected_segmentation_json: Mapped[str] = mapped_column(Text, nullable=False)
    correction_type: Mapped[str] = mapped_column(String(30), nullable=False)
    confidence_score: Mapped[int] = mapped_column(Integer, default=3)
    time_taken_seconds: Mapped[float] = mapped_column(Float, default=0.0)
    used_for_training: Mapped[bool] = mapped_column(Boolean, default=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(),
    )

    case_file: Mapped["CaseFile"] = relationship("CaseFile")  # noqa: F821
    technician: Mapped["User"] = relationship("User")  # noqa: F821
    segmentation_result: Mapped["SegmentationResult"] = relationship(  # noqa: F821
        "SegmentationResult", backref="corrections",
    )
