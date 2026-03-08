# case_file.py — Uploaded file metadata for a case.

import uuid
from datetime import datetime

from sqlalchemy import (
    Boolean, DateTime, ForeignKey, Integer, String, func,
)
from sqlalchemy.dialects.postgresql import UUID as PG_UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.constants import FileType, UploadStatus
from app.database.base import Base

UUID = PG_UUID(as_uuid=True)


class CaseFile(Base):
    """Metadata record for a file uploaded to a case."""

    __tablename__ = "case_files"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID, primary_key=True, default=uuid.uuid4
    )
    case_id: Mapped[uuid.UUID] = mapped_column(
        UUID, ForeignKey("cases.id"), nullable=False, index=True
    )
    file_type: Mapped[str] = mapped_column(
        String(30), nullable=False, default=FileType.OTHER.value
    )
    original_filename: Mapped[str] = mapped_column(String(500), nullable=False)
    stored_filename: Mapped[str] = mapped_column(String(500), nullable=False)
    s3_key: Mapped[str] = mapped_column(String(1000), nullable=False)
    s3_bucket: Mapped[str] = mapped_column(String(255), nullable=False)
    file_size_bytes: Mapped[int] = mapped_column(Integer, default=0)
    mime_type: Mapped[str | None] = mapped_column(String(100), nullable=True)
    file_format: Mapped[str | None] = mapped_column(String(20), nullable=True)
    upload_status: Mapped[str] = mapped_column(
        String(20), nullable=False, default=UploadStatus.UPLOADING.value
    )
    is_ai_processed: Mapped[bool] = mapped_column(Boolean, default=False)
    ai_processing_status: Mapped[str | None] = mapped_column(
        String(30), nullable=True
    )
    ai_processing_job_id: Mapped[str | None] = mapped_column(
        String(100), nullable=True
    )
    uploaded_by_id: Mapped[uuid.UUID] = mapped_column(
        UUID, ForeignKey("users.id"), nullable=False
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )

    case: Mapped["Case"] = relationship("Case", back_populates="files")  # noqa: F821
