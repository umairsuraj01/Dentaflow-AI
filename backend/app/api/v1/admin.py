# admin.py — Admin user management endpoints (SUPER_ADMIN only).

import uuid

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database.connection import get_db
from app.middleware.auth_middleware import get_current_user
from app.models.user import User
from app.schemas.common import ApiResponse

router = APIRouter(prefix="/admin", tags=["Admin"])


def _require_admin(user: User) -> None:
    if user.role != "SUPER_ADMIN":
        raise HTTPException(status_code=403, detail="Admin access required")


def _user_dict(user: User) -> dict:
    return {
        "id": str(user.id),
        "email": user.email,
        "full_name": user.full_name,
        "role": user.role,
        "is_active": user.is_active,
        "is_verified": user.is_verified,
        "clinic_name": user.clinic_name,
        "specialization": user.specialization,
        "experience_years": user.experience_years,
        "country": user.country,
        "created_at": user.created_at.isoformat() if user.created_at else None,
        "last_login_at": user.last_login_at.isoformat() if user.last_login_at else None,
    }


@router.get("/users")
async def list_users(
    search: str = "",
    role: str | None = None,
    page: int = Query(1, ge=1),
    per_page: int = Query(20, ge=1, le=100),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """List all users with search and role filter."""
    _require_admin(current_user)
    query = select(User).where(User.is_deleted == False)
    count_query = select(func.count()).select_from(User).where(User.is_deleted == False)

    if search:
        sf = or_(
            User.full_name.ilike(f"%{search}%"),
            User.email.ilike(f"%{search}%"),
            User.clinic_name.ilike(f"%{search}%"),
        )
        query = query.where(sf)
        count_query = count_query.where(sf)
    if role:
        query = query.where(User.role == role)
        count_query = count_query.where(User.role == role)

    total = (await db.execute(count_query)).scalar() or 0
    users = (
        await db.execute(
            query.order_by(User.created_at.desc())
            .offset((page - 1) * per_page)
            .limit(per_page)
        )
    ).scalars().all()

    return ApiResponse(
        success=True,
        message="Users list",
        data={
            "items": [_user_dict(u) for u in users],
            "total": total,
            "page": page,
            "per_page": per_page,
            "total_pages": (total + per_page - 1) // per_page,
        },
    )


@router.put("/users/{user_id}/role")
async def update_user_role(
    user_id: str,
    role: str = Query(...),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Change a user's role."""
    _require_admin(current_user)
    user = await db.get(User, uuid.UUID(user_id))
    if not user:
        raise HTTPException(404, "User not found")
    if str(user.id) == str(current_user.id):
        raise HTTPException(400, "Cannot change your own role")
    valid = ["SUPER_ADMIN", "DENTIST", "TECHNICIAN", "LAB_MANAGER"]
    if role not in valid:
        raise HTTPException(400, f"Invalid role. Must be one of: {valid}")
    user.role = role
    db.add(user)
    await db.flush()
    return ApiResponse(success=True, message=f"Role updated to {role}", data=_user_dict(user))


@router.put("/users/{user_id}/status")
async def toggle_user_status(
    user_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Toggle user active/inactive."""
    _require_admin(current_user)
    user = await db.get(User, uuid.UUID(user_id))
    if not user:
        raise HTTPException(404, "User not found")
    if str(user.id) == str(current_user.id):
        raise HTTPException(400, "Cannot deactivate yourself")
    user.is_active = not user.is_active
    db.add(user)
    await db.flush()
    status = "activated" if user.is_active else "deactivated"
    return ApiResponse(success=True, message=f"User {status}", data=_user_dict(user))


@router.delete("/users/{user_id}")
async def delete_user(
    user_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Soft delete a user."""
    _require_admin(current_user)
    user = await db.get(User, uuid.UUID(user_id))
    if not user:
        raise HTTPException(404, "User not found")
    if str(user.id) == str(current_user.id):
        raise HTTPException(400, "Cannot delete yourself")
    user.is_deleted = True
    user.is_active = False
    db.add(user)
    await db.flush()
    return ApiResponse(success=True, message="User deleted")
