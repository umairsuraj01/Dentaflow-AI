# segmentation_repository.py — Data access for segmentation results and corrections.

import uuid

from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.correction import Correction
from app.models.segmentation_result import SegmentationResult
from app.repositories.base_repository import BaseRepository


class SegmentationRepository(BaseRepository[SegmentationResult]):
    """Segmentation result database operations."""

    def __init__(self, db: AsyncSession) -> None:
        super().__init__(SegmentationResult, db)

    async def get_by_case_file(
        self, case_file_id: uuid.UUID,
    ) -> SegmentationResult | None:
        """Get the latest segmentation result for a case file."""
        stmt = (
            select(SegmentationResult)
            .where(SegmentationResult.case_file_id == case_file_id)
            .order_by(SegmentationResult.created_at.desc())
            .limit(1)
        )
        result = await self.db.execute(stmt)
        return result.scalar_one_or_none()

    async def list_by_case_file(
        self, case_file_id: uuid.UUID,
    ) -> list[SegmentationResult]:
        """Get all segmentation results for a case file."""
        stmt = (
            select(SegmentationResult)
            .where(SegmentationResult.case_file_id == case_file_id)
            .order_by(SegmentationResult.created_at.desc())
        )
        result = await self.db.execute(stmt)
        return list(result.scalars().all())

    async def get_total_count(self) -> int:
        """Count all segmentation results."""
        stmt = select(func.count()).select_from(SegmentationResult)
        result = await self.db.execute(stmt)
        return result.scalar_one()

    async def get_avg_processing_time(self) -> float:
        """Average processing time across all results."""
        stmt = select(func.avg(SegmentationResult.processing_time_seconds))
        result = await self.db.execute(stmt)
        return result.scalar_one() or 0.0


class CorrectionRepository(BaseRepository[Correction]):
    """Correction database operations."""

    def __init__(self, db: AsyncSession) -> None:
        super().__init__(Correction, db)

    async def list_by_case_file(
        self, case_file_id: uuid.UUID,
    ) -> list[Correction]:
        """Get all corrections for a case file."""
        stmt = (
            select(Correction)
            .where(Correction.case_file_id == case_file_id)
            .order_by(Correction.created_at.desc())
        )
        result = await self.db.execute(stmt)
        return list(result.scalars().all())

    async def get_total_count(self) -> int:
        """Count all corrections."""
        stmt = select(func.count()).select_from(Correction)
        result = await self.db.execute(stmt)
        return result.scalar_one()

    async def get_training_count(self) -> int:
        """Count corrections used for training."""
        stmt = (
            select(func.count())
            .select_from(Correction)
            .where(Correction.used_for_training.is_(True))
        )
        result = await self.db.execute(stmt)
        return result.scalar_one()

    async def get_avg_confidence(self) -> float:
        """Average technician confidence score."""
        stmt = select(func.avg(Correction.confidence_score))
        result = await self.db.execute(stmt)
        return result.scalar_one() or 0.0
