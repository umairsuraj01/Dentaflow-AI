# file_service.py — Business logic for file uploads via S3 presigned URLs.

import uuid
from pathlib import Path

from sqlalchemy.ext.asyncio import AsyncSession

from app.config import get_settings
from app.constants import (
    ALLOWED_IMAGE_FORMATS, ALLOWED_SCAN_FORMATS,
    MAX_IMAGE_FILE_BYTES, MAX_SCAN_FILE_BYTES,
    PRESIGNED_URL_EXPIRY_S, UploadStatus,
)
from app.exceptions import FileUploadError, NotFoundError
from app.models.case_file import CaseFile
from app.models.user import User
from app.repositories.case_repository import CaseFileRepository

settings = get_settings()


class FileService:
    """Handles presigned URL generation and upload confirmation."""

    def __init__(self, db: AsyncSession) -> None:
        self.repo = CaseFileRepository(db)

    async def create_upload_url(
        self,
        case_id: uuid.UUID,
        file_type: str,
        original_filename: str,
        file_size_bytes: int,
        mime_type: str | None,
        user: User,
    ) -> tuple[str, uuid.UUID, str]:
        """Generate presigned URL and create CaseFile record."""
        ext = Path(original_filename).suffix.lstrip(".").lower()
        self._validate_file(ext, file_size_bytes)
        file_id = uuid.uuid4()
        s3_key = f"cases/{case_id}/{file_type}/{file_id}.{ext}"
        stored_filename = f"{file_id}.{ext}"
        case_file = CaseFile(
            id=file_id,
            case_id=case_id,
            file_type=file_type,
            original_filename=original_filename,
            stored_filename=stored_filename,
            s3_key=s3_key,
            s3_bucket=settings.s3_bucket_name,
            file_size_bytes=file_size_bytes,
            mime_type=mime_type,
            file_format=ext,
            upload_status=UploadStatus.UPLOADING.value,
            uploaded_by_id=user.id,
        )
        await self.repo.create(case_file)
        upload_url = self._generate_presigned_url(s3_key)
        return upload_url, file_id, s3_key

    async def confirm_upload(self, file_id: uuid.UUID) -> CaseFile:
        """Mark file upload as complete."""
        case_file = await self.repo.get_by_id(file_id)
        if not case_file:
            raise NotFoundError("File")
        case_file.upload_status = UploadStatus.READY.value
        return await self.repo.update(case_file)

    async def list_files(self, case_id: uuid.UUID) -> list[CaseFile]:
        """Get all files for a case."""
        return await self.repo.list_by_case(case_id)

    async def delete_file(self, file_id: uuid.UUID) -> None:
        """Delete a file record."""
        case_file = await self.repo.get_by_id(file_id)
        if not case_file:
            raise NotFoundError("File")
        await self.repo.delete(case_file)

    async def get_download_url(self, file_id: uuid.UUID) -> str:
        """Generate a presigned download URL."""
        case_file = await self.repo.get_by_id(file_id)
        if not case_file:
            raise NotFoundError("File")
        return self._generate_presigned_download_url(case_file.s3_key)

    def _validate_file(self, ext: str, size: int) -> None:
        """Validate file extension and size."""
        all_allowed = ALLOWED_SCAN_FORMATS | ALLOWED_IMAGE_FORMATS | {"pdf", "dicom"}
        if ext not in all_allowed:
            raise FileUploadError(f"File format .{ext} not allowed")
        if ext in ALLOWED_SCAN_FORMATS and size > MAX_SCAN_FILE_BYTES:
            raise FileUploadError("Scan file exceeds size limit")
        if ext in ALLOWED_IMAGE_FORMATS and size > MAX_IMAGE_FILE_BYTES:
            raise FileUploadError("Image file exceeds size limit")

    def _generate_presigned_url(self, s3_key: str) -> str:
        """Generate a presigned PUT URL for S3 upload."""
        # TODO: Replace with real boto3 S3 client in production
        base = settings.s3_endpoint_url
        bucket = settings.s3_bucket_name
        return f"{base}/{bucket}/{s3_key}?X-Amz-Expires={PRESIGNED_URL_EXPIRY_S}"

    def _generate_presigned_download_url(self, s3_key: str) -> str:
        """Generate a presigned GET URL for S3 download."""
        base = settings.s3_endpoint_url
        bucket = settings.s3_bucket_name
        return f"{base}/{bucket}/{s3_key}?X-Amz-Expires={PRESIGNED_URL_EXPIRY_S}"
