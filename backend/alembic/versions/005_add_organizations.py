"""Add organizations, org_invites tables and org_id to users.

Revision ID: 005
Revises: 004
Create Date: 2026-03-24
"""
from typing import Sequence, Union
import uuid
import re

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import UUID

revision: str = "005"
down_revision: Union[str, None] = "004"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def _slugify(text: str) -> str:
    """Convert text to URL-safe slug."""
    text = text.lower().strip()
    text = re.sub(r'[^\w\s-]', '', text)
    text = re.sub(r'[\s_]+', '-', text)
    text = re.sub(r'-+', '-', text)
    return text[:80] or 'org'


def upgrade() -> None:
    # 1. Create organizations table
    op.create_table(
        "organizations",
        sa.Column("id", UUID(as_uuid=True), primary_key=True),
        sa.Column("name", sa.String(255), nullable=False),
        sa.Column("slug", sa.String(100), unique=True, index=True, nullable=False),
        sa.Column("owner_id", UUID(as_uuid=True), sa.ForeignKey("users.id"), nullable=False),
        sa.Column("logo_url", sa.String(500), nullable=True),
        sa.Column("plan_tier", sa.String(30), server_default="free", nullable=False),
        sa.Column("is_active", sa.Boolean(), server_default=sa.text("1")),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )

    # 2. Create org_invites table
    op.create_table(
        "org_invites",
        sa.Column("id", UUID(as_uuid=True), primary_key=True),
        sa.Column("org_id", UUID(as_uuid=True), sa.ForeignKey("organizations.id"), nullable=False, index=True),
        sa.Column("email", sa.String(255), nullable=False),
        sa.Column("role", sa.String(50), server_default="DENTIST", nullable=False),
        sa.Column("invited_by_id", UUID(as_uuid=True), sa.ForeignKey("users.id"), nullable=False),
        sa.Column("token", sa.String(255), unique=True, index=True, nullable=False),
        sa.Column("status", sa.String(20), server_default="PENDING", nullable=False),
        sa.Column("expires_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("accepted_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )

    # 3. Add org_id column to users (nullable first)
    op.add_column("users", sa.Column("org_id", UUID(as_uuid=True), nullable=True))

    # 4. Data migration: create an org for each existing user
    conn = op.get_bind()
    users = conn.execute(sa.text("SELECT id, full_name, clinic_name FROM users")).fetchall()

    seen_slugs = set()
    for user_row in users:
        user_id = user_row[0]
        full_name = user_row[1] or "User"
        clinic_name = user_row[2]
        org_name = clinic_name if clinic_name else f"{full_name}'s Practice"
        base_slug = _slugify(org_name)
        slug = base_slug
        counter = 1
        while slug in seen_slugs:
            slug = f"{base_slug}-{counter}"
            counter += 1
        seen_slugs.add(slug)

        org_id = uuid.uuid4().hex
        conn.execute(sa.text(
            "INSERT INTO organizations (id, name, slug, owner_id, plan_tier, is_active) VALUES (:id, :name, :slug, :owner_id, 'free', 1)"
        ), {"id": org_id, "name": org_name, "slug": slug, "owner_id": user_id})
        conn.execute(sa.text(
            "UPDATE users SET org_id = :org_id WHERE id = :user_id"
        ), {"org_id": org_id, "user_id": user_id})

    # 5. Create index on users.org_id
    op.create_index("ix_users_org_id", "users", ["org_id"])


def downgrade() -> None:
    op.drop_index("ix_users_org_id", table_name="users")
    op.drop_column("users", "org_id")
    op.drop_table("org_invites")
    op.drop_table("organizations")
