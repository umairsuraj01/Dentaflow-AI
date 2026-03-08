# case_service.py — Business logic for case lifecycle management.

import uuid
from datetime import datetime, timedelta, timezone

from sqlalchemy.ext.asyncio import AsyncSession

from app.constants import (
    APP_CASE_PREFIX, CasePriority, CaseStatus,
    PRICE_NORMAL_USD, PRICE_RUSH_USD, PRICE_URGENT_USD,
    TURNAROUND_NORMAL_DAYS, TURNAROUND_RUSH_DAYS, TURNAROUND_URGENT_DAYS,
    UserRole,
)
from app.exceptions import AuthorizationError, NotFoundError, ValidationError
from app.models.case import Case
from app.models.case_note import CaseNote
from app.models.user import User
from app.repositories.case_repository import (
    CaseNoteRepository, CaseRepository,
)
from app.schemas.case import CaseCreate, CaseNoteCreate, CaseUpdate


PRIORITY_PRICE = {
    CasePriority.NORMAL.value: PRICE_NORMAL_USD,
    CasePriority.URGENT.value: PRICE_URGENT_USD,
    CasePriority.RUSH.value: PRICE_RUSH_USD,
}

PRIORITY_TURNAROUND = {
    CasePriority.NORMAL.value: TURNAROUND_NORMAL_DAYS,
    CasePriority.URGENT.value: TURNAROUND_URGENT_DAYS,
    CasePriority.RUSH.value: TURNAROUND_RUSH_DAYS,
}


class CaseService:
    """Handles case creation, status transitions, and queries."""

    def __init__(self, db: AsyncSession) -> None:
        self.repo = CaseRepository(db)
        self.note_repo = CaseNoteRepository(db)

    async def create(self, data: CaseCreate, dentist: User) -> Case:
        """Create a new case with auto-generated case number."""
        year = datetime.now(timezone.utc).year
        case_number = await self.repo.get_next_case_number(APP_CASE_PREFIX, year)
        price = PRIORITY_PRICE.get(data.priority.value, PRICE_NORMAL_USD)
        turnaround = PRIORITY_TURNAROUND.get(
            data.priority.value, TURNAROUND_NORMAL_DAYS
        )
        case = Case(
            patient_id=data.patient_id,
            dentist_id=dentist.id,
            case_number=case_number,
            treatment_type=data.treatment_type.value,
            priority=data.priority.value,
            arch_type=data.arch_type,
            chief_complaint=data.chief_complaint,
            treatment_goals=data.treatment_goals,
            special_instructions=data.special_instructions,
            target_turnaround_days=turnaround,
            price_usd=price,
        )
        return await self.repo.create(case)

    async def get(self, case_id: uuid.UUID, user: User) -> Case:
        """Get case by ID with access control."""
        case = await self.repo.get_by_id(case_id)
        if not case:
            raise NotFoundError("Case")
        self._check_access(case, user)
        return case

    async def list_cases(
        self, user: User, status: str | None = None,
        search: str | None = None, skip: int = 0, limit: int = 20,
    ) -> tuple[list[Case], int]:
        """List cases filtered by user role."""
        if user.role in (UserRole.SUPER_ADMIN.value, UserRole.LAB_MANAGER.value):
            return await self.repo.list_all(status, search, skip, limit)
        if user.role == UserRole.DENTIST.value:
            return await self.repo.list_for_dentist(
                user.id, status, search, skip, limit
            )
        return await self.repo.list_for_technician(
            user.id, status, search, skip, limit
        )

    async def update(
        self, case_id: uuid.UUID, data: CaseUpdate, user: User
    ) -> Case:
        """Update case details (draft only)."""
        case = await self.get(case_id, user)
        if case.status != CaseStatus.DRAFT.value:
            raise ValidationError("Can only edit draft cases")
        for field, value in data.model_dump(exclude_unset=True).items():
            val = value.value if hasattr(value, "value") else value
            setattr(case, field, val)
        if data.priority:
            case.price_usd = PRIORITY_PRICE.get(
                data.priority.value, case.price_usd
            )
        return await self.repo.update(case)

    async def submit(self, case_id: uuid.UUID, user: User) -> Case:
        """Submit a draft case for processing."""
        case = await self.get(case_id, user)
        if case.status != CaseStatus.DRAFT.value:
            raise ValidationError("Case is not in draft status")
        case.status = CaseStatus.SUBMITTED.value
        case.submitted_at = datetime.now(timezone.utc)
        case.due_date = datetime.now(timezone.utc) + timedelta(
            days=case.target_turnaround_days
        )
        return await self.repo.update(case)

    async def assign(
        self, case_id: uuid.UUID, technician_id: uuid.UUID, user: User
    ) -> Case:
        """Assign a technician to a case."""
        case = await self.get(case_id, user)
        if user.role not in (
            UserRole.SUPER_ADMIN.value, UserRole.LAB_MANAGER.value
        ):
            raise AuthorizationError("Only managers can assign cases")
        case.technician_id = technician_id
        case.status = CaseStatus.ASSIGNED.value
        return await self.repo.update(case)

    async def approve(self, case_id: uuid.UUID, user: User) -> Case:
        """Dentist approves a case in review."""
        case = await self.get(case_id, user)
        if case.status != CaseStatus.REVIEW.value:
            raise ValidationError("Case is not in review status")
        case.status = CaseStatus.APPROVED.value
        return await self.repo.update(case)

    async def request_revision(
        self, case_id: uuid.UUID, user: User, reason: str
    ) -> Case:
        """Dentist requests revision on a case."""
        case = await self.get(case_id, user)
        if case.status != CaseStatus.REVIEW.value:
            raise ValidationError("Case is not in review status")
        case.status = CaseStatus.REVISION_REQUESTED.value
        note = CaseNote(
            case_id=case_id,
            author_id=user.id,
            note_text=reason,
            note_type="REVISION_REQUEST",
        )
        await self.note_repo.create(note)
        return await self.repo.update(case)

    async def cancel(self, case_id: uuid.UUID, user: User) -> Case:
        """Cancel a case."""
        case = await self.get(case_id, user)
        case.status = CaseStatus.CANCELLED.value
        return await self.repo.update(case)

    async def add_note(
        self, case_id: uuid.UUID, data: CaseNoteCreate, user: User
    ) -> CaseNote:
        """Add a note to a case."""
        await self.get(case_id, user)
        note = CaseNote(
            case_id=case_id,
            author_id=user.id,
            note_text=data.note_text,
            note_type=data.note_type,
            is_visible_to_dentist=data.is_visible_to_dentist,
        )
        return await self.note_repo.create(note)

    async def list_notes(
        self, case_id: uuid.UUID, user: User,
        skip: int = 0, limit: int = 50,
    ) -> list[CaseNote]:
        """List notes for a case."""
        await self.get(case_id, user)
        return await self.note_repo.list_by_case(case_id, skip, limit)

    async def get_dashboard_stats(self, user: User) -> dict[str, int]:
        """Get role-based dashboard statistics."""
        return await self.repo.count_by_status(user.id, user.role)

    def _check_access(self, case: Case, user: User) -> None:
        """Verify user can access this case."""
        if user.role in (UserRole.SUPER_ADMIN.value, UserRole.LAB_MANAGER.value):
            return
        if user.role == UserRole.DENTIST.value and case.dentist_id == user.id:
            return
        if user.role == UserRole.TECHNICIAN.value and case.technician_id == user.id:
            return
        raise AuthorizationError("Access denied to this case")
