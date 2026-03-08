# segmentation_service.py — Business logic for AI segmentation operations.

from __future__ import annotations

import uuid
import logging

from sqlalchemy.ext.asyncio import AsyncSession

from app.config import get_settings
from app.constants import AIStagingState
from app.exceptions import NotFoundError, BadRequestError
from app.models.case_file import CaseFile
from app.models.correction import Correction
from app.models.segmentation_result import SegmentationResult
from app.models.user import User
from app.repositories.segmentation_repository import (
    CorrectionRepository,
    SegmentationRepository,
)
from app.schemas.segmentation import (
    AIStatsResponse,
    CorrectionCreate,
    SegmentationJobStatus,
)

logger = logging.getLogger(__name__)
settings = get_settings()


class SegmentationService:
    """AI segmentation business logic."""

    def __init__(self, db: AsyncSession) -> None:
        self.db = db
        self.seg_repo = SegmentationRepository(db)
        self.corr_repo = CorrectionRepository(db)

    async def get_segmentation(
        self, case_file_id: uuid.UUID,
    ) -> SegmentationResult:
        """Get the latest segmentation result for a case file."""
        result = await self.seg_repo.get_by_case_file(case_file_id)
        if not result:
            raise NotFoundError("No segmentation result found for this file")
        return result

    async def trigger_segmentation(
        self, case_file_id: uuid.UUID, case_id: uuid.UUID,
    ) -> str:
        """Trigger AI segmentation for a case file. Returns job ID."""
        case_file = await self.db.get(CaseFile, case_file_id)
        if not case_file:
            raise NotFoundError("Case file not found")

        if case_file.ai_processing_status in (
            AIStagingState.DOWNLOADING.value,
            AIStagingState.PREPROCESSING.value,
            AIStagingState.RUNNING_AI.value,
            AIStagingState.POSTPROCESSING.value,
        ):
            raise BadRequestError("AI processing already in progress")

        # Update status
        case_file.ai_processing_status = AIStagingState.PENDING.value
        await self.db.flush()

        # Dispatch Celery task
        from app.workers.tasks.segmentation_task import run_segmentation
        task = run_segmentation.delay(str(case_file_id), str(case_id))

        case_file.ai_processing_job_id = task.id
        await self.db.flush()

        return task.id

    async def get_job_status(
        self, case_file_id: uuid.UUID,
    ) -> SegmentationJobStatus:
        """Get current AI processing job status."""
        case_file = await self.db.get(CaseFile, case_file_id)
        if not case_file:
            raise NotFoundError("Case file not found")

        job_id = case_file.ai_processing_job_id or ""
        state = case_file.ai_processing_status or "NONE"

        # Try to get Celery task info if job exists
        error = None
        if job_id and state == AIStagingState.FAILED.value:
            try:
                from app.workers.tasks.segmentation_task import run_segmentation
                result = run_segmentation.AsyncResult(job_id)
                if result.failed():
                    error = str(result.result)
            except Exception:
                pass

        return SegmentationJobStatus(
            job_id=job_id,
            case_file_id=case_file_id,
            state=state,
            stage=state,
            error=error,
        )

    async def create_correction(
        self, case_file_id: uuid.UUID, data: CorrectionCreate, user: User,
    ) -> Correction:
        """Save a technician correction to AI segmentation."""
        seg_result = await self.seg_repo.get_by_id(data.segmentation_result_id)
        if not seg_result:
            raise NotFoundError("Segmentation result not found")

        correction = Correction(
            id=uuid.uuid4(),
            case_file_id=case_file_id,
            technician_id=user.id,
            segmentation_result_id=data.segmentation_result_id,
            original_segmentation_json=data.original_segmentation_json,
            corrected_segmentation_json=data.corrected_segmentation_json,
            correction_type=data.correction_type,
            confidence_score=data.confidence_score,
            time_taken_seconds=data.time_taken_seconds,
        )
        return await self.corr_repo.create(correction)

    async def list_corrections(
        self, case_file_id: uuid.UUID,
    ) -> list[Correction]:
        """List all corrections for a case file."""
        return await self.corr_repo.list_by_case_file(case_file_id)

    async def get_ai_stats(self) -> AIStatsResponse:
        """Get aggregate AI pipeline statistics."""
        total_seg = await self.seg_repo.get_total_count()
        total_corr = await self.corr_repo.get_total_count()
        training_count = await self.corr_repo.get_training_count()
        avg_time = await self.seg_repo.get_avg_processing_time()
        avg_conf = await self.corr_repo.get_avg_confidence()

        return AIStatsResponse(
            total_segmentations=total_seg,
            total_corrections=total_corr,
            corrections_used_for_training=training_count,
            average_processing_time=round(avg_time, 2),
            average_confidence_score=round(avg_conf, 2),
            model_version=settings.ai_model_version,
        )
