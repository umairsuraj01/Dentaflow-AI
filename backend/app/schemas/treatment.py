# treatment.py — Request/response schemas for treatment plan endpoints.

import uuid
from datetime import datetime

from pydantic import BaseModel, Field


# ---------------------------------------------------------------------------
# Tooth Transform
# ---------------------------------------------------------------------------

class ToothTransformCreate(BaseModel):
    """Single tooth transform within a step."""

    fdi_number: int = Field(..., ge=11, le=48, description="FDI tooth number")
    pos_x: float = 0.0
    pos_y: float = 0.0
    pos_z: float = 0.0
    rot_x: float = 0.0
    rot_y: float = 0.0
    rot_z: float = 0.0


class ToothTransformResponse(BaseModel):
    """Tooth transform returned from API."""

    id: uuid.UUID
    step_id: uuid.UUID
    fdi_number: int
    pos_x: float
    pos_y: float
    pos_z: float
    rot_x: float
    rot_y: float
    rot_z: float

    model_config = {"from_attributes": True}


class ToothTransformBatchUpdate(BaseModel):
    """Batch update transforms for a single step."""

    transforms: list[ToothTransformCreate]


# ---------------------------------------------------------------------------
# Treatment Step
# ---------------------------------------------------------------------------

class TreatmentStepCreate(BaseModel):
    """Create a new treatment step with optional transforms."""

    step_number: int = Field(..., ge=0, description="Step index (0 = initial)")
    label: str | None = None
    notes: str | None = None
    transforms: list[ToothTransformCreate] = Field(default_factory=list)


class TreatmentStepResponse(BaseModel):
    """Treatment step returned from API."""

    id: uuid.UUID
    plan_id: uuid.UUID
    step_number: int
    label: str | None = None
    notes: str | None = None
    created_at: datetime
    transforms: list[ToothTransformResponse] = Field(default_factory=list)

    model_config = {"from_attributes": True}


# ---------------------------------------------------------------------------
# Treatment Plan
# ---------------------------------------------------------------------------

class TreatmentPlanCreate(BaseModel):
    """Create a new treatment plan for a case."""

    case_id: uuid.UUID
    name: str = Field(..., max_length=200)
    description: str | None = None
    extraction_id: str | None = None


class TreatmentPlanUpdate(BaseModel):
    """Update treatment plan metadata."""

    name: str | None = Field(None, max_length=200)
    description: str | None = None
    extraction_id: str | None = None
    status: str | None = None


class TreatmentPlanResponse(BaseModel):
    """Treatment plan returned from API (with nested steps)."""

    id: uuid.UUID
    case_id: uuid.UUID
    created_by_id: uuid.UUID
    name: str
    description: str | None = None
    extraction_id: str | None = None
    total_steps: int
    status: str
    created_at: datetime
    updated_at: datetime
    steps: list[TreatmentStepResponse] = Field(default_factory=list)

    model_config = {"from_attributes": True}


class TreatmentPlanListResponse(BaseModel):
    """Treatment plan summary (without steps) for list views."""

    id: uuid.UUID
    case_id: uuid.UUID
    created_by_id: uuid.UUID
    name: str
    description: str | None = None
    total_steps: int
    status: str
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


# ---------------------------------------------------------------------------
# Auto-Staging
# ---------------------------------------------------------------------------

class ToothTargetInput(BaseModel):
    """Final target transform for one tooth."""

    fdi_number: int = Field(..., ge=11, le=48)
    pos_x: float = 0.0  # mm
    pos_y: float = 0.0
    pos_z: float = 0.0
    rot_x: float = 0.0  # degrees
    rot_y: float = 0.0
    rot_z: float = 0.0


class AutoStageRequest(BaseModel):
    """Request to auto-compute staging from targets."""

    plan_id: str
    targets: list[ToothTargetInput]
    max_translation_per_stage: float | None = Field(
        None, description="Override max mm/stage (default 0.25)"
    )
    max_rotation_per_stage: float | None = Field(
        None, description="Override max deg/stage (default 2.0)"
    )


class AutoStageResponse(BaseModel):
    """Result of auto-staging."""

    total_stages: int
    warnings: list[str]
    per_tooth_stages: dict[int, int]  # fdi → how many stages that tooth needs
