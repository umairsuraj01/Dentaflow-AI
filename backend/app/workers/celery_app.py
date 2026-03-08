# celery_app.py — Celery application configuration.

from celery import Celery

from app.config import get_settings

settings = get_settings()

celery_app = Celery(
    "dentaflow",
    broker=settings.celery_broker_url,
    backend=settings.celery_result_backend,
)

celery_app.conf.update(
    task_serializer="json",
    accept_content=["json"],
    result_serializer="json",
    timezone="UTC",
    enable_utc=True,
    task_track_started=True,
    task_acks_late=True,
    worker_prefetch_multiplier=1,
    task_routes={
        "app.workers.tasks.segmentation_task.*": {"queue": "ai"},
        "app.workers.tasks.training_task.*": {"queue": "training"},
    },
    beat_schedule={
        "weekly-fine-tune": {
            "task": "app.workers.tasks.training_task.weekly_fine_tune",
            "schedule": 604800.0,  # 7 days in seconds
        },
    },
)

celery_app.autodiscover_tasks(["app.workers.tasks"])
