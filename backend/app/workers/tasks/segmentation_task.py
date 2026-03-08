# segmentation_task.py — Celery task for AI segmentation pipeline.

from __future__ import annotations

import json
import logging
import uuid

from app.workers.celery_app import celery_app
from app.constants import AIStagingState

logger = logging.getLogger(__name__)


@celery_app.task(bind=True, name="app.workers.tasks.segmentation_task.run_segmentation")
def run_segmentation(self, case_file_id: str, case_id: str) -> dict:
    """Run the full AI segmentation pipeline for a case file.

    States: PENDING → DOWNLOADING → PREPROCESSING → RUNNING_AI →
            POSTPROCESSING → SAVING → SUCCESS | FAILED
    """
    import asyncio
    from app.workers.tasks._segmentation_sync import execute_segmentation

    try:
        self.update_state(state=AIStagingState.PENDING.value, meta={"stage": "PENDING"})
        result = asyncio.get_event_loop().run_until_complete(
            execute_segmentation(self, case_file_id, case_id)
        )
        return result
    except Exception as exc:
        self.update_state(
            state=AIStagingState.FAILED.value,
            meta={"stage": "FAILED", "error": str(exc)},
        )
        logger.exception("Segmentation failed for case_file %s", case_file_id)
        raise
