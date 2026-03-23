# manufacturing.py — Manufacturing order API endpoints.

import uuid
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import StreamingResponse
from sqlalchemy.ext.asyncio import AsyncSession

from app.database.connection import get_db
from app.middleware.auth_middleware import get_current_user
from app.models.user import User
from app.schemas.manufacturing import (
    BulkStatusUpdate,
    ManufacturingOrderCreate,
    ManufacturingOrderResponse,
    ManufacturingOrderUpdate,
    ManufacturingStatsResponse,
    ShipOrderRequest,
)
from app.services.manufacturing_service import ManufacturingService

router = APIRouter(prefix="/manufacturing", tags=["Manufacturing"])


def _svc(db: AsyncSession) -> ManufacturingService:
    return ManufacturingService(db)


# ---------------------------------------------------------------------------
# List & Stats
# ---------------------------------------------------------------------------

@router.get("/orders", response_model=dict)
async def list_orders(
    status: Optional[str] = Query(None),
    search: Optional[str] = Query(None),
    page: int = Query(1, ge=1),
    per_page: int = Query(20, ge=1, le=100),
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """List manufacturing orders with optional status and search filters."""
    svc = _svc(db)
    orders, total = await svc.list_orders(status=status, search=search, page=page, per_page=per_page)
    total_pages = (total + per_page - 1) // per_page
    return {
        "success": True,
        "data": {
            "items": [o.model_dump() for o in orders],
            "total": total,
            "page": page,
            "per_page": per_page,
            "total_pages": total_pages,
        },
    }


@router.get("/orders/stats", response_model=dict)
async def get_stats(
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """Get order counts per status for tab badges."""
    svc = _svc(db)
    stats = await svc.get_stats()
    return {"success": True, "data": stats.model_dump()}


@router.get("/orders/export/csv")
async def export_csv(
    status: Optional[str] = Query(None),
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """Export orders as CSV download."""
    svc = _svc(db)
    csv_content = await svc.export_csv(status=status)
    return StreamingResponse(
        iter([csv_content]),
        media_type="text/csv",
        headers={"Content-Disposition": "attachment; filename=manufacturing_orders.csv"},
    )


# ---------------------------------------------------------------------------
# CRUD
# ---------------------------------------------------------------------------

@router.post("/orders", response_model=dict, status_code=201)
async def create_order(
    data: ManufacturingOrderCreate,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """Create a new manufacturing order."""
    svc = _svc(db)
    order = await svc.create_order(data)
    return {"success": True, "data": order.model_dump()}


@router.get("/orders/{order_id}", response_model=dict)
async def get_order(
    order_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """Get a single manufacturing order by ID."""
    svc = _svc(db)
    try:
        order = await svc.get_order(order_id)
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    return {"success": True, "data": order.model_dump()}


@router.put("/orders/{order_id}", response_model=dict)
async def update_order(
    order_id: uuid.UUID,
    data: ManufacturingOrderUpdate,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """Update manufacturing specs on an order."""
    svc = _svc(db)
    try:
        order = await svc.update_order(order_id, data)
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    return {"success": True, "data": order.model_dump()}


# ---------------------------------------------------------------------------
# Status Transitions
# ---------------------------------------------------------------------------

@router.post("/orders/{order_id}/in-progress", response_model=dict)
async def move_to_in_progress(
    order_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """Move a NEW order to IN_PROGRESS."""
    svc = _svc(db)
    try:
        order = await svc.move_to_in_progress(order_id, user)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    return {"success": True, "data": order.model_dump()}


@router.post("/orders/{order_id}/ship", response_model=dict)
async def mark_shipped(
    order_id: uuid.UUID,
    data: ShipOrderRequest,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """Mark an IN_PROGRESS order as SHIPPED with tracking info."""
    svc = _svc(db)
    try:
        order = await svc.mark_shipped(order_id, data)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    return {"success": True, "data": order.model_dump()}


@router.get("/orders/{order_id}/certificate")
async def get_device_certificate(
    order_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """Generate a device certificate PDF-like HTML for printing."""
    svc = _svc(db)
    try:
        order = await svc.get_order(order_id)
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))

    html = f"""<!DOCTYPE html>
<html><head><title>Device Certificate - {order.order_number}</title>
<style>
  body {{ font-family: 'Helvetica Neue', Arial, sans-serif; max-width: 800px; margin: 40px auto; color: #1e293b; }}
  h1 {{ color: #3B82F6; border-bottom: 2px solid #3B82F6; padding-bottom: 10px; }}
  .grid {{ display: grid; grid-template-columns: 1fr 1fr; gap: 16px; margin: 20px 0; }}
  .field {{ padding: 12px; background: #f8fafc; border-radius: 8px; border: 1px solid #e2e8f0; }}
  .field label {{ font-size: 11px; font-weight: 700; color: #64748b; text-transform: uppercase; }}
  .field p {{ font-size: 14px; font-weight: 600; margin: 4px 0 0; }}
  .footer {{ margin-top: 40px; padding-top: 20px; border-top: 1px solid #e2e8f0; text-align: center; font-size: 12px; color: #94a3b8; }}
  @media print {{ body {{ margin: 20px; }} }}
</style></head><body>
<h1>Device Certificate</h1>
<p style="color:#64748b;">Manufacturing Order: <strong>{order.order_number}</strong></p>
<div class="grid">
  <div class="field"><label>Patient Name</label><p>{order.patient_name or 'N/A'}</p></div>
  <div class="field"><label>Case Number</label><p>{order.case_number or 'N/A'}</p></div>
  <div class="field"><label>Order Type</label><p>{order.order_type}</p></div>
  <div class="field"><label>Case Type</label><p>{order.case_type}</p></div>
  <div class="field"><label>Trimline</label><p>{order.trimline}</p></div>
  <div class="field"><label>Aligner Material</label><p>{order.aligner_material}</p></div>
  <div class="field"><label>Attachment Template Material</label><p>{order.attachment_template_material}</p></div>
  <div class="field"><label>Total Trays</label><p>{order.total_trays}</p></div>
  <div class="field"><label>Upper Aligners</label><p>{order.upper_aligner_count}</p></div>
  <div class="field"><label>Lower Aligners</label><p>{order.lower_aligner_count}</p></div>
  <div class="field"><label>Attachment Templates</label><p>{order.attachment_template_count}</p></div>
  <div class="field"><label>Start Stage</label><p>Stage {order.attachment_start_stage or 'N/A'}</p></div>
</div>
{f'<div class="field" style="margin-top:16px;"><label>Special Instructions</label><p>{order.special_instructions}</p></div>' if order.special_instructions else ''}
<div class="footer">
  <p>This document certifies that the above aligner set was manufactured according to the specified parameters.</p>
  <p>Generated by DentaFlow AI &middot; {order.created_at.strftime('%Y-%m-%d') if hasattr(order.created_at, 'strftime') else order.created_at}</p>
</div>
<script>window.onload = function() {{ window.print(); }}</script>
</body></html>"""

    return StreamingResponse(
        iter([html]),
        media_type="text/html",
        headers={"Content-Type": "text/html; charset=utf-8"},
    )


@router.post("/orders/bulk-status", response_model=dict)
async def bulk_update_status(
    data: BulkStatusUpdate,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """Bulk update status of multiple orders."""
    svc = _svc(db)
    count = await svc.bulk_update_status(data)
    return {"success": True, "data": {"updated": count}}
