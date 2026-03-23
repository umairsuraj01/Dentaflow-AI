# manufacturing_service.py — Business logic for manufacturing orders.

import csv
import io
import uuid
from datetime import datetime, timezone

from sqlalchemy import func, select, update
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.constants import APP_ORDER_PREFIX, OrderStatus
from app.models.case import Case
from app.models.manufacturing_order import ManufacturingOrder
from app.models.patient import Patient
from app.models.treatment_plan import TreatmentPlan
from app.models.user import User
from app.schemas.manufacturing import (
    BulkStatusUpdate,
    ManufacturingOrderCreate,
    ManufacturingOrderResponse,
    ManufacturingOrderUpdate,
    ManufacturingStatsResponse,
    ShipOrderRequest,
)


def _to_response(order: ManufacturingOrder) -> ManufacturingOrderResponse:
    """Convert ORM model to response, enriching with computed fields."""
    patient_name = None
    case_number = None
    assigned_to_name = None

    if order.case:
        case_number = order.case.case_number
        # Case eagerly loads patient through its own relationship — not guaranteed.
        # We set patient_name from the join query instead.
    if order.assigned_to:
        assigned_to_name = order.assigned_to.full_name

    resp = ManufacturingOrderResponse.model_validate(order)
    resp.case_number = case_number
    resp.patient_name = getattr(order, "_patient_name", None) or patient_name
    resp.assigned_to_name = assigned_to_name
    return resp


