# auth_service.py — Business logic for authentication and authorization.
# All auth operations go through this service — never in route handlers.

import uuid
from datetime import datetime, timedelta, timezone

import bcrypt
import jwt
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import get_settings
from app.constants import (
    ACCESS_TOKEN_EXPIRE_MINUTES,
    APP_NAME,
    BCRYPT_ROUNDS,
    LOCKOUT_MINUTES,
    MAX_LOGIN_ATTEMPTS,
    REFRESH_TOKEN_EXPIRE_DAYS,
)
from app.exceptions import (
    AuthenticationError,
    ConflictError,
    NotFoundError,
    RateLimitError,
    ValidationError,
)
from app.models.user import User
from app.repositories.user_repository import UserRepository
from app.schemas.auth import RegisterRequest

settings = get_settings()


class AuthService:
    """Handles registration, login, token management, and password flows."""

    def __init__(self, db: AsyncSession) -> None:
        self.repo = UserRepository(db)

    async def register(self, data: RegisterRequest) -> User:
        """Create a new user account."""
        existing = await self.repo.get_by_email(data.email)
        if existing:
            raise ConflictError("Email already registered")
        password_hash = self._hash_password(data.password)
        user = User(
            email=data.email.lower(),
            password_hash=password_hash,
            full_name=data.full_name,
            role=data.role.value,
            clinic_name=data.clinic_name,
            specialization=data.specialization,
            experience_years=data.experience_years,
            country=data.country,
            timezone=data.timezone,
        )
        return await self.repo.create(user)

    async def login(
        self, email: str, password: str
    ) -> tuple[User, str, str]:
        """Authenticate and return user with access and refresh tokens."""
        user = await self.repo.get_by_email(email)
        if not user:
            raise AuthenticationError("Invalid email or password")
        self._check_account_locked(user)
        if not self._verify_password(password, user.password_hash):
            await self._handle_failed_login(user)
            raise AuthenticationError("Invalid email or password")
        if not user.is_verified:
            raise AuthenticationError("Please verify your email first")
        if not user.is_active or user.is_deleted:
            raise AuthenticationError("Account is deactivated")
        await self.repo.reset_failed_attempts(user)
        await self.repo.update_last_login(user)
        access_token = self._create_access_token(user)
        refresh_token = self._create_refresh_token(user)
        return user, access_token, refresh_token

    async def refresh_tokens(
        self, refresh_token: str
    ) -> tuple[str, str]:
        """Validate refresh token and issue new token pair."""
        payload = self._decode_token(refresh_token, "refresh")
        user = await self.repo.get_by_id(uuid.UUID(payload["sub"]))
        if not user or not user.is_active:
            raise AuthenticationError("Invalid refresh token")
        new_access = self._create_access_token(user)
        new_refresh = self._create_refresh_token(user)
        return new_access, new_refresh

    async def get_current_user(self, token: str) -> User:
        """Decode access token and return the user."""
        payload = self._decode_token(token, "access")
        user = await self.repo.get_by_id(uuid.UUID(payload["sub"]))
        if not user or not user.is_active:
            raise AuthenticationError("User not found or inactive")
        return user

    async def request_password_reset(self, email: str) -> str:
        """Generate a password reset token."""
        user = await self.repo.get_by_email(email)
        if not user:
            raise NotFoundError("User")
        return self._create_reset_token(user)

    async def reset_password(
        self, token: str, new_password: str
    ) -> None:
        """Validate reset token and set new password."""
        payload = self._decode_token(token, "reset")
        user = await self.repo.get_by_id(uuid.UUID(payload["sub"]))
        if not user:
            raise NotFoundError("User")
        password_hash = self._hash_password(new_password)
        await self.repo.update_password(user, password_hash)

    async def verify_email(self, token: str) -> User:
        """Mark user as verified using email token."""
        payload = self._decode_token(token, "verify")
        user = await self.repo.get_by_id(uuid.UUID(payload["sub"]))
        if not user:
            raise NotFoundError("User")
        return await self.repo.verify_email(user)

    def create_verification_token(self, user: User) -> str:
        """Generate an email verification token."""
        return self._create_token(
            {"sub": str(user.id), "type": "verify"},
            timedelta(hours=24),
        )

    # -- Private helpers ---------------------------------------------------

    def _hash_password(self, password: str) -> str:
        """Hash password with bcrypt."""
        salt = bcrypt.gensalt(rounds=BCRYPT_ROUNDS)
        return bcrypt.hashpw(
            password.encode("utf-8"), salt
        ).decode("utf-8")

    def _verify_password(
        self, password: str, password_hash: str
    ) -> bool:
        """Check password against stored hash."""
        return bcrypt.checkpw(
            password.encode("utf-8"),
            password_hash.encode("utf-8"),
        )

    def _check_account_locked(self, user: User) -> None:
        """Raise if account is currently locked."""
        if user.locked_until and user.locked_until > datetime.now(
            timezone.utc
        ):
            raise RateLimitError("Account locked. Try again later.")

    async def _handle_failed_login(self, user: User) -> None:
        """Increment failures and lock if threshold reached."""
        await self.repo.increment_failed_attempts(user)
        if user.failed_login_attempts + 1 >= MAX_LOGIN_ATTEMPTS:
            lock_until = datetime.now(timezone.utc) + timedelta(
                minutes=LOCKOUT_MINUTES
            )
            await self.repo.lock_account(user, lock_until)

    def _create_access_token(self, user: User) -> str:
        """Issue a short-lived access JWT."""
        return self._create_token(
            {
                "sub": str(user.id),
                "role": user.role,
                "type": "access",
            },
            timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES),
        )

    def _create_refresh_token(self, user: User) -> str:
        """Issue a long-lived refresh JWT."""
        return self._create_token(
            {"sub": str(user.id), "type": "refresh"},
            timedelta(days=REFRESH_TOKEN_EXPIRE_DAYS),
        )

    def _create_reset_token(self, user: User) -> str:
        """Issue a password reset JWT."""
        return self._create_token(
            {"sub": str(user.id), "type": "reset"},
            timedelta(hours=1),
        )

    def _create_token(
        self, payload: dict[str, str], expires_delta: timedelta
    ) -> str:
        """Create a signed JWT with expiry."""
        expire = datetime.now(timezone.utc) + expires_delta
        payload["exp"] = expire
        payload["iat"] = datetime.now(timezone.utc)
        payload["iss"] = APP_NAME
        return jwt.encode(
            payload,
            settings.jwt_secret_key,
            algorithm=settings.jwt_algorithm,
        )

    def _decode_token(
        self, token: str, expected_type: str
    ) -> dict[str, str]:
        """Decode and validate a JWT."""
        try:
            payload = jwt.decode(
                token,
                settings.jwt_secret_key,
                algorithms=[settings.jwt_algorithm],
                issuer=APP_NAME,
            )
        except jwt.ExpiredSignatureError:
            raise AuthenticationError("Token has expired")
        except jwt.InvalidTokenError:
            raise AuthenticationError("Invalid token")
        if payload.get("type") != expected_type:
            raise AuthenticationError("Invalid token type")
        return payload
