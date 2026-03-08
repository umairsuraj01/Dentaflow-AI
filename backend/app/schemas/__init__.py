# schemas/__init__.py — Re-exports all Pydantic schemas.
from app.schemas.common import ApiResponse, PaginatedResponse
from app.schemas.auth import (
    LoginRequest, RegisterRequest, TokenResponse, UserResponse,
    ForgotPasswordRequest, ResetPasswordRequest, VerifyEmailRequest,
)
from app.schemas.patient import PatientCreate, PatientUpdate, PatientResponse
from app.schemas.case import (
    CaseCreate, CaseUpdate, CaseAssign, CaseResponse,
    CaseFileResponse, CaseNoteCreate, CaseNoteResponse,
    UploadUrlRequest, UploadUrlResponse, UploadConfirm, DashboardStats,
)
from app.schemas.tooth_instruction import (
    ToothInstructionCreate, ToothInstructionUpdate,
    ToothInstructionResponse, ToothInstructionSummary,
)

__all__ = [
    "ApiResponse", "PaginatedResponse",
    "LoginRequest", "RegisterRequest", "TokenResponse", "UserResponse",
    "ForgotPasswordRequest", "ResetPasswordRequest", "VerifyEmailRequest",
    "PatientCreate", "PatientUpdate", "PatientResponse",
    "CaseCreate", "CaseUpdate", "CaseAssign", "CaseResponse",
    "CaseFileResponse", "CaseNoteCreate", "CaseNoteResponse",
    "UploadUrlRequest", "UploadUrlResponse", "UploadConfirm", "DashboardStats",
    "ToothInstructionCreate", "ToothInstructionUpdate",
    "ToothInstructionResponse", "ToothInstructionSummary",
]
