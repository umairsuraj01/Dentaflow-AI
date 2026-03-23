# manufacturing_order.py — Manufacturing order ORM model.

import uuid
from datetime import datetime

from sqlalchemy import (
    DateTime, Float, ForeignKey, Integer, String, Text, func,
)
from sqlalchemy.dialects.postgresql import UUID as PG_UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.constants import ManufacturingCaseType, OrderStatus, OrderType
from app.database.base import Base

UUID = PG_UUID(as_uuid=True)


class ManufacturingOrder(Base):
    """Manufacturing order linked to an approved dental case."""

    __tablename__ = "manufacturing_orders"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID, primary_key=True, default=uuid.uuid4
    )
    case_id: Mapped[uuid.UUID] = mapped_column(
        UUID, ForeignKey("cases.id"), nullable=False, index=True
    )
    treatment_plan_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID, ForeignKey("treatment_plans.id"), nullable=True
    )
    assigned_to_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID, ForeignKey("users.id"), nullable=True, index=True
    )

    # Identity
    order_number: Mapped[str] = mapped_column(
        String(20), unique=True, index=True, nullable=False
    )
    status: Mapped[str] = mapped_column(
        String(20), nullable=False, default=OrderStatus.NEW.value
    )
    order_type: Mapped[str] = mapped_column(
        String(20), nullable=False, default=OrderType.DEFAULT.value
    )
    case_type: Mapped[str] = mapped_column(
        String(20), nullable=False, default=ManufacturingCaseType.INITIAL.value
    )
    replacement_reason: Mapped[str | None] = mapped_column(
        String(20), nullable=True
    )

    # Manufacturing specs
    trimline: Mapped[str] = mapped_column(
        String(30), nullable=False, default="Scalloped"
    )
    aligner_material: Mapped[str] = mapped_column(
        String(100), nullable=False, default="Molekur Pro S"
    )
    attachment_template_material: Mapped[str] = mapped_column(
        String(100), nullable=False, default="Erkolen 0.6mm"
    )
    cutout_info: Mapped[str | None] = mapped_column(Text, nullable=True)
    special_instructions: Mapped[str | None] = mapped_column(Text, nullable=True)

    # Tray counts
    total_trays: Mapped[int] = mapped_column(Integer, default=0)
    upper_aligner_count: Mapped[int] = mapped_column(Integer, default=0)
    lower_aligner_count: Mapped[int] = mapped_column(Integer, default=0)
    attachment_template_count: Mapped[int] = mapped_column(Integer, default=0)
    attachment_start_stage: Mapped[int | None] = mapped_column(
        Integer, nullable=True
    )

    # Shipping
    tracking_number: Mapped[str | None] = mapped_column(
        String(100), nullable=True
    )
    shipping_carrier: Mapped[str | None] = mapped_column(
        String(50), nullable=True
    )
    shipped_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    target_32c_date: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )

    # Timestamps
    assigned_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )

    # Relationships
    case: Mapped["Case"] = relationship("Case", lazy="selectin")  # noqa: F821
    assigned_to: Mapped["User"] = relationship("User", lazy="selectin", foreign_keys=[assigned_to_id])  # noqa: F821
