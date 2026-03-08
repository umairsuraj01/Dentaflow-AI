# _segmentation_sync.py — Async execution helper for the segmentation task.

from __future__ import annotations

import json
import logging
import uuid

from sqlalchemy import select

from app.config import get_settings
from app.constants import AIStagingState
from app.database.connection import async_session_factory
from app.models.case_file import CaseFile
from app.models.segmentation_result import SegmentationResult
from app.repositories.tooth_instruction_repository import ToothInstructionRepository

logger = logging.getLogger(__name__)
settings = get_settings()


async def execute_segmentation(task, case_file_id: str, case_id: str) -> dict:
    """Run segmentation pipeline inside an async DB session."""
    from ai.pipeline.pipeline_manager import run_full_pipeline

    cf_uuid = uuid.UUID(case_file_id)
    case_uuid = uuid.UUID(case_id)

    async with async_session_factory() as db:
        # 1 — DOWNLOADING: get case file info
        task.update_state(
            state=AIStagingState.DOWNLOADING.value,
            meta={"stage": "DOWNLOADING"},
        )
        case_file = await db.get(CaseFile, cf_uuid)
        if not case_file:
            raise ValueError(f"CaseFile {case_file_id} not found")

        # Update case_file processing status
        case_file.ai_processing_status = AIStagingState.DOWNLOADING.value
        case_file.ai_processing_job_id = task.request.id
        await db.flush()

        # 2 — Get restricted teeth from tooth instructions
        ti_repo = ToothInstructionRepository(db)
        restricted_fdi = await ti_repo.get_restricted_teeth(case_uuid)

        # 3 — PREPROCESSING + RUNNING_AI + POSTPROCESSING
        task.update_state(
            state=AIStagingState.PREPROCESSING.value,
            meta={"stage": "PREPROCESSING"},
        )
        case_file.ai_processing_status = AIStagingState.PREPROCESSING.value
        await db.flush()

        # In dev mode, use local file path; in prod, download from S3
        file_path = case_file.s3_key

        # Build instructions dict from restricted teeth
        instructions: dict[int, list[dict]] = {}
        for fdi in restricted_fdi:
            instructions[fdi] = [{"type": "MUST_RESPECT", "severity": "MUST_RESPECT"}]

        output = run_full_pipeline(
            file_path=file_path,
            instructions=instructions,
        )

        # 4 — SAVING: persist results
        task.update_state(
            state=AIStagingState.SAVING.value,
            meta={"stage": "SAVING"},
        )
        case_file.ai_processing_status = AIStagingState.SAVING.value
        await db.flush()

        seg_result = SegmentationResult(
            id=uuid.uuid4(),
            case_file_id=cf_uuid,
            labels_json=json.dumps(output.labels.tolist()),
            confidence_json=json.dumps(output.confidence_scores),
            restricted_teeth_json=json.dumps(output.restricted_fdi),
            overridden_points_count=output.overridden_points_count,
            model_version=output.model_version,
            processing_time_seconds=output.processing_time_seconds,
            total_points=len(output.labels),
            teeth_found_json=json.dumps(output.teeth_found),
        )
        db.add(seg_result)

        # Mark case file as processed
        case_file.is_ai_processed = True
        case_file.ai_processing_status = AIStagingState.SUCCESS.value
        await db.commit()

        task.update_state(
            state=AIStagingState.SUCCESS.value,
            meta={"stage": "SUCCESS", "segmentation_result_id": str(seg_result.id)},
        )

        return {
            "segmentation_result_id": str(seg_result.id),
            "teeth_found": output.teeth_found,
            "total_points": len(output.labels),
            "model_version": output.model_version,
        }


def _update_stage(task, case_file: CaseFile, stage: str) -> None:
    """Update both Celery state and DB status."""
    task.update_state(state=stage, meta={"stage": stage})
    case_file.ai_processing_status = stage
