# manufacturing.py — Request/response schemas for manufacturing order endpoints.

import uuid
from datetime import datetime

from pydantic import BaseModel, Field

from app.constants import (
    ManufacturingCaseType, OrderStatus, OrderType, ReplacementReason,
)


# ---------------------------------------------------------------------------
# Create / Update
# ---------------------------------------------------------------------------

class ManufacturingOrderCreate(BaseModel):
    """Create a manufacturing order (usually auto-created on case approval)."""

    case_id: uuid.UUID
    treatment_plan_id: uuid.UUID | None = None
    order_type: OrderType = OrderType.DEFAULT
    case_type: ManufacturingCaseType = ManufacturingCaseType.INITIAL
    replacement_reason: ReplacementReason | None = None
    trimline: str = "Scalloped"
    aligner_material: str = "Molekur Pro S"
    attachment_template_material: str = "Erkolen 0.6mm"
    cutout_info: str | None = None
    special_instructions: str | None = None
    total_trays: int = Field(0, ge=0)
    upper_aligner_count: int = Field(0, ge=0)
    lower_aligner_count: int = Field(0, ge=0)
    attachment_template_count: int = Field(0, ge=0)
    attachment_start_stage: int | None = None
    target_32c_date: datetime | None = None


class ManufacturingOrderUpdate(BaseModel):
    """Update manufacturing specs on an existing order."""

    trimline: str | None = None
    aligner_material: str | None = None
    attachment_template_material: str | None = None
    cutout_info: str | None = None
    special_instructions: str | None = None
    total_trays: int | None = Field(None, ge=0)
    upper_aligner_count: int | None = Field(None, ge=0)
    lower_aligner_count: int | None = Field(None, ge=0)
    attachment_template_count: int | None = Field(None, ge=0)
    attachment_start_stage: int | None = None
    target_32c_date: datetime | None = None


# ---------------------------------------------------------------------------
# Response
# ---------------------------------------------------------------------------

class ManufacturingOrderResponse(BaseModel):
    """Manufacturing order returned from API."""

    id: uuid.UUID
    case_id: uuid.UUID
    treatment_plan_id: uuid.UUID | None = None
    assigned_to_id: uuid.UUID | None = None
    order_number: str
    status: str
    order_type: str
    case_type: str
    replacement_reason: str | None = None
    trimline: str
    aligner_material: str
    attachment_template_material: str
    cutout_info: str | None = None
    special_instructions: str | None = None
    total_trays: int
    upper_aligner_count: int
    lower_aligner_count: int
    attachment_template_count: int
    attachment_start_stage: int | None = None
    tracking_number: str | None = None
    shipping_carrier: str | None = None
    shipped_at: datetime | None = None
    target_32c_date: datetime | None = None
    assigned_at: datetime | None = None
    created_at: datetime
    updated_at: datetime
    # Computed from relationships
    patient_name: str | None = None
    case_number: str | None = None
    assigned_to_name: str | None = None

    model_config = {"from_attributes": True}


# ---------------------------------------------------------------------------
# Actions
# ---------------------------------------------------------------------------

class ShipOrderRequest(BaseModel):
    """Mark an order as shipped with tracking info."""

    tracking_number: str = Field(..., min_length=1, max_length=100)
    shipping_carrier: str = Field("FedEx", min_length=1, max_length=50)


class BulkStatusUpdate(BaseModel):
    """Bulk update order statuses."""

    order_ids: list[uuid.UUID]
    target_status: OrderStatus


class ManufacturingStatsResponse(BaseModel):
    """Order counts per status for tab badges."""

    new: int = 0
    in_progress: int = 0
    shipped: int = 0
