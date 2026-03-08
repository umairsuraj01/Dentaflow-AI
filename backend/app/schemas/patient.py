# patient.py — Request/response schemas for patient endpoints.

import uuid
from datetime import date, datetime

from pydantic import BaseModel, Field


class PatientCreate(BaseModel):
    """Create a new patient record."""

    first_name: str = Field(..., min_length=1, max_length=255)
    last_name: str = Field(..., min_length=1, max_length=255)
    date_of_birth: date | None = None
    gender: str | None = Field(None, max_length=20)
    patient_reference: str | None = Field(None, max_length=100)
    notes: str | None = None


class PatientUpdate(BaseModel):
    """Update an existing patient."""

    first_name: str | None = Field(None, min_length=1, max_length=255)
    last_name: str | None = Field(None, min_length=1, max_length=255)
    date_of_birth: date | None = None
    gender: str | None = Field(None, max_length=20)
    patient_reference: str | None = Field(None, max_length=100)
    notes: str | None = None


class PatientResponse(BaseModel):
    """Patient data returned from API."""

    id: uuid.UUID
    dentist_id: uuid.UUID
    first_name: str
    last_name: str
    date_of_birth: date | None = None
    gender: str | None = None
    patient_reference: str | None = None
    notes: str | None = None
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}
