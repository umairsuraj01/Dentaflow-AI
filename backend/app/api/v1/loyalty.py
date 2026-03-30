# loyalty.py — Loyalty points API endpoints.

from fastapi import APIRouter, Depends, Query
from sqlalchemy import select, func as sa_func
from sqlalchemy.ext.asyncio import AsyncSession

from app.database.connection import get_db
from app.middleware.auth_middleware import get_current_user
from app.models.loyalty import LoyaltyAccount, LoyaltyTransaction
from app.models.user import User

router = APIRouter(prefix="/loyalty", tags=["Loyalty"])


@router.get("", response_model=dict)
async def get_loyalty_account(
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """Get user's loyalty account summary."""
    result = await db.execute(
        select(LoyaltyAccount).where(LoyaltyAccount.user_id == user.id)
    )
    account = result.scalar_one_or_none()
    if not account:
        return {"success": True, "data": {"total_points": 0, "availed_points": 0, "remaining_points": 0}}
    return {"success": True, "data": {
        "id": str(account.id),
        "total_points": account.total_points,
        "availed_points": account.availed_points,
        "remaining_points": account.remaining_points,
    }}


@router.get("/transactions", response_model=dict)
async def list_transactions(
    type: str | None = Query(None),
    page: int = Query(1, ge=1),
    per_page: int = Query(20, ge=1, le=100),
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """List loyalty transactions."""
    # Get account
    result = await db.execute(
        select(LoyaltyAccount).where(LoyaltyAccount.user_id == user.id)
    )
    account = result.scalar_one_or_none()
    if not account:
        return {"success": True, "data": {"items": [], "total": 0, "page": 1, "per_page": per_page, "total_pages": 0}}

    q = select(LoyaltyTransaction).where(LoyaltyTransaction.account_id == account.id)
    if type:
        q = q.where(LoyaltyTransaction.type == type)

    count_q = select(sa_func.count()).select_from(q.subquery())
    total = (await db.execute(count_q)).scalar_one()

    rows = (await db.execute(
        q.order_by(LoyaltyTransaction.created_at.desc())
        .offset((page - 1) * per_page).limit(per_page)
    )).scalars().all()

    return {"success": True, "data": {
        "items": [{
            "id": str(t.id), "points": t.points, "type": t.type,
            "description": t.description, "created_at": t.created_at.isoformat(),
        } for t in rows],
        "total": total, "page": page, "per_page": per_page,
        "total_pages": (total + per_page - 1) // per_page,
    }}
