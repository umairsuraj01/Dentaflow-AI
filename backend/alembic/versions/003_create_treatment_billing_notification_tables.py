"""Create treatment, billing, and notification tables.

Revision ID: 003
Revises: 002
Create Date: 2026-03-22
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import UUID

revision: str = "003"
down_revision: Union[str, None] = "002"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "treatment_plans",
        sa.Column("id", UUID(as_uuid=True), primary_key=True),
        sa.Column("case_id", UUID(as_uuid=True), sa.ForeignKey("cases.id"), nullable=False, index=True),
        sa.Column("created_by_id", UUID(as_uuid=True), sa.ForeignKey("users.id"), nullable=False, index=True),
        sa.Column("name", sa.String(200), nullable=False),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("extraction_id", sa.String(100), nullable=True),
        sa.Column("total_steps", sa.Integer(), server_default="0"),
        sa.Column("status", sa.String(20), server_default="DRAFT"),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )

    op.create_table(
        "treatment_steps",
        sa.Column("id", UUID(as_uuid=True), primary_key=True),
        sa.Column("plan_id", UUID(as_uuid=True), sa.ForeignKey("treatment_plans.id"), nullable=False, index=True),
        sa.Column("step_number", sa.Integer(), nullable=False),
        sa.Column("label", sa.String(100), nullable=True),
        sa.Column("notes", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )

    op.create_table(
        "tooth_transforms",
        sa.Column("id", UUID(as_uuid=True), primary_key=True),
        sa.Column("step_id", UUID(as_uuid=True), sa.ForeignKey("treatment_steps.id"), nullable=False, index=True),
        sa.Column("fdi_number", sa.Integer(), nullable=False),
        sa.Column("pos_x", sa.Float(), server_default="0.0"),
        sa.Column("pos_y", sa.Float(), server_default="0.0"),
        sa.Column("pos_z", sa.Float(), server_default="0.0"),
        sa.Column("rot_x", sa.Float(), server_default="0.0"),
        sa.Column("rot_y", sa.Float(), server_default="0.0"),
        sa.Column("rot_z", sa.Float(), server_default="0.0"),
    )

    op.create_table(
        "pricing_plans",
        sa.Column("id", UUID(as_uuid=True), primary_key=True),
        sa.Column("name", sa.String(100), nullable=False, unique=True),
        sa.Column("slug", sa.String(50), nullable=False, unique=True),
        sa.Column("price_per_case_usd", sa.Float(), nullable=True),
        sa.Column("monthly_fee_usd", sa.Float(), server_default="0"),
        sa.Column("included_cases_per_month", sa.Integer(), server_default="0"),
        sa.Column("overage_per_case_usd", sa.Float(), server_default="0"),
        sa.Column("features_json", sa.Text(), nullable=True),
        sa.Column("turnaround_days", sa.Integer(), server_default="3"),
        sa.Column("is_active", sa.Boolean(), server_default="true"),
        sa.Column("stripe_price_id", sa.String(255), nullable=True),
        sa.Column("sort_order", sa.Integer(), server_default="0"),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )

    op.create_table(
        "invoices",
        sa.Column("id", UUID(as_uuid=True), primary_key=True),
        sa.Column("invoice_number", sa.String(20), nullable=False, unique=True),
        sa.Column("dentist_id", UUID(as_uuid=True), sa.ForeignKey("users.id"), nullable=False, index=True),
        sa.Column("case_id", UUID(as_uuid=True), sa.ForeignKey("cases.id"), nullable=True),
        sa.Column("stripe_invoice_id", sa.String(255), nullable=True),
        sa.Column("stripe_payment_intent_id", sa.String(255), nullable=True),
        sa.Column("status", sa.String(20), nullable=False, server_default="DRAFT"),
        sa.Column("amount_usd", sa.Float(), nullable=False),
        sa.Column("tax_amount_usd", sa.Float(), server_default="0"),
        sa.Column("total_amount_usd", sa.Float(), nullable=False),
        sa.Column("currency", sa.String(3), server_default="'USD'"),
        sa.Column("due_date", sa.DateTime(timezone=True), nullable=True),
        sa.Column("paid_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("line_items_json", sa.Text(), nullable=True),
        sa.Column("notes", sa.Text(), nullable=True),
        sa.Column("pdf_url", sa.String(500), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )

    op.create_table(
        "subscriptions",
        sa.Column("id", UUID(as_uuid=True), primary_key=True),
        sa.Column("dentist_id", UUID(as_uuid=True), sa.ForeignKey("users.id"), nullable=False, index=True),
        sa.Column("plan_id", UUID(as_uuid=True), sa.ForeignKey("pricing_plans.id"), nullable=False),
        sa.Column("stripe_subscription_id", sa.String(255), nullable=True, unique=True),
        sa.Column("stripe_customer_id", sa.String(255), nullable=True),
        sa.Column("status", sa.String(20), nullable=False, server_default="ACTIVE"),
        sa.Column("current_period_start", sa.DateTime(timezone=True), nullable=True),
        sa.Column("current_period_end", sa.DateTime(timezone=True), nullable=True),
        sa.Column("cases_used_this_period", sa.Integer(), server_default="0"),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("cancelled_at", sa.DateTime(timezone=True), nullable=True),
    )

    op.create_table(
        "payments",
        sa.Column("id", UUID(as_uuid=True), primary_key=True),
        sa.Column("invoice_id", UUID(as_uuid=True), sa.ForeignKey("invoices.id"), nullable=False, index=True),
        sa.Column("dentist_id", UUID(as_uuid=True), sa.ForeignKey("users.id"), nullable=False, index=True),
        sa.Column("stripe_charge_id", sa.String(255), nullable=True),
        sa.Column("stripe_payment_method_id", sa.String(255), nullable=True),
        sa.Column("amount_usd", sa.Float(), nullable=False),
        sa.Column("currency", sa.String(3), server_default="'USD'"),
        sa.Column("status", sa.String(20), nullable=False, server_default="PENDING"),
        sa.Column("payment_method_type", sa.String(50), nullable=True),
        sa.Column("last4", sa.String(4), nullable=True),
        sa.Column("card_brand", sa.String(20), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )

    op.create_table(
        "notifications",
        sa.Column("id", UUID(as_uuid=True), primary_key=True),
        sa.Column("user_id", UUID(as_uuid=True), sa.ForeignKey("users.id"), nullable=False, index=True),
        sa.Column("type", sa.String(50), nullable=False),
        sa.Column("title", sa.String(255), nullable=False),
        sa.Column("message", sa.Text(), nullable=False),
        sa.Column("data_json", sa.Text(), nullable=True),
        sa.Column("is_read", sa.Boolean(), server_default="false"),
        sa.Column("is_email_sent", sa.Boolean(), server_default="false"),
        sa.Column("read_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )


def downgrade() -> None:
    op.drop_table("notifications")
    op.drop_table("payments")
    op.drop_table("subscriptions")
    op.drop_table("invoices")
    op.drop_table("pricing_plans")
    op.drop_table("tooth_transforms")
    op.drop_table("treatment_steps")
    op.drop_table("treatment_plans")
