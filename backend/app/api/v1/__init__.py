# v1/__init__.py — Mounts all v1 API routers under /api/v1.

from fastapi import APIRouter

from app.api.v1.auth import router as auth_router
from app.api.v1.patients import router as patients_router
from app.api.v1.cases import router as cases_router
from app.api.v1.tooth_instructions import router as tooth_instructions_router
from app.api.v1.dashboard import router as dashboard_router
from app.api.v1.websocket import router as ws_router
from app.api.v1.segmentation import router as segmentation_router
from app.api.v1.treatment_plans import router as treatment_plans_router
from app.api.v1.analysis import router as analysis_router
from app.api.v1.billing import router as billing_router
from app.api.v1.notifications import router as notifications_router
from app.api.v1.admin import router as admin_api_router
from app.api.v1.manufacturing import router as manufacturing_router
from app.api.v1.organizations import router as organizations_router
from app.api.v1.clinical_preferences import router as clinical_prefs_router
from app.api.v1.support import router as support_router
from app.api.v1.loyalty import router as loyalty_router

api_router = APIRouter(prefix="/api/v1")
api_router.include_router(auth_router)
api_router.include_router(patients_router)
api_router.include_router(cases_router)
api_router.include_router(tooth_instructions_router)
api_router.include_router(dashboard_router)
api_router.include_router(ws_router)
api_router.include_router(segmentation_router)
api_router.include_router(treatment_plans_router)
api_router.include_router(analysis_router)
api_router.include_router(billing_router)
api_router.include_router(notifications_router)
api_router.include_router(admin_api_router)
api_router.include_router(manufacturing_router)
api_router.include_router(organizations_router)
api_router.include_router(clinical_prefs_router)
api_router.include_router(support_router)
api_router.include_router(loyalty_router)
