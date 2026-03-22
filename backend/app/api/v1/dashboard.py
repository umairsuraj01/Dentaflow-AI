# dashboard.py — Dashboard statistics route handler.

from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.constants import CaseStatus
from app.database.connection import get_db
from app.middleware.auth_middleware import get_current_user
from app.models.user import User
from app.schemas.case import DashboardStats
from app.schemas.common import ApiResponse
from app.services.case_service import CaseService

router = APIRouter(prefix="/dashboard", tags=["Dashboard"])


@router.get("/stats", response_model=ApiResponse[DashboardStats])
async def get_stats(
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> ApiResponse[DashboardStats]:
    """Get role-based dashboard statistics."""
    service = CaseService(db)
    counts = await service.get_dashboard_stats(user)
    active = sum(
        counts.get(s, 0) for s in [
            CaseStatus.DRAFT.value, CaseStatus.SUBMITTED.value,
            CaseStatus.ASSIGNED.value, CaseStatus.IN_PROGRESS.value,
        ]
    )
    review = sum(
        counts.get(s, 0) for s in [
            CaseStatus.REVIEW.value, CaseStatus.REVISION_REQUESTED.value,
        ]
    )
    completed = sum(
        counts.get(s, 0) for s in [
            CaseStatus.APPROVED.value, CaseStatus.COMPLETED.value,
        ]
    )
    total_cases = sum(counts.values())
    return ApiResponse(
        success=True, message="Stats retrieved",
        data=DashboardStats(
            active_cases=active,
            pending_review=review,
            completed=completed,
            total_revenue=total_cases * 35.0,
        ),
    )
