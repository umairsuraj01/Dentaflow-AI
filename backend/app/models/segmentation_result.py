# segmentation_result.py — Stores AI output per case file.

import uuid
from datetime import datetime

from sqlalchemy import DateTime, Float, ForeignKey, Integer, String, Text, func
from sqlalchemy.dialects.postgresql import UUID as PG_UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database.base import Base

UUID = PG_UUID(as_uuid=True)


class SegmentationResult(Base):
    """AI segmentation output for a case file."""

    __tablename__ = "segmentation_results"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID, primary_key=True, default=uuid.uuid4,
    )
    case_file_id: Mapped[uuid.UUID] = mapped_column(
        UUID, ForeignKey("case_files.id"), nullable=False, index=True,
    )
    labels_json: Mapped[str] = mapped_column(Text, nullable=False)
    confidence_json: Mapped[str] = mapped_column(Text, nullable=False)
    restricted_teeth_json: Mapped[str] = mapped_column(
        Text, nullable=False, default="[]",
    )
    overridden_points_count: Mapped[int] = mapped_column(
        Integer, default=0,
    )
    model_version: Mapped[str] = mapped_column(
        String(100), nullable=False, default="mock_v1",
    )
    processing_time_seconds: Mapped[float] = mapped_column(
        Float, nullable=False, default=0.0,
    )
    total_points: Mapped[int] = mapped_column(Integer, default=0)
    teeth_found_json: Mapped[str] = mapped_column(
        Text, nullable=False, default="[]",
    )
    colored_mesh_s3_key: Mapped[str | None] = mapped_column(
        String(1000), nullable=True,
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(),
    )

    case_file: Mapped["CaseFile"] = relationship(  # noqa: F821
        "CaseFile", backref="segmentation_results",
    )
