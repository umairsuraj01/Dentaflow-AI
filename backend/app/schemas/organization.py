# organization.py — Schemas for organization and invite endpoints.

import uuid
from datetime import datetime

from pydantic import BaseModel, EmailStr, Field

from app.constants import UserRole


class OrgCreate(BaseModel):
    """Create a new organization."""
    name: str = Field(..., min_length=2, max_length=255)


class OrgUpdate(BaseModel):
    """Update organization settings."""
    name: str | None = Field(None, min_length=2, max_length=255)
    logo_url: str | None = None


class OrgResponse(BaseModel):
    """Organization returned from API."""
    id: uuid.UUID
    name: str
    slug: str
    owner_id: uuid.UUID
    logo_url: str | None = None
    plan_tier: str
    is_active: bool
    created_at: datetime
    member_count: int | None = None

    model_config = {"from_attributes": True}


class OrgInviteCreate(BaseModel):
    """Send an invite to join the organization."""
    email: EmailStr
    role: UserRole = UserRole.DENTIST


class OrgInviteResponse(BaseModel):
    """Invite returned from API."""
    id: uuid.UUID
    org_id: uuid.UUID
    email: str
    role: str
    status: str
    expires_at: datetime
    created_at: datetime
    org_name: str | None = None

    model_config = {"from_attributes": True}


class AcceptInviteRequest(BaseModel):
    """Accept an invite using a token."""
    token: str


class OrgMemberResponse(BaseModel):
    """Organization member profile."""
    id: uuid.UUID
    email: str
    full_name: str
    role: str
    is_active: bool
    joined_at: datetime | None = None

    model_config = {"from_attributes": True}
