# base_repository.py — Generic CRUD base for all repositories.

import uuid
from typing import Generic, TypeVar

from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession

from app.database.base import Base

ModelType = TypeVar("ModelType", bound=Base)


class BaseRepository(Generic[ModelType]):
    """Generic async CRUD operations for any ORM model."""

    def __init__(self, model: type[ModelType], db: AsyncSession) -> None:
        self.model = model
        self.db = db

    async def get_by_id(self, record_id: uuid.UUID) -> ModelType | None:
        """Fetch a single record by primary key."""
        return await self.db.get(self.model, record_id)

    async def get_all(
        self, skip: int = 0, limit: int = 50
    ) -> list[ModelType]:
        """Fetch paginated records."""
        query = select(self.model).offset(skip).limit(limit)
        result = await self.db.execute(query)
        return list(result.scalars().all())

    async def count(self) -> int:
        """Return total record count."""
        query = select(func.count()).select_from(self.model)
        result = await self.db.execute(query)
        return result.scalar_one()

    async def create(self, obj: ModelType) -> ModelType:
        """Insert a new record."""
        self.db.add(obj)
        await self.db.flush()
        await self.db.refresh(obj)
        return obj

    async def update(self, obj: ModelType) -> ModelType:
        """Persist changes to an existing record."""
        await self.db.flush()
        await self.db.refresh(obj)
        return obj

    async def delete(self, obj: ModelType) -> None:
        """Remove a record from the database."""
        await self.db.delete(obj)
        await self.db.flush()
