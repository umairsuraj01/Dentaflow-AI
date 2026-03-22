# auth.py — Request/response schemas for authentication endpoints.

import re
import uuid
from datetime import datetime

from pydantic import BaseModel, EmailStr, field_validator

from app.constants import MIN_PASSWORD_LENGTH, PASSWORD_REGEX, UserRole


class LoginRequest(BaseModel):
    """Login form data."""

    email: EmailStr
    password: str


class RegisterRequest(BaseModel):
    """Registration form data with validation."""

    email: EmailStr
    password: str
    full_name: str
    role: UserRole = UserRole.DENTIST
    clinic_name: str | None = None
    specialization: str | None = None
    experience_years: int | None = None
    country: str | None = None
    timezone: str | None = None

    @field_validator("password")
    @classmethod
    def validate_password(cls, value: str) -> str:
        """Ensure password meets strength requirements."""
        if len(value) < MIN_PASSWORD_LENGTH:
            msg = f"Password must be at least {MIN_PASSWORD_LENGTH} characters"
            raise ValueError(msg)
        if not re.match(PASSWORD_REGEX, value):
            msg = "Password must contain uppercase, number, and special character"
            raise ValueError(msg)
        return value

    @field_validator("full_name")
    @classmethod
    def validate_full_name(cls, value: str) -> str:
        """Ensure name is not empty."""
        if not value.strip():
            raise ValueError("Full name is required")
        return value.strip()


class TokenResponse(BaseModel):
    """JWT token pair returned on login."""

    access_token: str
    token_type: str = "bearer"


class UserResponse(BaseModel):
    """Public user profile data."""

    id: uuid.UUID
    email: str
    full_name: str
    role: UserRole
    is_active: bool
    is_verified: bool
    clinic_name: str | None = None
    specialization: str | None = None
    experience_years: int | None = None
    country: str | None = None
    timezone: str | None = None
    profile_picture_url: str | None = None
    created_at: datetime
    last_login_at: datetime | None = None

    model_config = {"from_attributes": True}


class ForgotPasswordRequest(BaseModel):
    """Request to send a password reset email."""

    email: EmailStr


class ResetPasswordRequest(BaseModel):
    """Reset password using a token."""

    token: str
    new_password: str

    @field_validator("new_password")
    @classmethod
    def validate_password(cls, value: str) -> str:
        """Ensure new password meets strength requirements."""
        if len(value) < MIN_PASSWORD_LENGTH:
            msg = f"Password must be at least {MIN_PASSWORD_LENGTH} characters"
            raise ValueError(msg)
        if not re.match(PASSWORD_REGEX, value):
            msg = "Password must contain uppercase, number, and special character"
            raise ValueError(msg)
        return value


class VerifyEmailRequest(BaseModel):
    """Verify email with token."""

    token: str


class UpdateProfileRequest(BaseModel):
    """Update user profile data."""

    full_name: str | None = None
    clinic_name: str | None = None
    specialization: str | None = None
    experience_years: int | None = None
    country: str | None = None
    timezone: str | None = None

    @field_validator("full_name")
    @classmethod
    def validate_full_name(cls, value: str | None) -> str | None:
        if value is not None and not value.strip():
            raise ValueError("Full name cannot be empty")
        return value.strip() if value else value


class ChangePasswordRequest(BaseModel):
    """Change password (requires current password)."""

    current_password: str
    new_password: str

    @field_validator("new_password")
    @classmethod
    def validate_password(cls, value: str) -> str:
        if len(value) < MIN_PASSWORD_LENGTH:
            msg = f"Password must be at least {MIN_PASSWORD_LENGTH} characters"
            raise ValueError(msg)
        if not re.match(PASSWORD_REGEX, value):
            msg = "Password must contain uppercase, number, and special character"
            raise ValueError(msg)
        return value
