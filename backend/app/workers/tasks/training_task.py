# training_task.py — Celery tasks for model training and fine-tuning.

from __future__ import annotations

import json
import logging

from app.workers.celery_app import celery_app

logger = logging.getLogger(__name__)


@celery_app.task(name="app.workers.tasks.training_task.weekly_fine_tune")
def weekly_fine_tune() -> dict:
    """Weekly fine-tune from accumulated technician corrections."""
    import asyncio

    return asyncio.get_event_loop().run_until_complete(_run_fine_tune())


async def _run_fine_tune() -> dict:
    """Gather unused corrections and fine-tune the model."""
    import numpy as np
    from sqlalchemy import select

    from app.database.connection import async_session_factory
    from app.models.correction import Correction
    from ai.training.fine_tuner import fine_tune_from_corrections

    async with async_session_factory() as db:
        stmt = select(Correction).where(Correction.used_for_training.is_(False))
        result = await db.execute(stmt)
        corrections = list(result.scalars().all())

        if not corrections:
            logger.info("No new corrections for fine-tuning")
            return {"status": "skipped", "reason": "no_corrections"}

        # Build training data from corrections
        training_data = []
        for c in corrections:
            corrected = json.loads(c.corrected_segmentation_json)
            if "point_cloud" in corrected and "labels" in corrected:
                training_data.append({
                    "point_cloud": np.array(corrected["point_cloud"]),
                    "labels": np.array(corrected["labels"]),
                })

        if not training_data:
            logger.info("No usable correction data for fine-tuning")
            return {"status": "skipped", "reason": "no_usable_data"}

        # Run fine-tuning
        checkpoint_path = fine_tune_from_corrections(training_data)

        # Mark corrections as used
        for c in corrections:
            c.used_for_training = True
        await db.commit()

        return {
            "status": "completed",
            "corrections_used": len(training_data),
            "checkpoint": checkpoint_path,
        }
