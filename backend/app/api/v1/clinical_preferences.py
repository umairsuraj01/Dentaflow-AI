# clinical_preferences.py — API endpoints for clinical preference settings.

from fastapi import APIRouter, Depends
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database.connection import get_db
from app.middleware.auth_middleware import get_current_user
from app.models.clinical_preferences import ClinicalPreferences
from app.models.user import User

router = APIRouter(prefix="/clinical-preferences", tags=["Clinical Preferences"])


class ClinicalPreferencesSchema(BaseModel):
    tooth_numbering_system: str = "FDI"
    tooth_size_discrepancy: str | None = None
    default_ipr_preference: str | None = None
    ipr_limit_per_contact: float = 0.5
    arch_expansion: str | None = None
    default_proclination: str | None = None
    default_extraction: str | None = None
    occlusal_contacts: str | None = None
    attachment_schedule: str | None = None
    extraction_schedule: str | None = None
    movement_velocity: str = "STANDARD"
    pontics_for_open_spaces: str | None = None
    virtual_power_chain: str | None = None
    passive_aligners_default: str | None = None
    terminal_molar_distortion: str | None = None
    overcorrection: str | None = None
    default_midline: str | None = None

    model_config = {"from_attributes": True}


@router.get("", response_model=dict)
async def get_preferences(
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """Get current user's clinical preferences."""
    result = await db.execute(
        select(ClinicalPreferences).where(ClinicalPreferences.user_id == user.id)
    )
    prefs = result.scalar_one_or_none()
    if not prefs:
        return {"success": True, "data": ClinicalPreferencesSchema().model_dump()}
    return {"success": True, "data": ClinicalPreferencesSchema.model_validate(prefs).model_dump()}


@router.put("", response_model=dict)
async def update_preferences(
    data: ClinicalPreferencesSchema,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """Create or update clinical preferences."""
    result = await db.execute(
        select(ClinicalPreferences).where(ClinicalPreferences.user_id == user.id)
    )
    prefs = result.scalar_one_or_none()

    if prefs:
        for key, val in data.model_dump().items():
            setattr(prefs, key, val)
    else:
        prefs = ClinicalPreferences(
            user_id=user.id,
            org_id=user.org_id,
            **data.model_dump(),
        )
        db.add(prefs)

    await db.commit()
    await db.refresh(prefs)
    return {"success": True, "data": ClinicalPreferencesSchema.model_validate(prefs).model_dump()}
