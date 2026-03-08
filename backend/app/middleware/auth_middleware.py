# auth_middleware.py — FastAPI dependencies for JWT auth and role checks.

from fastapi import Depends, Request
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy.ext.asyncio import AsyncSession

from app.constants import UserRole
from app.database.connection import get_db
from app.exceptions import AuthenticationError, AuthorizationError
from app.models.user import User
from app.services.auth_service import AuthService

bearer_scheme = HTTPBearer(auto_error=False)


async def get_current_user(
    request: Request,
    credentials: HTTPAuthorizationCredentials | None = Depends(bearer_scheme),
    db: AsyncSession = Depends(get_db),
) -> User:
    """Extract and validate JWT from Authorization header."""
    if not credentials:
        raise AuthenticationError("Missing authentication token")
    service = AuthService(db)
    return await service.get_current_user(credentials.credentials)


def require_roles(*roles: UserRole):
    """Return a dependency that checks the user has one of the given roles."""

    async def role_checker(
        current_user: User = Depends(get_current_user),
    ) -> User:
        """Verify user role against allowed roles."""
        if current_user.role not in [r.value for r in roles]:
            raise AuthorizationError(
                "You do not have permission to access this resource"
            )
        return current_user

    return role_checker
