# patient_service.py — Business logic for patient management.

import uuid

from sqlalchemy.ext.asyncio import AsyncSession

from app.exceptions import AuthorizationError, NotFoundError
from app.models.patient import Patient
from app.models.user import User
from app.repositories.patient_repository import PatientRepository
from app.schemas.patient import PatientCreate, PatientUpdate


class PatientService:
    """Handles patient CRUD with ownership checks."""

    def __init__(self, db: AsyncSession) -> None:
        self.repo = PatientRepository(db)

    async def create(
        self, data: PatientCreate, dentist: User
    ) -> Patient:
        """Create a patient owned by the dentist."""
        patient = Patient(
            dentist_id=dentist.id,
            first_name=data.first_name,
            last_name=data.last_name,
            date_of_birth=data.date_of_birth,
            gender=data.gender,
            patient_reference=data.patient_reference,
            notes=data.notes,
        )
        return await self.repo.create(patient)

    async def get(
        self, patient_id: uuid.UUID, user: User
    ) -> Patient:
        """Get patient by ID with ownership check."""
        patient = await self.repo.get_by_id(patient_id)
        if not patient or patient.is_deleted:
            raise NotFoundError("Patient")
        self._check_access(patient, user)
        return patient

    async def list_patients(
        self, user: User, search: str | None = None,
        skip: int = 0, limit: int = 50,
    ) -> tuple[list[Patient], int]:
        """List patients for a dentist."""
        if search:
            patients = await self.repo.search(user.id, search, skip, limit)
        else:
            patients = await self.repo.list_by_dentist(user.id, skip, limit)
        total = await self.repo.count_by_dentist(user.id)
        return patients, total

    async def update(
        self, patient_id: uuid.UUID, data: PatientUpdate, user: User
    ) -> Patient:
        """Update patient details."""
        patient = await self.get(patient_id, user)
        for field, value in data.model_dump(exclude_unset=True).items():
            setattr(patient, field, value)
        return await self.repo.update(patient)

    async def soft_delete(
        self, patient_id: uuid.UUID, user: User
    ) -> None:
        """Soft-delete a patient."""
        patient = await self.get(patient_id, user)
        patient.is_deleted = True
        await self.repo.update(patient)

    def _check_access(self, patient: Patient, user: User) -> None:
        """Verify user can access this patient."""
        if user.role in ("SUPER_ADMIN", "LAB_MANAGER"):
            return
        if patient.dentist_id != user.id:
            raise AuthorizationError("Not your patient")
