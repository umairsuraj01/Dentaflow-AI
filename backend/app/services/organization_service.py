# organization_service.py — Business logic for organizations and invites.

import re
import secrets
import uuid
from datetime import datetime, timedelta, timezone

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.constants import InviteStatus, OrgPlanTier, UserRole
from app.exceptions import AuthorizationError, ConflictError, NotFoundError, ValidationError
from app.models.organization import Organization
from app.models.org_invite import OrgInvite
from app.models.user import User
from app.schemas.organization import OrgCreate, OrgInviteCreate, OrgUpdate


def _slugify(text: str) -> str:
    """Convert text to URL-safe slug."""
    text = text.lower().strip()
    text = re.sub(r'[^\w\s-]', '', text)
    text = re.sub(r'[\s_]+', '-', text)
    text = re.sub(r'-+', '-', text)
    return text[:80] or 'org'


class OrganizationService:
    def __init__(self, db: AsyncSession):
        self.db = db

    # -- Organization CRUD ---------------------------------------------------

    async def create_org(self, name: str, owner: User) -> Organization:
        """Create an organization and assign the owner to it."""
        base_slug = _slugify(name)
        slug = base_slug

        # Ensure unique slug
        counter = 1
        while True:
            existing = await self.db.execute(
                select(Organization).where(Organization.slug == slug)
            )
            if not existing.scalar_one_or_none():
                break
            slug = f"{base_slug}-{counter}"
            counter += 1

        org = Organization(
            id=uuid.uuid4(),
            name=name,
            slug=slug,
            owner_id=owner.id,
            plan_tier=OrgPlanTier.FREE.value,
        )
        self.db.add(org)

        # Assign user to this org
        owner.org_id = org.id
        await self.db.commit()
        await self.db.refresh(org)
        return org

    async def get_org(self, org_id: uuid.UUID) -> Organization:
        result = await self.db.execute(
            select(Organization).where(Organization.id == org_id)
        )
        org = result.scalar_one_or_none()
        if not org:
            raise NotFoundError("Organization")
        return org

    async def get_user_org(self, user: User) -> Organization | None:
        """Get the organization the user belongs to."""
        if not user.org_id:
            return None
        return await self.get_org(user.org_id)

    async def update_org(
        self, org_id: uuid.UUID, data: OrgUpdate, user: User
    ) -> Organization:
        org = await self.get_org(org_id)
        self._check_org_admin(org, user)
        for key, val in data.model_dump(exclude_unset=True).items():
            setattr(org, key, val)
        if data.name:
            org.slug = _slugify(data.name)
        await self.db.commit()
        await self.db.refresh(org)
        return org

    # -- Members -------------------------------------------------------------

    async def list_members(self, org_id: uuid.UUID, user: User) -> list[User]:
        """List all users in the organization."""
        self._check_same_org(org_id, user)
        result = await self.db.execute(
            select(User)
            .where(User.org_id == org_id, User.is_deleted == False)
            .order_by(User.created_at.desc())
        )
        return list(result.scalars().all())

    async def remove_member(
        self, org_id: uuid.UUID, user_id: uuid.UUID, requester: User
    ) -> None:
        """Remove a user from the organization."""
        org = await self.get_org(org_id)
        self._check_org_admin(org, requester)

        if user_id == org.owner_id:
            raise ValidationError("Cannot remove the organization owner")

        result = await self.db.execute(
            select(User).where(User.id == user_id, User.org_id == org_id)
        )
        member = result.scalar_one_or_none()
        if not member:
            raise NotFoundError("Member")

        member.org_id = None
        await self.db.commit()

    async def get_member_count(self, org_id: uuid.UUID) -> int:
        result = await self.db.execute(
            select(func.count()).select_from(User)
            .where(User.org_id == org_id, User.is_deleted == False)
        )
        return result.scalar_one()

    # -- Invites -------------------------------------------------------------

    async def invite_member(
        self, org_id: uuid.UUID, data: OrgInviteCreate, inviter: User
    ) -> OrgInvite:
        """Send an invite to join the organization."""
        org = await self.get_org(org_id)
        self._check_org_admin(org, inviter)

        # Check if email already in org
        existing = await self.db.execute(
            select(User).where(
                User.email == data.email.lower(),
                User.org_id == org_id,
                User.is_deleted == False,
            )
        )
        if existing.scalar_one_or_none():
            raise ConflictError("User is already a member of this organization")

        # Check for pending invite
        existing_invite = await self.db.execute(
            select(OrgInvite).where(
                OrgInvite.org_id == org_id,
                OrgInvite.email == data.email.lower(),
                OrgInvite.status == InviteStatus.PENDING.value,
            )
        )
        if existing_invite.scalar_one_or_none():
            raise ConflictError("An invite is already pending for this email")

        invite = OrgInvite(
            id=uuid.uuid4(),
            org_id=org_id,
            email=data.email.lower(),
            role=data.role.value,
            invited_by_id=inviter.id,
            token=secrets.token_urlsafe(32),
            status=InviteStatus.PENDING.value,
            expires_at=datetime.now(timezone.utc) + timedelta(days=7),
        )
        self.db.add(invite)
        await self.db.commit()
        await self.db.refresh(invite)
        return invite

    async def list_invites(self, org_id: uuid.UUID, user: User) -> list[OrgInvite]:
        """List all invites for the organization."""
        self._check_same_org(org_id, user)
        result = await self.db.execute(
            select(OrgInvite)
            .where(OrgInvite.org_id == org_id)
            .order_by(OrgInvite.created_at.desc())
        )
        return list(result.scalars().all())

    async def accept_invite(self, token: str, user: User) -> Organization:
        """Accept an invite and join the organization."""
        result = await self.db.execute(
            select(OrgInvite).where(OrgInvite.token == token)
        )
        invite = result.scalar_one_or_none()
        if not invite:
            raise NotFoundError("Invite")

        if invite.status != InviteStatus.PENDING.value:
            raise ValidationError(f"Invite is {invite.status.lower()}")

        if invite.expires_at < datetime.now(timezone.utc):
            invite.status = InviteStatus.EXPIRED.value
            await self.db.commit()
            raise ValidationError("Invite has expired")

        # Assign user to org
        user.org_id = invite.org_id
        user.role = invite.role  # Set the role specified in the invite
        invite.status = InviteStatus.ACCEPTED.value
        invite.accepted_at = datetime.now(timezone.utc)
        await self.db.commit()

        return await self.get_org(invite.org_id)

    async def revoke_invite(
        self, org_id: uuid.UUID, invite_id: uuid.UUID, user: User
    ) -> None:
        """Revoke a pending invite."""
        org = await self.get_org(org_id)
        self._check_org_admin(org, user)

        result = await self.db.execute(
            select(OrgInvite).where(
                OrgInvite.id == invite_id,
                OrgInvite.org_id == org_id,
            )
        )
        invite = result.scalar_one_or_none()
        if not invite:
            raise NotFoundError("Invite")

        invite.status = InviteStatus.REVOKED.value
        await self.db.commit()

    # -- Permission checks ---------------------------------------------------

    def _check_org_admin(self, org: Organization, user: User) -> None:
        """Check that user is the org owner, or SUPER_ADMIN."""
        if user.role == UserRole.SUPER_ADMIN.value:
            return
        if user.id == org.owner_id:
            return
        if user.role == UserRole.LAB_MANAGER.value and user.org_id == org.id:
            return
        raise AuthorizationError("Only the organization owner or admin can perform this action")

    def _check_same_org(self, org_id: uuid.UUID, user: User) -> None:
        """Check that user belongs to the organization."""
        if user.role == UserRole.SUPER_ADMIN.value:
            return
        if user.org_id != org_id:
            raise AuthorizationError("You do not belong to this organization")
