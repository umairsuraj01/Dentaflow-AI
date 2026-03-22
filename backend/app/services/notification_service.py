# notification_service.py — Create, list, and manage in-app notifications.

import json
import logging
import uuid
from datetime import datetime, timezone

from sqlalchemy import select, func, update, desc
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.notification import Notification

logger = logging.getLogger(__name__)


class NotificationService:
    """Handles in-app notification operations."""

    def __init__(self, db: AsyncSession):
        self.db = db

    async def create(
        self,
        user_id: uuid.UUID,
        notification_type: str,
        title: str,
        message: str,
        data: dict | None = None,
    ) -> Notification:
        notif = Notification(
            user_id=user_id,
            type=notification_type,
            title=title,
            message=message,
            data_json=json.dumps(data) if data else None,
        )
        self.db.add(notif)
        await self.db.flush()
        logger.info(f"Notification created: {notification_type} for user {user_id}")
        return notif

    async def list_for_user(
        self, user_id: uuid.UUID, page: int = 1, per_page: int = 30,
    ) -> tuple[list[Notification], int]:
        base = select(Notification).where(Notification.user_id == user_id)
        count_q = select(func.count()).select_from(base.subquery())
        total = (await self.db.execute(count_q)).scalar() or 0

        q = (
            base
            .order_by(Notification.is_read.asc(), desc(Notification.created_at))
            .offset((page - 1) * per_page)
            .limit(per_page)
        )
        result = await self.db.execute(q)
        return list(result.scalars().all()), total

    async def unread_count(self, user_id: uuid.UUID) -> int:
        result = await self.db.execute(
            select(func.count()).where(
                Notification.user_id == user_id,
                Notification.is_read == False,
            )
        )
        return result.scalar() or 0

    async def mark_read(self, user_id: uuid.UUID, notification_ids: list[uuid.UUID]) -> int:
        now = datetime.now(timezone.utc)
        result = await self.db.execute(
            update(Notification)
            .where(
                Notification.user_id == user_id,
                Notification.id.in_(notification_ids),
                Notification.is_read == False,
            )
            .values(is_read=True, read_at=now)
        )
        await self.db.flush()
        return result.rowcount

    async def mark_all_read(self, user_id: uuid.UUID) -> int:
        now = datetime.now(timezone.utc)
        result = await self.db.execute(
            update(Notification)
            .where(
                Notification.user_id == user_id,
                Notification.is_read == False,
            )
            .values(is_read=True, read_at=now)
        )
        await self.db.flush()
        return result.rowcount

    async def delete(self, user_id: uuid.UUID, notification_id: uuid.UUID) -> bool:
        result = await self.db.execute(
            select(Notification).where(
                Notification.id == notification_id,
                Notification.user_id == user_id,
            )
        )
        notif = result.scalar_one_or_none()
        if not notif:
            return False
        await self.db.delete(notif)
        await self.db.flush()
        return True
