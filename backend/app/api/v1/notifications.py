# notifications.py — Notification API endpoints.

import json
import uuid

from fastapi import APIRouter, Depends, Query
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession

from app.database.connection import get_db
from app.middleware.auth_middleware import get_current_user
from app.models.user import User
from app.schemas.common import ApiResponse
from app.services.notification_service import NotificationService

router = APIRouter(prefix="/notifications", tags=["Notifications"])


class MarkReadRequest(BaseModel):
    ids: list[str]


def _notif_to_dict(n) -> dict:
    return {
        "id": str(n.id),
        "type": n.type,
        "title": n.title,
        "message": n.message,
        "data": json.loads(n.data_json) if n.data_json else None,
        "is_read": n.is_read,
        "read_at": n.read_at.isoformat() if n.read_at else None,
        "created_at": n.created_at.isoformat() if n.created_at else None,
    }


@router.get("", response_model=ApiResponse[dict])
async def list_notifications(
    page: int = Query(1, ge=1),
    per_page: int = Query(30, ge=1, le=100),
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    service = NotificationService(db)
    items, total = await service.list_for_user(user.id, page, per_page)
    return ApiResponse(
        success=True,
        message=f"{total} notifications",
        data={
            "items": [_notif_to_dict(n) for n in items],
            "total": total,
            "page": page,
            "per_page": per_page,
        },
    )


@router.get("/unread-count", response_model=ApiResponse[dict])
async def unread_count(
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    service = NotificationService(db)
    count = await service.unread_count(user.id)
    return ApiResponse(success=True, message="OK", data={"count": count})


@router.post("/mark-read", response_model=ApiResponse[dict])
async def mark_read(
    data: MarkReadRequest,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    service = NotificationService(db)
    ids = [uuid.UUID(i) for i in data.ids]
    updated = await service.mark_read(user.id, ids)
    return ApiResponse(success=True, message=f"Marked {updated} as read", data={"updated": updated})


@router.post("/mark-all-read", response_model=ApiResponse[dict])
async def mark_all_read(
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    service = NotificationService(db)
    updated = await service.mark_all_read(user.id)
    return ApiResponse(success=True, message=f"Marked {updated} as read", data={"updated": updated})


@router.delete("/{notification_id}", response_model=ApiResponse[dict])
async def delete_notification(
    notification_id: str,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    service = NotificationService(db)
    deleted = await service.delete(user.id, uuid.UUID(notification_id))
    if not deleted:
        return ApiResponse(success=False, message="Not found", data=None)
    return ApiResponse(success=True, message="Deleted", data=None)
