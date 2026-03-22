# billing_service.py — Billing, invoicing, and Stripe integration service.

import json
import logging
import uuid
from datetime import datetime, timedelta, timezone

import stripe
from sqlalchemy import select, func, desc
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import get_settings
from app.constants import InvoiceStatus, PaymentStatus, SubscriptionStatus
from app.models.invoice import Invoice
from app.models.payment import Payment
from app.models.pricing_plan import PricingPlan
from app.models.subscription import Subscription
from app.models.user import User

logger = logging.getLogger(__name__)


def _configure_stripe():
    settings = get_settings()
    stripe.api_key = settings.stripe_secret_key


def _generate_invoice_number() -> str:
    """Generate INV-YYYY-NNNNNN format."""
    now = datetime.now(timezone.utc)
    rand = uuid.uuid4().hex[:6].upper()
    return f"INV-{now.year}-{rand}"


class BillingService:
    """Handles all billing operations."""

    def __init__(self, db: AsyncSession):
        self.db = db
        _configure_stripe()

    # ── Plans ──

    async def list_plans(self, active_only: bool = True) -> list[PricingPlan]:
        q = select(PricingPlan).order_by(PricingPlan.sort_order)
        if active_only:
            q = q.where(PricingPlan.is_active == True)
        result = await self.db.execute(q)
        return list(result.scalars().all())

    async def get_plan(self, plan_id: uuid.UUID) -> PricingPlan | None:
        result = await self.db.execute(
            select(PricingPlan).where(PricingPlan.id == plan_id)
        )
        return result.scalar_one_or_none()

    async def get_plan_by_slug(self, slug: str) -> PricingPlan | None:
        result = await self.db.execute(
            select(PricingPlan).where(PricingPlan.slug == slug)
        )
        return result.scalar_one_or_none()

    # ── Invoices ──

    async def list_invoices(
        self, dentist_id: uuid.UUID, page: int = 1, per_page: int = 20,
    ) -> tuple[list[Invoice], int]:
        base = select(Invoice).where(Invoice.dentist_id == dentist_id)
        count_q = select(func.count()).select_from(base.subquery())
        total = (await self.db.execute(count_q)).scalar() or 0

        q = base.order_by(desc(Invoice.created_at)).offset((page - 1) * per_page).limit(per_page)
        result = await self.db.execute(q)
        return list(result.scalars().all()), total

    async def get_invoice(self, invoice_id: uuid.UUID) -> Invoice | None:
        result = await self.db.execute(
            select(Invoice).where(Invoice.id == invoice_id)
        )
        return result.scalar_one_or_none()

    async def create_invoice_for_case(
        self, dentist_id: uuid.UUID, case_id: uuid.UUID, amount_usd: float,
        description: str = "Case treatment",
    ) -> Invoice:
        """Auto-create invoice when a case is completed."""
        tax = round(amount_usd * 0.0, 2)  # Tax placeholder (0% for now)
        total = round(amount_usd + tax, 2)

        line_items = json.dumps([{
            "description": description,
            "quantity": 1,
            "unit_price": amount_usd,
            "amount": amount_usd,
        }])

        invoice = Invoice(
            invoice_number=_generate_invoice_number(),
            dentist_id=dentist_id,
            case_id=case_id,
            status=InvoiceStatus.SENT.value,
            amount_usd=amount_usd,
            tax_amount_usd=tax,
            total_amount_usd=total,
            line_items_json=line_items,
            due_date=datetime.now(timezone.utc) + timedelta(days=14),
        )
        self.db.add(invoice)
        await self.db.flush()
        return invoice

    # ── Subscriptions ──

    async def get_subscription(self, dentist_id: uuid.UUID) -> Subscription | None:
        result = await self.db.execute(
            select(Subscription)
            .where(Subscription.dentist_id == dentist_id)
            .where(Subscription.status.in_([
                SubscriptionStatus.ACTIVE.value,
                SubscriptionStatus.PAST_DUE.value,
                SubscriptionStatus.TRIALING.value,
            ]))
            .order_by(desc(Subscription.created_at))
            .limit(1)
        )
        return result.scalar_one_or_none()

    async def increment_case_usage(self, dentist_id: uuid.UUID) -> None:
        sub = await self.get_subscription(dentist_id)
        if sub:
            sub.cases_used_this_period += 1
            await self.db.flush()

    # ── Stripe Checkout ──

    async def create_checkout_session(
        self, user: User, case_id: uuid.UUID | None, amount_usd: float,
        description: str = "DentaFlow AI - Case Payment",
    ) -> str:
        """Create a Stripe Checkout Session for one-time payment. Returns session URL."""
        settings = get_settings()
        customer_id = await self._get_or_create_stripe_customer(user)

        session = stripe.checkout.Session.create(
            customer=customer_id,
            payment_method_types=["card"],
            line_items=[{
                "price_data": {
                    "currency": "usd",
                    "unit_amount": int(amount_usd * 100),
                    "product_data": {"name": description},
                },
                "quantity": 1,
            }],
            mode="payment",
            success_url=f"{settings.frontend_url}/billing?session_id={{CHECKOUT_SESSION_ID}}&status=success",
            cancel_url=f"{settings.frontend_url}/billing?status=cancelled",
            metadata={
                "dentist_id": str(user.id),
                "case_id": str(case_id) if case_id else "",
            },
        )
        return session.url

    async def create_subscription_session(
        self, user: User, plan: PricingPlan,
    ) -> str:
        """Create a Stripe Checkout Session for subscription. Returns session URL."""
        settings = get_settings()
        customer_id = await self._get_or_create_stripe_customer(user)

        if not plan.stripe_price_id:
            # Create a price on Stripe dynamically
            product = stripe.Product.create(
                name=f"DentaFlow AI - {plan.name}",
                metadata={"plan_id": str(plan.id)},
            )
            price = stripe.Price.create(
                product=product.id,
                unit_amount=int(plan.monthly_fee_usd * 100),
                currency="usd",
                recurring={"interval": "month"},
            )
            plan.stripe_price_id = price.id
            await self.db.flush()

        session = stripe.checkout.Session.create(
            customer=customer_id,
            payment_method_types=["card"],
            line_items=[{"price": plan.stripe_price_id, "quantity": 1}],
            mode="subscription",
            success_url=f"{settings.frontend_url}/billing?session_id={{CHECKOUT_SESSION_ID}}&status=success",
            cancel_url=f"{settings.frontend_url}/billing?status=cancelled",
            metadata={
                "dentist_id": str(user.id),
                "plan_id": str(plan.id),
            },
        )
        return session.url

    async def cancel_subscription(self, dentist_id: uuid.UUID) -> bool:
        sub = await self.get_subscription(dentist_id)
        if not sub:
            return False
        if sub.stripe_subscription_id:
            stripe.Subscription.modify(
                sub.stripe_subscription_id,
                cancel_at_period_end=True,
            )
        sub.status = SubscriptionStatus.CANCELLED.value
        sub.cancelled_at = datetime.now(timezone.utc)
        await self.db.flush()
        return True

    async def create_portal_session(self, user: User) -> str:
        """Create Stripe Customer Portal session. Returns URL."""
        settings = get_settings()
        customer_id = await self._get_or_create_stripe_customer(user)
        session = stripe.billing_portal.Session.create(
            customer=customer_id,
            return_url=f"{settings.frontend_url}/billing",
        )
        return session.url

    # ── Stripe Webhooks ──

    async def handle_webhook_event(self, event: dict) -> None:
        event_type = event.get("type", "")
        data = event.get("data", {}).get("object", {})

        if event_type == "payment_intent.succeeded":
            await self._handle_payment_succeeded(data)
        elif event_type == "invoice.paid":
            await self._handle_invoice_paid(data)
        elif event_type == "invoice.payment_failed":
            await self._handle_payment_failed(data)
        elif event_type == "customer.subscription.updated":
            await self._handle_subscription_updated(data)
        elif event_type == "customer.subscription.deleted":
            await self._handle_subscription_deleted(data)
        elif event_type == "checkout.session.completed":
            await self._handle_checkout_completed(data)

    async def _handle_checkout_completed(self, session_data: dict) -> None:
        mode = session_data.get("mode")
        metadata = session_data.get("metadata", {})
        dentist_id = metadata.get("dentist_id")
        if not dentist_id:
            return

        if mode == "subscription":
            plan_id = metadata.get("plan_id")
            stripe_sub_id = session_data.get("subscription")
            stripe_customer = session_data.get("customer")
            if plan_id and stripe_sub_id:
                sub = Subscription(
                    dentist_id=uuid.UUID(dentist_id),
                    plan_id=uuid.UUID(plan_id),
                    stripe_subscription_id=stripe_sub_id,
                    stripe_customer_id=stripe_customer,
                    status=SubscriptionStatus.ACTIVE.value,
                    current_period_start=datetime.now(timezone.utc),
                    current_period_end=datetime.now(timezone.utc) + timedelta(days=30),
                    cases_used_this_period=0,
                )
                self.db.add(sub)

        elif mode == "payment":
            case_id_str = metadata.get("case_id")
            amount = (session_data.get("amount_total") or 0) / 100
            if amount > 0:
                invoice = await self.create_invoice_for_case(
                    dentist_id=uuid.UUID(dentist_id),
                    case_id=uuid.UUID(case_id_str) if case_id_str else None,
                    amount_usd=amount,
                )
                invoice.status = InvoiceStatus.PAID.value
                invoice.paid_at = datetime.now(timezone.utc)
                invoice.stripe_payment_intent_id = session_data.get("payment_intent")

                payment = Payment(
                    invoice_id=invoice.id,
                    dentist_id=uuid.UUID(dentist_id),
                    stripe_charge_id=session_data.get("payment_intent"),
                    amount_usd=amount,
                    status=PaymentStatus.SUCCEEDED.value,
                )
                self.db.add(payment)

        await self.db.flush()

    async def _handle_payment_succeeded(self, intent: dict) -> None:
        logger.info(f"Payment succeeded: {intent.get('id')}")

    async def _handle_invoice_paid(self, invoice_data: dict) -> None:
        stripe_sub_id = invoice_data.get("subscription")
        if stripe_sub_id:
            result = await self.db.execute(
                select(Subscription).where(
                    Subscription.stripe_subscription_id == stripe_sub_id
                )
            )
            sub = result.scalar_one_or_none()
            if sub:
                sub.status = SubscriptionStatus.ACTIVE.value
                sub.cases_used_this_period = 0
                period_end = invoice_data.get("period_end")
                if period_end:
                    sub.current_period_end = datetime.fromtimestamp(
                        period_end, tz=timezone.utc
                    )
                await self.db.flush()

    async def _handle_payment_failed(self, invoice_data: dict) -> None:
        stripe_sub_id = invoice_data.get("subscription")
        if stripe_sub_id:
            result = await self.db.execute(
                select(Subscription).where(
                    Subscription.stripe_subscription_id == stripe_sub_id
                )
            )
            sub = result.scalar_one_or_none()
            if sub:
                sub.status = SubscriptionStatus.PAST_DUE.value
                await self.db.flush()

    async def _handle_subscription_updated(self, sub_data: dict) -> None:
        stripe_sub_id = sub_data.get("id")
        result = await self.db.execute(
            select(Subscription).where(
                Subscription.stripe_subscription_id == stripe_sub_id
            )
        )
        sub = result.scalar_one_or_none()
        if sub:
            status_map = {
                "active": SubscriptionStatus.ACTIVE.value,
                "past_due": SubscriptionStatus.PAST_DUE.value,
                "canceled": SubscriptionStatus.CANCELLED.value,
                "unpaid": SubscriptionStatus.UNPAID.value,
                "trialing": SubscriptionStatus.TRIALING.value,
            }
            sub.status = status_map.get(
                sub_data.get("status", ""), sub.status
            )
            period_end = sub_data.get("current_period_end")
            if period_end:
                sub.current_period_end = datetime.fromtimestamp(
                    period_end, tz=timezone.utc
                )
            await self.db.flush()

    async def _handle_subscription_deleted(self, sub_data: dict) -> None:
        stripe_sub_id = sub_data.get("id")
        result = await self.db.execute(
            select(Subscription).where(
                Subscription.stripe_subscription_id == stripe_sub_id
            )
        )
        sub = result.scalar_one_or_none()
        if sub:
            sub.status = SubscriptionStatus.CANCELLED.value
            sub.cancelled_at = datetime.now(timezone.utc)
            await self.db.flush()

    # ── Account Standing ──

    async def check_account_standing(self, dentist_id: uuid.UUID) -> tuple[bool, str]:
        """Check if dentist can submit new cases. Returns (allowed, reason)."""
        # Check for overdue invoices > 14 days
        cutoff = datetime.now(timezone.utc) - timedelta(days=14)
        result = await self.db.execute(
            select(func.count()).where(
                Invoice.dentist_id == dentist_id,
                Invoice.status == InvoiceStatus.OVERDUE.value,
                Invoice.due_date < cutoff,
            )
        )
        overdue_count = result.scalar() or 0
        if overdue_count > 0:
            return False, "Account suspended: invoices overdue for more than 14 days"
        return True, "Good standing"

    # ── Stats ──

    async def get_billing_stats(self, dentist_id: uuid.UUID) -> dict:
        sub = await self.get_subscription(dentist_id)

        # Total paid this month
        month_start = datetime.now(timezone.utc).replace(
            day=1, hour=0, minute=0, second=0, microsecond=0
        )
        result = await self.db.execute(
            select(func.sum(Invoice.total_amount_usd)).where(
                Invoice.dentist_id == dentist_id,
                Invoice.status == InvoiceStatus.PAID.value,
                Invoice.paid_at >= month_start,
            )
        )
        monthly_spend = result.scalar() or 0

        # Total all time
        result = await self.db.execute(
            select(func.sum(Invoice.total_amount_usd)).where(
                Invoice.dentist_id == dentist_id,
                Invoice.status == InvoiceStatus.PAID.value,
            )
        )
        total_spent = result.scalar() or 0

        # Pending invoices
        result = await self.db.execute(
            select(func.count()).where(
                Invoice.dentist_id == dentist_id,
                Invoice.status.in_([InvoiceStatus.SENT.value, InvoiceStatus.OVERDUE.value]),
            )
        )
        pending_count = result.scalar() or 0

        return {
            "current_plan": sub.plan.name if sub and sub.plan else "Pay-per-case",
            "plan_slug": sub.plan.slug if sub and sub.plan else "pay-per-case",
            "cases_used": sub.cases_used_this_period if sub else 0,
            "cases_included": sub.plan.included_cases_per_month if sub and sub.plan else 0,
            "period_end": sub.current_period_end.isoformat() if sub and sub.current_period_end else None,
            "monthly_spend_usd": round(monthly_spend, 2),
            "total_spent_usd": round(total_spent, 2),
            "pending_invoices": pending_count,
            "subscription_status": sub.status if sub else None,
        }

    # ── Helpers ──

    async def _get_or_create_stripe_customer(self, user: User) -> str:
        """Get existing Stripe customer ID or create one."""
        # Check if user has an existing subscription with customer ID
        result = await self.db.execute(
            select(Subscription.stripe_customer_id)
            .where(Subscription.dentist_id == user.id)
            .where(Subscription.stripe_customer_id.isnot(None))
            .limit(1)
        )
        existing = result.scalar_one_or_none()
        if existing:
            return existing

        customer = stripe.Customer.create(
            email=user.email,
            name=user.full_name,
            metadata={"dentist_id": str(user.id)},
        )
        return customer.id
