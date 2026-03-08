# case_repository.py — Data access layer for Case and related models.

import uuid
from datetime import datetime

from sqlalchemy import select, func, or_
from sqlalchemy.ext.asyncio import AsyncSession

from app.constants import CaseStatus
from app.models.case import Case
from app.models.case_file import CaseFile
from app.models.case_note import CaseNote
from app.models.patient import Patient
from app.repositories.base_repository import BaseRepository


class CaseRepository(BaseRepository[Case]):
    """Case-specific database operations."""

    def __init__(self, db: AsyncSession) -> None:
        super().__init__(Case, db)

    async def get_next_case_number(self, prefix: str, year: int) -> str:
        """Generate the next sequential case number like DF-2026-000001."""
        pattern = f"{prefix}-{year}-%"
        stmt = (
            select(func.count())
            .select_from(Case)
            .where(Case.case_number.like(pattern))
        )
        result = await self.db.execute(stmt)
        count = result.scalar_one()
        return f"{prefix}-{year}-{count + 1:06d}"

    async def list_for_dentist(
        self, dentist_id: uuid.UUID, status: str | None, search: str | None,
        skip: int = 0, limit: int = 20,
    ) -> tuple[list[Case], int]:
        """List cases for a dentist with optional filtering."""
        stmt = select(Case).where(Case.dentist_id == dentist_id)
        count_stmt = select(func.count()).select_from(Case).where(Case.dentist_id == dentist_id)
        stmt, count_stmt = self._apply_filters(stmt, count_stmt, status, search)
        stmt = stmt.order_by(Case.created_at.desc()).offset(skip).limit(limit)
        result = await self.db.execute(stmt)
        total = (await self.db.execute(count_stmt)).scalar_one()
        return list(result.scalars().all()), total

    async def list_for_technician(
        self, technician_id: uuid.UUID, status: str | None, search: str | None,
        skip: int = 0, limit: int = 20,
    ) -> tuple[list[Case], int]:
        """List cases assigned to a technician."""
        stmt = select(Case).where(Case.technician_id == technician_id)
        count_stmt = (
            select(func.count()).select_from(Case).where(Case.technician_id == technician_id)
        )
        stmt, count_stmt = self._apply_filters(stmt, count_stmt, status, search)
        stmt = stmt.order_by(Case.created_at.desc()).offset(skip).limit(limit)
        result = await self.db.execute(stmt)
        total = (await self.db.execute(count_stmt)).scalar_one()
        return list(result.scalars().all()), total

    async def list_all(
        self, status: str | None, search: str | None,
        skip: int = 0, limit: int = 20,
    ) -> tuple[list[Case], int]:
        """List all cases (admin/manager)."""
        stmt = select(Case)
        count_stmt = select(func.count()).select_from(Case)
        stmt, count_stmt = self._apply_filters(stmt, count_stmt, status, search)
        stmt = stmt.order_by(Case.created_at.desc()).offset(skip).limit(limit)
        result = await self.db.execute(stmt)
        total = (await self.db.execute(count_stmt)).scalar_one()
        return list(result.scalars().all()), total

    async def count_by_status(
        self, user_id: uuid.UUID | None, role: str
    ) -> dict[str, int]:
        """Count cases grouped by status for dashboard stats."""
        stmt = select(Case.status, func.count()).group_by(Case.status)
        if role == "DENTIST" and user_id:
            stmt = stmt.where(Case.dentist_id == user_id)
        elif role == "TECHNICIAN" and user_id:
            stmt = stmt.where(Case.technician_id == user_id)
        result = await self.db.execute(stmt)
        return dict(result.all())

    def _apply_filters(self, stmt, count_stmt, status, search):
        """Apply status and search filters to queries."""
        if status:
            stmt = stmt.where(Case.status == status)
            count_stmt = count_stmt.where(Case.status == status)
        if search:
            search_filter = or_(
                Case.case_number.ilike(f"%{search}%"),
            )
            stmt = stmt.where(search_filter)
            count_stmt = count_stmt.where(search_filter)
        return stmt, count_stmt


class CaseFileRepository(BaseRepository[CaseFile]):
    """CaseFile-specific database operations."""

    def __init__(self, db: AsyncSession) -> None:
        super().__init__(CaseFile, db)

    async def list_by_case(self, case_id: uuid.UUID) -> list[CaseFile]:
        """Get all files for a case."""
        stmt = select(CaseFile).where(CaseFile.case_id == case_id)
        result = await self.db.execute(stmt)
        return list(result.scalars().all())


class CaseNoteRepository(BaseRepository[CaseNote]):
    """CaseNote-specific database operations."""

    def __init__(self, db: AsyncSession) -> None:
        super().__init__(CaseNote, db)

    async def list_by_case(
        self, case_id: uuid.UUID, skip: int = 0, limit: int = 50
    ) -> list[CaseNote]:
        """Get all notes for a case, newest first."""
        stmt = (
            select(CaseNote)
            .where(CaseNote.case_id == case_id)
            .order_by(CaseNote.created_at.desc())
            .offset(skip)
            .limit(limit)
        )
        result = await self.db.execute(stmt)
        return list(result.scalars().all())
