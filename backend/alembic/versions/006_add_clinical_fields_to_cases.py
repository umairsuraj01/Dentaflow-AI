"""Add clinical treatment instruction fields to cases.

Revision ID: 006
Revises: 005
Create Date: 2026-03-30
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

revision: str = "006"
down_revision: Union[str, None] = "005"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

CLINICAL_COLS = [
    ("patient_type", sa.String(20)),
    ("retainer_preference", sa.String(50)),
    ("passive_aligners", sa.String(50)),
    ("aligner_shipment", sa.String(30)),
    ("rescan_after_ipr", sa.Boolean()),
    ("midline_instruction", sa.String(50)),
    ("overjet_instruction", sa.String(20)),
    ("overbite_instruction", sa.String(20)),
    ("crossbite_instruction", sa.String(20)),
    ("right_canine_class", sa.String(10)),
    ("left_canine_class", sa.String(10)),
    ("right_molar_class", sa.String(10)),
    ("left_molar_class", sa.String(10)),
    ("ipr_preference", sa.String(100)),
    ("proclination_preference", sa.String(50)),
    ("expansion_preference", sa.String(50)),
    ("extraction_preference", sa.String(50)),
    ("ipr_prescription", sa.String(50)),
    ("auxiliary_type", sa.String(50)),
]


def upgrade() -> None:
    for col_name, col_type in CLINICAL_COLS:
        op.add_column("cases", sa.Column(col_name, col_type, nullable=True))


def downgrade() -> None:
    for col_name, _ in CLINICAL_COLS:
        op.drop_column("cases", col_name)
