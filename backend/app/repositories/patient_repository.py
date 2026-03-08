# patient_repository.py — Data access layer for Patient model.

import uuid

from sqlalchemy import or_, select, func
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.patient import Patient
from app.repositories.base_repository import BaseRepository


class PatientRepository(BaseRepository[Patient]):
    """Patient-specific database operations."""

    def __init__(self, db: AsyncSession) -> None:
        super().__init__(Patient, db)

    async def search(
        self, dentist_id: uuid.UUID, query: str, skip: int = 0, limit: int = 20
    ) -> list[Patient]:
        """Search patients by name or reference for a dentist."""
        stmt = (
            select(Patient)
            .where(Patient.dentist_id == dentist_id, Patient.is_deleted == False)
            .where(
                or_(
                    Patient.first_name.ilike(f"%{query}%"),
                    Patient.last_name.ilike(f"%{query}%"),
                    Patient.patient_reference.ilike(f"%{query}%"),
                )
            )
            .offset(skip)
            .limit(limit)
        )
        result = await self.db.execute(stmt)
        return list(result.scalars().all())

    async def list_by_dentist(
        self, dentist_id: uuid.UUID, skip: int = 0, limit: int = 50
    ) -> list[Patient]:
        """List all non-deleted patients for a dentist."""
        stmt = (
            select(Patient)
            .where(Patient.dentist_id == dentist_id, Patient.is_deleted == False)
            .order_by(Patient.last_name)
            .offset(skip)
            .limit(limit)
        )
        result = await self.db.execute(stmt)
        return list(result.scalars().all())

    async def count_by_dentist(self, dentist_id: uuid.UUID) -> int:
        """Count non-deleted patients for a dentist."""
        stmt = (
            select(func.count())
            .select_from(Patient)
            .where(Patient.dentist_id == dentist_id, Patient.is_deleted == False)
        )
        result = await self.db.execute(stmt)
        return result.scalar_one()
