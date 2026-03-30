# case.py — Request/response schemas for case management endpoints.

import uuid
from datetime import datetime

from pydantic import BaseModel, Field

from app.constants import CasePriority, CaseStatus, TreatmentType


class CaseCreate(BaseModel):
    """Create a new case."""

    patient_id: uuid.UUID
    treatment_type: TreatmentType = TreatmentType.FULL_ARCH
    priority: CasePriority = CasePriority.NORMAL
    arch_type: str | None = None
    chief_complaint: str | None = None
    treatment_goals: str | None = None
    special_instructions: str | None = None
    target_turnaround_days: int = Field(3, ge=0, le=30)
    # Clinical fields
    patient_type: str | None = None
    retainer_preference: str | None = None
    passive_aligners: str | None = None
    aligner_shipment: str | None = None
    rescan_after_ipr: bool = False
    midline_instruction: str | None = None
    overjet_instruction: str | None = None
    overbite_instruction: str | None = None
    crossbite_instruction: str | None = None
    right_canine_class: str | None = None
    left_canine_class: str | None = None
    right_molar_class: str | None = None
    left_molar_class: str | None = None
    ipr_preference: str | None = None
    proclination_preference: str | None = None
    expansion_preference: str | None = None
    extraction_preference: str | None = None
    ipr_prescription: str | None = None
    auxiliary_type: str | None = None


class CaseUpdate(BaseModel):
    """Update case details."""

    treatment_type: TreatmentType | None = None
    priority: CasePriority | None = None
    arch_type: str | None = None
    chief_complaint: str | None = None
    treatment_goals: str | None = None
    special_instructions: str | None = None
    target_turnaround_days: int | None = Field(None, ge=0, le=30)
    patient_type: str | None = None
    retainer_preference: str | None = None
    passive_aligners: str | None = None
    aligner_shipment: str | None = None
    rescan_after_ipr: bool | None = None
    midline_instruction: str | None = None
    overjet_instruction: str | None = None
    overbite_instruction: str | None = None
    crossbite_instruction: str | None = None
    right_canine_class: str | None = None
    left_canine_class: str | None = None
    right_molar_class: str | None = None
    left_molar_class: str | None = None
    ipr_preference: str | None = None
    proclination_preference: str | None = None
    expansion_preference: str | None = None
    extraction_preference: str | None = None
    ipr_prescription: str | None = None
    auxiliary_type: str | None = None


class CaseAssign(BaseModel):
    """Assign a technician to a case."""

    technician_id: uuid.UUID


class CaseFileResponse(BaseModel):
    """File metadata returned from API."""

    id: uuid.UUID
    case_id: uuid.UUID
    file_type: str
    original_filename: str
    file_size_bytes: int
    mime_type: str | None = None
    file_format: str | None = None
    upload_status: str
    is_ai_processed: bool
    uploaded_by_id: uuid.UUID
    created_at: datetime

    model_config = {"from_attributes": True}


class CaseNoteCreate(BaseModel):
    """Add a note to a case."""

    note_text: str = Field(..., min_length=1, max_length=5000)
    note_type: str = "GENERAL"
    is_visible_to_dentist: bool = True


class CaseNoteResponse(BaseModel):
    """Case note data returned from API."""

    id: uuid.UUID
    case_id: uuid.UUID
    author_id: uuid.UUID
    note_text: str
    note_type: str
    is_visible_to_dentist: bool
    created_at: datetime

    model_config = {"from_attributes": True}


class UploadUrlRequest(BaseModel):
    """Request a presigned upload URL."""

    file_type: str
    original_filename: str
    file_size_bytes: int = Field(..., gt=0)
    mime_type: str | None = None


class UploadUrlResponse(BaseModel):
    """Presigned URL and file record ID."""

    upload_url: str
    file_id: uuid.UUID
    s3_key: str


class UploadConfirm(BaseModel):
    """Confirm a file upload is complete."""

    file_id: uuid.UUID


class CaseResponse(BaseModel):
    """Full case data returned from API."""

    id: uuid.UUID
    patient_id: uuid.UUID
    dentist_id: uuid.UUID
    technician_id: uuid.UUID | None = None
    case_number: str
    status: CaseStatus
    treatment_type: TreatmentType
    priority: CasePriority
    arch_type: str | None = None
    chief_complaint: str | None = None
    treatment_goals: str | None = None
    special_instructions: str | None = None
    patient_type: str | None = None
    retainer_preference: str | None = None
    passive_aligners: str | None = None
    aligner_shipment: str | None = None
    rescan_after_ipr: bool = False
    midline_instruction: str | None = None
    overjet_instruction: str | None = None
    overbite_instruction: str | None = None
    crossbite_instruction: str | None = None
    right_canine_class: str | None = None
    left_canine_class: str | None = None
    right_molar_class: str | None = None
    left_molar_class: str | None = None
    ipr_preference: str | None = None
    proclination_preference: str | None = None
    expansion_preference: str | None = None
    extraction_preference: str | None = None
    ipr_prescription: str | None = None
    auxiliary_type: str | None = None
    managed_by_platform: bool = False
    target_turnaround_days: int
    price_usd: float | None = None
    due_date: datetime | None = None
    submitted_at: datetime | None = None
    completed_at: datetime | None = None
    created_at: datetime
    updated_at: datetime
    files: list[CaseFileResponse] = []
    notes: list[CaseNoteResponse] = []

    model_config = {"from_attributes": True}


class DashboardStats(BaseModel):
    """Role-based dashboard statistics."""

    active_cases: int = 0
    pending_review: int = 0
    completed: int = 0
    total_revenue: float = 0.0
