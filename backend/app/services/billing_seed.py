# billing_seed.py — Seed default pricing plans into the database.

import json
import logging

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.constants import (
    PRICE_NORMAL_USD, PRICE_URGENT_USD, PRICE_RUSH_USD,
    PLAN_STARTER_MONTHLY, PLAN_STARTER_CASES, PLAN_STARTER_OVERAGE,
    PLAN_PRO_MONTHLY, PLAN_PRO_CASES, PLAN_PRO_OVERAGE,
    PLAN_ENTERPRISE_MONTHLY, PLAN_ENTERPRISE_CASES, PLAN_ENTERPRISE_OVERAGE,
)
from app.models.pricing_plan import PricingPlan

logger = logging.getLogger(__name__)

SEED_PLANS = [
    {
        "name": "Pay Per Case",
        "slug": "pay-per-case",
        "monthly_fee_usd": 0,
        "price_per_case_usd": PRICE_NORMAL_USD,
        "included_cases_per_month": 0,
        "overage_per_case_usd": 0,
        "turnaround_days": 3,
        "sort_order": 0,
        "features_json": json.dumps([
            "No monthly commitment",
            f"Normal: ${PRICE_NORMAL_USD}/case (3 days)",
            f"Urgent: ${PRICE_URGENT_USD}/case (1 day)",
            f"Rush: ${PRICE_RUSH_USD}/case (same day)",
            "Full AI segmentation",
            "Treatment planning tools",
        ]),
    },
    {
        "name": "Starter",
        "slug": "starter",
        "monthly_fee_usd": PLAN_STARTER_MONTHLY,
        "price_per_case_usd": None,
        "included_cases_per_month": PLAN_STARTER_CASES,
        "overage_per_case_usd": PLAN_STARTER_OVERAGE,
        "turnaround_days": 2,
        "sort_order": 1,
        "features_json": json.dumps([
            f"{PLAN_STARTER_CASES} cases included/month",
            f"${PLAN_STARTER_OVERAGE}/case after limit",
            "Priority support",
            "Full AI segmentation",
            "Treatment planning tools",
            "2-day turnaround",
        ]),
    },
    {
        "name": "Professional",
        "slug": "professional",
        "monthly_fee_usd": PLAN_PRO_MONTHLY,
        "price_per_case_usd": None,
        "included_cases_per_month": PLAN_PRO_CASES,
        "overage_per_case_usd": PLAN_PRO_OVERAGE,
        "turnaround_days": 1,
        "sort_order": 2,
        "features_json": json.dumps([
            f"{PLAN_PRO_CASES} cases included/month",
            f"${PLAN_PRO_OVERAGE}/case after limit",
            "Priority support",
            "Full AI segmentation",
            "Treatment planning tools",
            "1-day turnaround",
            "Dedicated account manager",
        ]),
    },
    {
        "name": "Enterprise",
        "slug": "enterprise",
        "monthly_fee_usd": PLAN_ENTERPRISE_MONTHLY,
        "price_per_case_usd": None,
        "included_cases_per_month": PLAN_ENTERPRISE_CASES,
        "overage_per_case_usd": PLAN_ENTERPRISE_OVERAGE,
        "turnaround_days": 1,
        "sort_order": 3,
        "features_json": json.dumps([
            f"{PLAN_ENTERPRISE_CASES} cases included/month",
            f"${PLAN_ENTERPRISE_OVERAGE}/case after limit",
            "24/7 priority support",
            "Full AI segmentation",
            "Treatment planning tools",
            "Same-day turnaround",
            "Dedicated account manager",
            "Custom API access",
            "White-label options",
        ]),
    },
]


async def seed_pricing_plans(db: AsyncSession) -> None:
    """Insert default pricing plans if they don't exist."""
    for plan_data in SEED_PLANS:
        slug = plan_data["slug"]
        result = await db.execute(
            select(PricingPlan).where(PricingPlan.slug == slug)
        )
        existing = result.scalar_one_or_none()
        if not existing:
            plan = PricingPlan(**plan_data)
            db.add(plan)
            logger.info(f"Seeded plan: {plan_data['name']}")
    await db.flush()
