# payment.py — Payment model for tracking Stripe charges.

import uuid
from datetime import datetime

from sqlalchemy import DateTime, Float, ForeignKey, String, func
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.constants import PaymentStatus
from app.database.base import Base


class Payment(Base):
    """Individual payment record linked to an invoice."""

    __tablename__ = "payments"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    invoice_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("invoices.id"), nullable=False, index=True
    )
    dentist_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id"), nullable=False, index=True
    )
    stripe_charge_id: Mapped[str | None] = mapped_column(String(255), nullable=True)
    stripe_payment_method_id: Mapped[str | None] = mapped_column(
        String(255), nullable=True
    )
    amount_usd: Mapped[float] = mapped_column(Float, nullable=False)
    currency: Mapped[str] = mapped_column(String(3), default="USD")
    status: Mapped[str] = mapped_column(
        String(20), nullable=False, default=PaymentStatus.PENDING.value
    )
    payment_method_type: Mapped[str | None] = mapped_column(
        String(50), nullable=True
    )
    last4: Mapped[str | None] = mapped_column(String(4), nullable=True)
    card_brand: Mapped[str | None] = mapped_column(String(20), nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )

    # Relationships
    invoice = relationship("Invoice", foreign_keys=[invoice_id], lazy="selectin")
    dentist = relationship("User", foreign_keys=[dentist_id], lazy="selectin")
