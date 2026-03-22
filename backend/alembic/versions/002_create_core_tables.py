"""Create core tables: patients, cases, case_files, case_notes, tooth_instructions, segmentation_results, corrections.

Revision ID: 002
Revises: 001
Create Date: 2026-03-22
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import UUID

revision: str = "002"
down_revision: Union[str, None] = "001"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "patients",
        sa.Column("id", UUID(as_uuid=True), primary_key=True),
        sa.Column("dentist_id", UUID(as_uuid=True), sa.ForeignKey("users.id"), nullable=False, index=True),
        sa.Column("first_name", sa.String(255), nullable=False),
        sa.Column("last_name", sa.String(255), nullable=False),
        sa.Column("date_of_birth", sa.Date(), nullable=True),
        sa.Column("gender", sa.String(20), nullable=True),
        sa.Column("patient_reference", sa.String(100), nullable=True, index=True),
        sa.Column("notes", sa.Text(), nullable=True),
        sa.Column("is_deleted", sa.Boolean(), server_default="false"),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )

    op.create_table(
        "cases",
        sa.Column("id", UUID(as_uuid=True), primary_key=True),
        sa.Column("patient_id", UUID(as_uuid=True), sa.ForeignKey("patients.id"), nullable=False, index=True),
        sa.Column("dentist_id", UUID(as_uuid=True), sa.ForeignKey("users.id"), nullable=False, index=True),
        sa.Column("technician_id", UUID(as_uuid=True), sa.ForeignKey("users.id"), nullable=True, index=True),
        sa.Column("case_number", sa.String(20), nullable=False, unique=True, index=True),
        sa.Column("status", sa.String(30), nullable=False, server_default="DRAFT"),
        sa.Column("treatment_type", sa.String(30), nullable=False, server_default="FULL_ARCH"),
        sa.Column("priority", sa.String(20), nullable=False, server_default="NORMAL"),
        sa.Column("arch_type", sa.String(30), nullable=True),
        sa.Column("chief_complaint", sa.Text(), nullable=True),
        sa.Column("treatment_goals", sa.Text(), nullable=True),
        sa.Column("special_instructions", sa.Text(), nullable=True),
        sa.Column("target_turnaround_days", sa.Integer(), server_default="3"),
        sa.Column("price_usd", sa.Float(), nullable=True),
        sa.Column("due_date", sa.DateTime(timezone=True), nullable=True),
        sa.Column("submitted_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("completed_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )

    op.create_table(
        "case_files",
        sa.Column("id", UUID(as_uuid=True), primary_key=True),
        sa.Column("case_id", UUID(as_uuid=True), sa.ForeignKey("cases.id"), nullable=False, index=True),
        sa.Column("file_type", sa.String(30), nullable=False, server_default="OTHER"),
        sa.Column("original_filename", sa.String(500), nullable=False),
        sa.Column("stored_filename", sa.String(500), nullable=False),
        sa.Column("s3_key", sa.String(1000), nullable=False),
        sa.Column("s3_bucket", sa.String(255), nullable=False),
        sa.Column("file_size_bytes", sa.Integer(), server_default="0"),
        sa.Column("mime_type", sa.String(100), nullable=True),
        sa.Column("file_format", sa.String(20), nullable=True),
        sa.Column("upload_status", sa.String(20), nullable=False, server_default="UPLOADING"),
        sa.Column("is_ai_processed", sa.Boolean(), server_default="false"),
        sa.Column("ai_processing_status", sa.String(30), nullable=True),
        sa.Column("ai_processing_job_id", sa.String(100), nullable=True),
        sa.Column("uploaded_by_id", UUID(as_uuid=True), sa.ForeignKey("users.id"), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )

    op.create_table(
        "case_notes",
        sa.Column("id", UUID(as_uuid=True), primary_key=True),
        sa.Column("case_id", UUID(as_uuid=True), sa.ForeignKey("cases.id"), nullable=False, index=True),
        sa.Column("author_id", UUID(as_uuid=True), sa.ForeignKey("users.id"), nullable=False),
        sa.Column("note_text", sa.Text(), nullable=False),
        sa.Column("note_type", sa.String(30), nullable=False, server_default="GENERAL"),
        sa.Column("is_visible_to_dentist", sa.Boolean(), server_default="true"),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )

    op.create_table(
        "tooth_instructions",
        sa.Column("id", UUID(as_uuid=True), primary_key=True),
        sa.Column("case_id", UUID(as_uuid=True), sa.ForeignKey("cases.id"), nullable=False, index=True),
        sa.Column("dentist_id", UUID(as_uuid=True), sa.ForeignKey("users.id"), nullable=False),
        sa.Column("fdi_tooth_number", sa.Integer(), nullable=False),
        sa.Column("instruction_type", sa.String(50), nullable=False),
        sa.Column("numeric_value", sa.Float(), nullable=True),
        sa.Column("note_text", sa.Text(), nullable=True),
        sa.Column("severity", sa.String(20), nullable=False, server_default="MUST_RESPECT"),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=True),
    )

    op.create_table(
        "segmentation_results",
        sa.Column("id", UUID(as_uuid=True), primary_key=True),
        sa.Column("case_file_id", UUID(as_uuid=True), sa.ForeignKey("case_files.id"), nullable=False, index=True),
        sa.Column("labels_json", sa.Text(), nullable=False),
        sa.Column("confidence_json", sa.Text(), nullable=False),
        sa.Column("restricted_teeth_json", sa.Text(), nullable=False, server_default="[]"),
        sa.Column("overridden_points_count", sa.Integer(), server_default="0"),
        sa.Column("model_version", sa.String(100), nullable=False, server_default="mock_v1"),
        sa.Column("processing_time_seconds", sa.Float(), nullable=False, server_default="0.0"),
        sa.Column("total_points", sa.Integer(), server_default="0"),
        sa.Column("teeth_found_json", sa.Text(), nullable=False, server_default="[]"),
        sa.Column("colored_mesh_s3_key", sa.String(1000), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )

    op.create_table(
        "corrections",
        sa.Column("id", UUID(as_uuid=True), primary_key=True),
        sa.Column("case_file_id", UUID(as_uuid=True), sa.ForeignKey("case_files.id"), nullable=False, index=True),
        sa.Column("technician_id", UUID(as_uuid=True), sa.ForeignKey("users.id"), nullable=False),
        sa.Column("segmentation_result_id", UUID(as_uuid=True), sa.ForeignKey("segmentation_results.id"), nullable=False),
        sa.Column("original_segmentation_json", sa.Text(), nullable=False),
        sa.Column("corrected_segmentation_json", sa.Text(), nullable=False),
        sa.Column("correction_type", sa.String(30), nullable=False),
        sa.Column("confidence_score", sa.Integer(), server_default="3"),
        sa.Column("time_taken_seconds", sa.Float(), server_default="0.0"),
        sa.Column("used_for_training", sa.Boolean(), server_default="false"),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )


def downgrade() -> None:
    op.drop_table("corrections")
    op.drop_table("segmentation_results")
    op.drop_table("tooth_instructions")
    op.drop_table("case_notes")
    op.drop_table("case_files")
    op.drop_table("cases")
    op.drop_table("patients")
