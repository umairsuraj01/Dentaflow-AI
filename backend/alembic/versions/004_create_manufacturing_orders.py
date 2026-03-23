"""Create manufacturing_orders table.

Revision ID: 004
Revises: 003
Create Date: 2026-03-24
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import UUID

revision: str = "004"
down_revision: Union[str, None] = "003"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "manufacturing_orders",
        sa.Column("id", UUID(as_uuid=True), primary_key=True),
        sa.Column("case_id", UUID(as_uuid=True), sa.ForeignKey("cases.id"), nullable=False, index=True),
        sa.Column("treatment_plan_id", UUID(as_uuid=True), sa.ForeignKey("treatment_plans.id"), nullable=True),
        sa.Column("assigned_to_id", UUID(as_uuid=True), sa.ForeignKey("users.id"), nullable=True, index=True),
        sa.Column("order_number", sa.String(20), unique=True, index=True, nullable=False),
        sa.Column("status", sa.String(20), server_default="NEW", nullable=False),
        sa.Column("order_type", sa.String(20), server_default="DEFAULT", nullable=False),
        sa.Column("case_type", sa.String(20), server_default="INITIAL", nullable=False),
        sa.Column("replacement_reason", sa.String(20), nullable=True),
        # Manufacturing specs
        sa.Column("trimline", sa.String(30), server_default="Scalloped", nullable=False),
        sa.Column("aligner_material", sa.String(100), server_default="Molekur Pro S", nullable=False),
        sa.Column("attachment_template_material", sa.String(100), server_default="Erkolen 0.6mm", nullable=False),
        sa.Column("cutout_info", sa.Text(), nullable=True),
        sa.Column("special_instructions", sa.Text(), nullable=True),
        # Tray counts
        sa.Column("total_trays", sa.Integer(), server_default="0"),
        sa.Column("upper_aligner_count", sa.Integer(), server_default="0"),
        sa.Column("lower_aligner_count", sa.Integer(), server_default="0"),
        sa.Column("attachment_template_count", sa.Integer(), server_default="0"),
        sa.Column("attachment_start_stage", sa.Integer(), nullable=True),
        # Shipping
        sa.Column("tracking_number", sa.String(100), nullable=True),
        sa.Column("shipping_carrier", sa.String(50), nullable=True),
        sa.Column("shipped_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("target_32c_date", sa.DateTime(timezone=True), nullable=True),
        # Timestamps
        sa.Column("assigned_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )


def downgrade() -> None:
    op.drop_table("manufacturing_orders")
