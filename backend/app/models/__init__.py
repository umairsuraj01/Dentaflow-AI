# models/__init__.py
# Exports all models. Alembic requires ALL models imported here for autogenerate.

from app.models.user import User
from app.models.audit import AuditLog
from app.models.patient import Patient
from app.models.case import Case
from app.models.case_file import CaseFile
from app.models.case_note import CaseNote
from app.models.tooth_instruction import ToothInstruction
from app.models.segmentation_result import SegmentationResult
from app.models.correction import Correction

__all__ = [
    "User",
    "AuditLog",
    "Patient",
    "Case",
    "CaseFile",
    "CaseNote",
    "ToothInstruction",
    "SegmentationResult",
    "Correction",
]
