# organizations.py — Organization management API endpoints.

import uuid

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession

from app.database.connection import get_db
from app.middleware.auth_middleware import get_current_user
from app.models.user import User
from app.schemas.organization import (
    AcceptInviteRequest,
    OrgCreate,
    OrgInviteCreate,
    OrgInviteResponse,
    OrgMemberResponse,
    OrgResponse,
    OrgUpdate,
)
from app.services.organization_service import OrganizationService

router = APIRouter(prefix="/orgs", tags=["Organizations"])


def _svc(db: AsyncSession) -> OrganizationService:
    return OrganizationService(db)


# ---------------------------------------------------------------------------
# Organization CRUD
# ---------------------------------------------------------------------------

@router.post("", response_model=dict, status_code=201)
async def create_org(
    data: OrgCreate,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """Create a new organization (for users without one)."""
    svc = _svc(db)
    if user.org_id:
        raise HTTPException(status_code=400, detail="You already belong to an organization")
    org = await svc.create_org(data.name, user)
    return {"success": True, "data": OrgResponse.model_validate(org).model_dump()}


@router.get("/me", response_model=dict)
async def get_my_org(
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """Get the current user's organization."""
    svc = _svc(db)
    org = await svc.get_user_org(user)
    if not org:
        return {"success": True, "data": None}
    resp = OrgResponse.model_validate(org)
    resp.member_count = await svc.get_member_count(org.id)
    return {"success": True, "data": resp.model_dump()}


@router.put("/me", response_model=dict)
async def update_my_org(
    data: OrgUpdate,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """Update organization settings (owner/admin only)."""
    if not user.org_id:
        raise HTTPException(status_code=400, detail="No organization")
    svc = _svc(db)
    try:
        org = await svc.update_org(user.org_id, data, user)
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))
    return {"success": True, "data": OrgResponse.model_validate(org).model_dump()}


# ---------------------------------------------------------------------------
# Members
# ---------------------------------------------------------------------------

@router.get("/me/members", response_model=dict)
async def list_members(
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """List all members of the current organization."""
    if not user.org_id:
        raise HTTPException(status_code=400, detail="No organization")
    svc = _svc(db)
    members = await svc.list_members(user.org_id, user)
    return {
        "success": True,
        "data": [OrgMemberResponse(
            id=m.id, email=m.email, full_name=m.full_name,
            role=m.role, is_active=m.is_active, joined_at=m.created_at,
        ).model_dump() for m in members],
    }


@router.delete("/me/members/{user_id}", response_model=dict)
async def remove_member(
    user_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """Remove a member from the organization."""
    if not user.org_id:
        raise HTTPException(status_code=400, detail="No organization")
    svc = _svc(db)
    try:
        await svc.remove_member(user.org_id, user_id, user)
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))
    return {"success": True, "message": "Member removed"}


# ---------------------------------------------------------------------------
# Invites
# ---------------------------------------------------------------------------

@router.post("/me/invites", response_model=dict, status_code=201)
async def send_invite(
    data: OrgInviteCreate,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """Send an invite to join the organization."""
    if not user.org_id:
        raise HTTPException(status_code=400, detail="No organization")
    svc = _svc(db)
    try:
        invite = await svc.invite_member(user.org_id, data, user)
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))
    resp = OrgInviteResponse.model_validate(invite)
    resp.org_name = (await svc.get_org(invite.org_id)).name
    return {"success": True, "data": resp.model_dump()}


@router.get("/me/invites", response_model=dict)
async def list_invites(
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """List all invites for the current organization."""
    if not user.org_id:
        raise HTTPException(status_code=400, detail="No organization")
    svc = _svc(db)
    invites = await svc.list_invites(user.org_id, user)
    return {
        "success": True,
        "data": [OrgInviteResponse.model_validate(inv).model_dump() for inv in invites],
    }


@router.delete("/me/invites/{invite_id}", response_model=dict)
async def revoke_invite(
    invite_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """Revoke a pending invite."""
    if not user.org_id:
        raise HTTPException(status_code=400, detail="No organization")
    svc = _svc(db)
    try:
        await svc.revoke_invite(user.org_id, invite_id, user)
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))
    return {"success": True, "message": "Invite revoked"}


# ---------------------------------------------------------------------------
# Join via invite
# ---------------------------------------------------------------------------

@router.post("/join", response_model=dict)
async def join_org(
    data: AcceptInviteRequest,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """Accept an invite and join an organization."""
    svc = _svc(db)
    try:
        org = await svc.accept_invite(data.token, user)
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))
    return {"success": True, "data": OrgResponse.model_validate(org).model_dump()}
