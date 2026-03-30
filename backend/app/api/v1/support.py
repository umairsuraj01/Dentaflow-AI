# support.py — Support ticket API endpoints.

import uuid
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, Field
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database.connection import get_db
from app.middleware.auth_middleware import get_current_user
from app.models.support_ticket import SupportTicket, TicketComment
from app.models.user import User

router = APIRouter(prefix="/support", tags=["Support"])


class TicketCreate(BaseModel):
    subject: str = Field(..., min_length=1, max_length=255)
    description: str = Field(..., min_length=1)
    priority: str = "MEDIUM"
    category: str = "TECHNICAL"

class CommentCreate(BaseModel):
    message: str = Field(..., min_length=1)
    attachment_url: str | None = None


async def _next_ticket_number(db: AsyncSession) -> str:
    year = datetime.now(timezone.utc).year
    prefix = f"TKT-{year}-"
    result = await db.execute(
        select(func.count()).select_from(SupportTicket)
        .where(SupportTicket.ticket_number.startswith(prefix))
    )
    count = result.scalar_one() + 1
    return f"{prefix}{count:06d}"


@router.post("/tickets", response_model=dict, status_code=201)
async def create_ticket(
    data: TicketCreate,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    ticket = SupportTicket(
        id=uuid.uuid4(),
        org_id=user.org_id,
        user_id=user.id,
        ticket_number=await _next_ticket_number(db),
        subject=data.subject,
        description=data.description,
        priority=data.priority,
        category=data.category,
    )
    db.add(ticket)
    await db.commit()
    await db.refresh(ticket)
    return {"success": True, "data": _ticket_dict(ticket)}


@router.get("/tickets", response_model=dict)
async def list_tickets(
    status: str | None = Query(None),
    page: int = Query(1, ge=1),
    per_page: int = Query(20, ge=1, le=100),
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    q = select(SupportTicket).where(SupportTicket.user_id == user.id)
    if user.role in ("SUPER_ADMIN", "LAB_MANAGER"):
        q = select(SupportTicket)
    if status:
        q = q.where(SupportTicket.status == status)

    count_q = select(func.count()).select_from(q.subquery())
    total = (await db.execute(count_q)).scalar_one()

    rows = (await db.execute(
        q.order_by(SupportTicket.created_at.desc())
        .offset((page - 1) * per_page).limit(per_page)
    )).scalars().all()

    return {
        "success": True,
        "data": {
            "items": [_ticket_dict(t) for t in rows],
            "total": total,
            "page": page,
            "per_page": per_page,
            "total_pages": (total + per_page - 1) // per_page,
        },
    }


@router.get("/tickets/{ticket_id}", response_model=dict)
async def get_ticket(
    ticket_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    result = await db.execute(select(SupportTicket).where(SupportTicket.id == ticket_id))
    ticket = result.scalar_one_or_none()
    if not ticket:
        raise HTTPException(404, "Ticket not found")
    data = _ticket_dict(ticket)
    data["comments"] = [
        {
            "id": str(c.id), "message": c.message, "attachment_url": c.attachment_url,
            "is_staff_reply": c.is_staff_reply, "created_at": c.created_at.isoformat(),
            "author_name": c.user.full_name if c.user else "Unknown",
        }
        for c in ticket.comments
    ]
    return {"success": True, "data": data}


@router.post("/tickets/{ticket_id}/comments", response_model=dict, status_code=201)
async def add_comment(
    ticket_id: uuid.UUID,
    data: CommentCreate,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    result = await db.execute(select(SupportTicket).where(SupportTicket.id == ticket_id))
    ticket = result.scalar_one_or_none()
    if not ticket:
        raise HTTPException(404, "Ticket not found")

    is_staff = user.role in ("SUPER_ADMIN", "LAB_MANAGER", "TECHNICIAN")
    comment = TicketComment(
        id=uuid.uuid4(),
        ticket_id=ticket_id,
        user_id=user.id,
        message=data.message,
        attachment_url=data.attachment_url,
        is_staff_reply=is_staff,
    )
    db.add(comment)
    if is_staff and ticket.status == "OPEN":
        ticket.status = "IN_PROGRESS"
    await db.commit()
    return {"success": True, "data": {"id": str(comment.id)}}


@router.put("/tickets/{ticket_id}/status", response_model=dict)
async def update_status(
    ticket_id: uuid.UUID,
    status: str = Query(...),
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    result = await db.execute(select(SupportTicket).where(SupportTicket.id == ticket_id))
    ticket = result.scalar_one_or_none()
    if not ticket:
        raise HTTPException(404, "Ticket not found")
    ticket.status = status
    await db.commit()
    return {"success": True, "data": _ticket_dict(ticket)}


def _ticket_dict(t: SupportTicket) -> dict:
    return {
        "id": str(t.id), "ticket_number": t.ticket_number, "subject": t.subject,
        "description": t.description, "status": t.status, "priority": t.priority,
        "category": t.category, "created_at": t.created_at.isoformat(),
        "updated_at": t.updated_at.isoformat(),
        "user_name": t.user.full_name if t.user else "Unknown",
    }