class ManufacturingService:
    def __init__(self, db: AsyncSession):
        self.db = db

    # -- Helpers --------------------------------------------------------------

    async def _next_order_number(self) -> str:
        year = datetime.now(timezone.utc).year
        prefix = f"{APP_ORDER_PREFIX}-{year}-"
        result = await self.db.execute(
            select(func.count())
            .select_from(ManufacturingOrder)
            .where(ManufacturingOrder.order_number.startswith(prefix))
        )
        count = result.scalar_one() + 1
        return f"{prefix}{count:06d}"

    async def _get_order(self, order_id: uuid.UUID) -> ManufacturingOrder:
        result = await self.db.execute(
            select(ManufacturingOrder).where(ManufacturingOrder.id == order_id)
        )
        order = result.scalar_one_or_none()
        if not order:
            raise ValueError(f"Order {order_id} not found")
        return order

    # -- CRUD -----------------------------------------------------------------

    async def create_order(
        self, data: ManufacturingOrderCreate
    ) -> ManufacturingOrderResponse:
        order = ManufacturingOrder(
            id=uuid.uuid4(),
            order_number=await self._next_order_number(),
            **data.model_dump(),
        )
        self.db.add(order)
        await self.db.commit()
        await self.db.refresh(order)
        return _to_response(order)

    async def get_order(self, order_id: uuid.UUID) -> ManufacturingOrderResponse:
        order = await self._get_order(order_id)
        # Fetch patient name via case
        if order.case_id:
            result = await self.db.execute(
                select(Patient.first_name, Patient.last_name)
                .join(Case, Case.patient_id == Patient.id)
                .where(Case.id == order.case_id)
            )
            row = result.one_or_none()
            if row:
                order._patient_name = f"{row[0]} {row[1]}"
        return _to_response(order)

    async def update_order(
        self, order_id: uuid.UUID, data: ManufacturingOrderUpdate
    ) -> ManufacturingOrderResponse:
        order = await self._get_order(order_id)
        for key, val in data.model_dump(exclude_unset=True).items():
            setattr(order, key, val)
        await self.db.commit()
        await self.db.refresh(order)
        return _to_response(order)

    async def list_orders(
        self,
        status: str | None = None,
        search: str | None = None,
        page: int = 1,
        per_page: int = 20,
    ) -> tuple[list[ManufacturingOrderResponse], int]:
        base = (
            select(ManufacturingOrder, Patient.first_name, Patient.last_name)
            .join(Case, Case.id == ManufacturingOrder.case_id)
            .join(Patient, Patient.id == Case.patient_id)
        )

        if status:
            base = base.where(ManufacturingOrder.status == status)
        if search:
            like = f"%{search}%"
            base = base.where(
                ManufacturingOrder.order_number.ilike(like)
                | Patient.first_name.ilike(like)
                | Patient.last_name.ilike(like)
                | Case.case_number.ilike(like)
            )

        # Count
        count_q = select(func.count()).select_from(base.subquery())
        total = (await self.db.execute(count_q)).scalar_one()

        # Fetch page
        offset = (page - 1) * per_page
        rows = (
            await self.db.execute(
                base.order_by(ManufacturingOrder.created_at.desc())
                .offset(offset)
                .limit(per_page)
            )
        ).all()

        orders = []
        for row in rows:
            order = row[0]
            order._patient_name = f"{row[1]} {row[2]}"
            orders.append(_to_response(order))

        return orders, total

    # -- Status transitions ---------------------------------------------------

    async def move_to_in_progress(
        self, order_id: uuid.UUID, user: User
    ) -> ManufacturingOrderResponse:
        order = await self._get_order(order_id)
        if order.status != OrderStatus.NEW.value:
            raise ValueError(f"Order must be NEW to move to in-progress, currently {order.status}")
        order.status = OrderStatus.IN_PROGRESS.value
        order.assigned_to_id = user.id
        order.assigned_at = datetime.now(timezone.utc)
        await self.db.commit()
        await self.db.refresh(order)
        return _to_response(order)

    async def mark_shipped(
        self, order_id: uuid.UUID, data: ShipOrderRequest
    ) -> ManufacturingOrderResponse:
        order = await self._get_order(order_id)
        if order.status != OrderStatus.IN_PROGRESS.value:
            raise ValueError(f"Order must be IN_PROGRESS to ship, currently {order.status}")
        order.status = OrderStatus.SHIPPED.value
        order.tracking_number = data.tracking_number
        order.shipping_carrier = data.shipping_carrier
        order.shipped_at = datetime.now(timezone.utc)
        await self.db.commit()
        await self.db.refresh(order)
        return _to_response(order)

    async def bulk_update_status(
        self, data: BulkStatusUpdate
    ) -> int:
        """Update status of multiple orders. Returns count updated."""
        extra = {}
        if data.target_status == OrderStatus.IN_PROGRESS:
            extra["assigned_at"] = datetime.now(timezone.utc)
        elif data.target_status == OrderStatus.SHIPPED:
            extra["shipped_at"] = datetime.now(timezone.utc)

        result = await self.db.execute(
            update(ManufacturingOrder)
            .where(ManufacturingOrder.id.in_(data.order_ids))
            .values(status=data.target_status.value, **extra)
        )
        await self.db.commit()
        return result.rowcount

    # -- Stats ----------------------------------------------------------------

    async def get_stats(self) -> ManufacturingStatsResponse:
        result = await self.db.execute(
            select(ManufacturingOrder.status, func.count())
            .group_by(ManufacturingOrder.status)
        )
        counts = {row[0]: row[1] for row in result.all()}
        return ManufacturingStatsResponse(
            new=counts.get(OrderStatus.NEW.value, 0),
            in_progress=counts.get(OrderStatus.IN_PROGRESS.value, 0),
            shipped=counts.get(OrderStatus.SHIPPED.value, 0),
        )

    # -- CSV Export ------------------------------------------------------------

    async def export_csv(self, status: str | None = None) -> str:
        orders, _ = await self.list_orders(status=status, page=1, per_page=10000)
        output = io.StringIO()
        writer = csv.writer(output)
        writer.writerow([
            "Order Number", "Status", "Patient Name", "Case Number",
            "Case Type", "Order Type", "Trimline", "Aligner Material",
            "Total Trays", "Upper Aligners", "Lower Aligners",
            "Tracking Number", "Shipping Carrier", "Shipped At",
            "Created At",
        ])
        for o in orders:
            writer.writerow([
                o.order_number, o.status, o.patient_name or "", o.case_number or "",
                o.case_type, o.order_type, o.trimline, o.aligner_material,
                o.total_trays, o.upper_aligner_count, o.lower_aligner_count,
                o.tracking_number or "", o.shipping_carrier or "",
                o.shipped_at.isoformat() if o.shipped_at else "",
                o.created_at.isoformat(),
            ])
        return output.getvalue()

    # -- Auto-create from approved case ---------------------------------------

    async def auto_create_from_case(self, case: Case) -> ManufacturingOrderResponse:
        """Auto-create a manufacturing order when a case is approved."""
        # Try to get treatment plan tray counts
        total_trays = 0
        upper_count = 0
        lower_count = 0
        plan_id = None

        result = await self.db.execute(
            select(TreatmentPlan)
            .where(TreatmentPlan.case_id == case.id)
            .order_by(TreatmentPlan.created_at.desc())
            .limit(1)
        )
        plan = result.scalar_one_or_none()
        if plan:
            plan_id = plan.id
            total_steps = plan.total_steps or 0
            # Estimate: each step = 1 upper + 1 lower tray for BOTH_ARCHES
            if case.treatment_type in ("BOTH_ARCHES", "FULL_ARCH"):
                upper_count = total_steps
                lower_count = total_steps
                total_trays = upper_count + lower_count
            elif case.treatment_type == "UPPER_ONLY":
                upper_count = total_steps
                total_trays = upper_count
            elif case.treatment_type == "LOWER_ONLY":
                lower_count = total_steps
                total_trays = lower_count

        data = ManufacturingOrderCreate(
            case_id=case.id,
            treatment_plan_id=plan_id,
            special_instructions=case.special_instructions,
            total_trays=total_trays,
            upper_aligner_count=upper_count,
            lower_aligner_count=lower_count,
            attachment_template_count=2 if total_trays > 0 else 0,
            attachment_start_stage=1 if total_trays > 0 else None,
        )
        return await self.create_order(data)
