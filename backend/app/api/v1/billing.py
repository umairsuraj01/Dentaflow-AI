# billing.py — Billing, invoicing, and Stripe payment endpoints.

import json
import logging

import stripe
from fastapi import APIRouter, Depends, Request
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import get_settings
from app.database.connection import get_db
from app.middleware.auth_middleware import get_current_user
from app.models.user import User
from app.schemas.common import ApiResponse
from app.services.billing_service import BillingService

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/billing", tags=["Billing"])


# ── Request schemas ──

class CheckoutRequest(BaseModel):
    case_id: str | None = None
    amount_usd: float
    description: str = "DentaFlow AI - Case Payment"


class SubscribeRequest(BaseModel):
    plan_slug: str  # "starter", "professional", "enterprise"


# ── Plans ──

@router.get("/plans", response_model=ApiResponse[list])
async def list_plans(db: AsyncSession = Depends(get_db)):
    """List all active pricing plans (public)."""
    service = BillingService(db)
    plans = await service.list_plans()
    return ApiResponse(
        success=True,
        message=f"{len(plans)} plans",
        data=[
            {
                "id": str(p.id),
                "name": p.name,
                "slug": p.slug,
                "monthly_fee_usd": p.monthly_fee_usd,
                "price_per_case_usd": p.price_per_case_usd,
                "included_cases_per_month": p.included_cases_per_month,
                "overage_per_case_usd": p.overage_per_case_usd,
                "features": json.loads(p.features_json) if p.features_json else [],
                "turnaround_days": p.turnaround_days,
                "sort_order": p.sort_order,
            }
            for p in plans
        ],
    )


# ── Invoices ──

@router.get("/invoices", response_model=ApiResponse[dict])
async def list_invoices(
    page: int = 1,
    per_page: int = 20,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """List invoices for the current dentist."""
    service = BillingService(db)
    invoices, total = await service.list_invoices(user.id, page, per_page)
    return ApiResponse(
        success=True,
        message=f"{total} invoices",
        data={
            "items": [
                {
                    "id": str(inv.id),
                    "invoice_number": inv.invoice_number,
                    "status": inv.status,
                    "amount_usd": inv.amount_usd,
                    "total_amount_usd": inv.total_amount_usd,
                    "currency": inv.currency,
                    "due_date": inv.due_date.isoformat() if inv.due_date else None,
                    "paid_at": inv.paid_at.isoformat() if inv.paid_at else None,
                    "created_at": inv.created_at.isoformat() if inv.created_at else None,
                    "case_id": str(inv.case_id) if inv.case_id else None,
                    "line_items": json.loads(inv.line_items_json) if inv.line_items_json else [],
                    "pdf_url": inv.pdf_url,
                }
                for inv in invoices
            ],
            "total": total,
            "page": page,
            "per_page": per_page,
        },
    )


@router.get("/invoices/{invoice_id}", response_model=ApiResponse[dict])
async def get_invoice(
    invoice_id: str,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Get a single invoice."""
    from uuid import UUID
    service = BillingService(db)
    invoice = await service.get_invoice(UUID(invoice_id))
    if not invoice or invoice.dentist_id != user.id:
        return ApiResponse(success=False, message="Invoice not found", data=None)
    return ApiResponse(
        success=True,
        message="OK",
        data={
            "id": str(invoice.id),
            "invoice_number": invoice.invoice_number,
            "status": invoice.status,
            "amount_usd": invoice.amount_usd,
            "tax_amount_usd": invoice.tax_amount_usd,
            "total_amount_usd": invoice.total_amount_usd,
            "currency": invoice.currency,
            "due_date": invoice.due_date.isoformat() if invoice.due_date else None,
            "paid_at": invoice.paid_at.isoformat() if invoice.paid_at else None,
            "created_at": invoice.created_at.isoformat() if invoice.created_at else None,
            "case_id": str(invoice.case_id) if invoice.case_id else None,
            "line_items": json.loads(invoice.line_items_json) if invoice.line_items_json else [],
            "notes": invoice.notes,
            "pdf_url": invoice.pdf_url,
            "dentist": {
                "full_name": invoice.dentist.full_name if invoice.dentist else None,
                "email": invoice.dentist.email if invoice.dentist else None,
                "clinic_name": invoice.dentist.clinic_name if invoice.dentist else None,
            },
        },
    )


# ── Checkout & Payments ──

@router.post("/checkout", response_model=ApiResponse[dict])
async def create_checkout(
    data: CheckoutRequest,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Create a Stripe Checkout Session for one-time payment."""
    try:
        from uuid import UUID
        service = BillingService(db)
        url = await service.create_checkout_session(
            user=user,
            case_id=UUID(data.case_id) if data.case_id else None,
            amount_usd=data.amount_usd,
            description=data.description,
        )
        return ApiResponse(success=True, message="Checkout session created", data={"url": url})
    except Exception as exc:
        return ApiResponse(success=False, message=f"Checkout failed: {exc}", data=None)


# ── Subscriptions ──

@router.post("/subscribe", response_model=ApiResponse[dict])
async def subscribe(
    data: SubscribeRequest,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Subscribe to a monthly plan via Stripe Checkout."""
    try:
        service = BillingService(db)
        plan = await service.get_plan_by_slug(data.plan_slug)
        if not plan:
            return ApiResponse(success=False, message=f"Plan not found: {data.plan_slug}", data=None)
        url = await service.create_subscription_session(user, plan)
        return ApiResponse(success=True, message="Subscription session created", data={"url": url})
    except Exception as exc:
        return ApiResponse(success=False, message=f"Subscribe failed: {exc}", data=None)


@router.delete("/subscribe", response_model=ApiResponse[dict])
async def cancel_subscription(
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Cancel current subscription (at end of period)."""
    service = BillingService(db)
    success = await service.cancel_subscription(user.id)
    if not success:
        return ApiResponse(success=False, message="No active subscription found", data=None)
    return ApiResponse(success=True, message="Subscription will cancel at end of period", data=None)


@router.get("/subscription", response_model=ApiResponse[dict])
async def get_subscription(
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Get current subscription + usage."""
    service = BillingService(db)
    stats = await service.get_billing_stats(user.id)
    return ApiResponse(success=True, message="OK", data=stats)


# ── Portal ──

@router.post("/portal", response_model=ApiResponse[dict])
async def create_portal(
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Create Stripe Customer Portal session."""
    try:
        service = BillingService(db)
        url = await service.create_portal_session(user)
        return ApiResponse(success=True, message="Portal session created", data={"url": url})
    except Exception as exc:
        return ApiResponse(success=False, message=f"Portal failed: {exc}", data=None)


# ── Webhook ──

@router.post("/webhooks/stripe")
async def stripe_webhook(
    request: Request,
    db: AsyncSession = Depends(get_db),
):
    """Handle Stripe webhook events."""
    settings = get_settings()
    payload = await request.body()
    sig_header = request.headers.get("stripe-signature", "")

    try:
        event = stripe.Webhook.construct_event(
            payload, sig_header, settings.stripe_webhook_secret,
        )
    except (ValueError, stripe.error.SignatureVerificationError) as e:
        logger.warning(f"Webhook signature verification failed: {e}")
        return {"error": "Invalid signature"}, 400

    service = BillingService(db)
    await service.handle_webhook_event(event)
    return {"received": True}


# ── Stats ──

@router.get("/stats", response_model=ApiResponse[dict])
async def billing_stats(
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Get billing stats for current user."""
    service = BillingService(db)
    stats = await service.get_billing_stats(user.id)
    return ApiResponse(success=True, message="OK", data=stats)
