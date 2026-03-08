# segmentation.py — Request/response schemas for AI segmentation endpoints.

import uuid
from datetime import datetime

from pydantic import BaseModel, Field


class SegmentationResultResponse(BaseModel):
    """AI segmentation result returned from API."""

    id: uuid.UUID
    case_file_id: uuid.UUID
    labels_json: str
    confidence_json: str
    restricted_teeth_json: str
    overridden_points_count: int
    model_version: str
    processing_time_seconds: float
    total_points: int
    teeth_found_json: str
    colored_mesh_s3_key: str | None = None
    created_at: datetime

    model_config = {"from_attributes": True}


class SegmentationJobStatus(BaseModel):
    """Current status of an AI processing job."""

    job_id: str
    case_file_id: uuid.UUID
    state: str
    stage: str | None = None
    error: str | None = None


class CorrectionCreate(BaseModel):
    """Submit a technician correction to AI segmentation."""

    segmentation_result_id: uuid.UUID
    original_segmentation_json: str
    corrected_segmentation_json: str
    correction_type: str
    confidence_score: int = Field(3, ge=1, le=5)
    time_taken_seconds: float = Field(0.0, ge=0)


class CorrectionResponse(BaseModel):
    """Correction data returned from API."""

    id: uuid.UUID
    case_file_id: uuid.UUID
    technician_id: uuid.UUID
    segmentation_result_id: uuid.UUID
    correction_type: str
    confidence_score: int
    time_taken_seconds: float
    used_for_training: bool
    created_at: datetime

    model_config = {"from_attributes": True}


class ReprocessRequest(BaseModel):
    """Request to reprocess a case file with AI."""

    case_file_id: uuid.UUID


class AIStatsResponse(BaseModel):
    """AI pipeline statistics."""

    total_segmentations: int = 0
    total_corrections: int = 0
    corrections_used_for_training: int = 0
    average_processing_time: float = 0.0
    average_confidence_score: float = 0.0
    model_version: str = "mock_v1"
