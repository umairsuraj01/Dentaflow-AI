# user_repository.py — Data access layer for User model.

from datetime import datetime, timezone

from sqlalchemy import select, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.user import User
from app.repositories.base_repository import BaseRepository


class UserRepository(BaseRepository[User]):
    """User-specific database operations."""

    def __init__(self, db: AsyncSession) -> None:
        super().__init__(User, db)

    async def get_by_email(self, email: str) -> User | None:
        """Find a user by email address."""
        query = select(User).where(User.email == email.lower())
        result = await self.db.execute(query)
        return result.scalar_one_or_none()

    async def increment_failed_attempts(self, user: User) -> User:
        """Bump the failed login counter by one."""
        user.failed_login_attempts += 1
        return await self.update(user)

    async def reset_failed_attempts(self, user: User) -> User:
        """Clear failed attempts and locked_until."""
        user.failed_login_attempts = 0
        user.locked_until = None
        return await self.update(user)

    async def lock_account(
        self, user: User, until: datetime
    ) -> User:
        """Lock user account until the given datetime."""
        user.locked_until = until
        return await self.update(user)

    async def verify_email(self, user: User) -> User:
        """Mark user email as verified."""
        user.is_verified = True
        return await self.update(user)

    async def update_last_login(self, user: User) -> User:
        """Record the current timestamp as last login."""
        user.last_login_at = datetime.now(timezone.utc)
        return await self.update(user)

    async def update_password(
        self, user: User, password_hash: str
    ) -> User:
        """Set a new password hash."""
        user.password_hash = password_hash
        return await self.update(user)

    async def soft_delete(self, user: User) -> User:
        """Soft-delete a user without removing the record."""
        user.is_deleted = True
        user.is_active = False
        return await self.update(user)
