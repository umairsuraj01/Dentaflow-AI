# loyalty.py — Loyalty points system models.

import uuid
from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, Integer, String, Text, func
from sqlalchemy.dialects.postgresql import UUID as PG_UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.database.base import Base

UUID = PG_UUID(as_uuid=True)


class LoyaltyAccount(Base):
    __tablename__ = "loyalty_accounts"

    id: Mapped[uuid.UUID] = mapped_column(UUID, primary_key=True, default=uuid.uuid4)
    user_id: Mapped[uuid.UUID] = mapped_column(UUID, ForeignKey("users.id"), unique=True, nullable=False, index=True)
    org_id: Mapped[uuid.UUID | None] = mapped_column(UUID, ForeignKey("organizations.id"), nullable=True)
    total_points: Mapped[int] = mapped_column(Integer, default=0)
    availed_points: Mapped[int] = mapped_column(Integer, default=0)
    remaining_points: Mapped[int] = mapped_column(Integer, default=0)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


class LoyaltyTransaction(Base):
    __tablename__ = "loyalty_transactions"

    id: Mapped[uuid.UUID] = mapped_column(UUID, primary_key=True, default=uuid.uuid4)
    account_id: Mapped[uuid.UUID] = mapped_column(UUID, ForeignKey("loyalty_accounts.id"), nullable=False, index=True)
    case_id: Mapped[uuid.UUID | None] = mapped_column(UUID, ForeignKey("cases.id"), nullable=True)
    points: Mapped[int] = mapped_column(Integer, nullable=False)
    type: Mapped[str] = mapped_column(String(20), nullable=False)  # EARNED / REDEEMED / EXPIRED
    description: Mapped[str] = mapped_column(Text, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
