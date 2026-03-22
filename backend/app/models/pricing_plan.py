# pricing_plan.py — Pricing plan model for subscription tiers.

import uuid
from datetime import datetime

from sqlalchemy import Boolean, DateTime, Float, Integer, String, Text, func
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.database.base import Base


class PricingPlan(Base):
    """Available pricing plans (pay-per-case + subscription tiers)."""

    __tablename__ = "pricing_plans"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    name: Mapped[str] = mapped_column(String(100), nullable=False, unique=True)
    slug: Mapped[str] = mapped_column(String(50), nullable=False, unique=True)
    price_per_case_usd: Mapped[float | None] = mapped_column(Float, nullable=True)
    monthly_fee_usd: Mapped[float] = mapped_column(Float, default=0)
    included_cases_per_month: Mapped[int] = mapped_column(Integer, default=0)
    overage_per_case_usd: Mapped[float] = mapped_column(Float, default=0)
    features_json: Mapped[str | None] = mapped_column(Text, nullable=True)
    turnaround_days: Mapped[int] = mapped_column(Integer, default=3)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    stripe_price_id: Mapped[str | None] = mapped_column(String(255), nullable=True)
    sort_order: Mapped[int] = mapped_column(Integer, default=0)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )
