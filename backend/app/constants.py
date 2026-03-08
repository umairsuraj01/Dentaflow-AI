# constants.py — Single source of truth. Every constant lives here.
# Change APP_NAME in one place -> updates everywhere in backend.

from enum import Enum


# -- App Identity --------------------------------------------------------
APP_NAME = "DentaFlow AI"
APP_TAGLINE = "AI-Powered Dental Treatment Planning"
APP_VERSION = "1.0.0"
APP_DOMAIN = "dentaflow.ai"
APP_SUPPORT_EMAIL = f"support@{APP_DOMAIN}"
APP_FROM_EMAIL = f"noreply@{APP_DOMAIN}"
APP_FROM_NAME = APP_NAME
APP_CASE_PREFIX = "DF"
APP_INVOICE_PREFIX = "INV"

# -- Auth ----------------------------------------------------------------
ACCESS_TOKEN_EXPIRE_MINUTES = 15
REFRESH_TOKEN_EXPIRE_DAYS = 7
BCRYPT_ROUNDS = 12
MAX_LOGIN_ATTEMPTS = 5
LOCKOUT_MINUTES = 15
MIN_PASSWORD_LENGTH = 8
PASSWORD_REGEX = r"^(?=.*[A-Z])(?=.*[0-9])(?=.*[!@#$%^&*]).{8,}$"

# -- File Limits (bytes) -------------------------------------------------
MAX_SCAN_FILE_BYTES = 500 * 1024 * 1024
MAX_DICOM_FILE_BYTES = 200 * 1024 * 1024
MAX_IMAGE_FILE_BYTES = 50 * 1024 * 1024
MAX_PDF_FILE_BYTES = 50 * 1024 * 1024
PRESIGNED_URL_EXPIRY_S = 900
ALLOWED_SCAN_FORMATS = frozenset({"stl", "obj", "ply"})
ALLOWED_IMAGE_FORMATS = frozenset({"jpg", "jpeg", "png", "tiff"})

# -- AI Pipeline ----------------------------------------------------------
AI_POINT_CLOUD_SIZE = 10_000
AI_BATCH_SIZE = 4
AI_NUM_CLASSES = 33
AI_CONFIDENCE_HIGH = 0.90
AI_CONFIDENCE_MEDIUM = 0.70

# -- Pricing (USD) --------------------------------------------------------
PRICE_NORMAL_USD = 35.00
PRICE_URGENT_USD = 55.00
PRICE_RUSH_USD = 80.00
TURNAROUND_NORMAL_DAYS = 3
TURNAROUND_URGENT_DAYS = 1
TURNAROUND_RUSH_DAYS = 0

# -- Subscriptions --------------------------------------------------------
PLAN_STARTER_MONTHLY = 199.00
PLAN_STARTER_CASES = 10
PLAN_STARTER_OVERAGE = 30.00
PLAN_PRO_MONTHLY = 399.00
PLAN_PRO_CASES = 25
PLAN_PRO_OVERAGE = 25.00
PLAN_ENTERPRISE_MONTHLY = 799.00
PLAN_ENTERPRISE_CASES = 75
PLAN_ENTERPRISE_OVERAGE = 20.00


# -- Enums ----------------------------------------------------------------
class UserRole(str, Enum):
    """User permission roles."""

    SUPER_ADMIN = "SUPER_ADMIN"
    DENTIST = "DENTIST"
    TECHNICIAN = "TECHNICIAN"
    LAB_MANAGER = "LAB_MANAGER"


class CaseStatus(str, Enum):
    """Lifecycle stages of a dental case."""

    DRAFT = "DRAFT"
    SUBMITTED = "SUBMITTED"
    ASSIGNED = "ASSIGNED"
    IN_PROGRESS = "IN_PROGRESS"
    REVIEW = "REVIEW"
    REVISION_REQUESTED = "REVISION_REQUESTED"
    APPROVED = "APPROVED"
    COMPLETED = "COMPLETED"
    CANCELLED = "CANCELLED"


class CasePriority(str, Enum):
    """Urgency levels for cases."""

    NORMAL = "NORMAL"
    URGENT = "URGENT"
    RUSH = "RUSH"


class TreatmentType(str, Enum):
    """Type of dental treatment arch coverage."""

    FULL_ARCH = "FULL_ARCH"
    UPPER_ONLY = "UPPER_ONLY"
    LOWER_ONLY = "LOWER_ONLY"
    BOTH_ARCHES = "BOTH_ARCHES"


class FileType(str, Enum):
    """Categories for uploaded case files."""

    UPPER_SCAN = "UPPER_SCAN"
    LOWER_SCAN = "LOWER_SCAN"
    BITE_SCAN = "BITE_SCAN"
    PHOTO = "PHOTO"
    XRAY = "XRAY"
    TREATMENT_PLAN = "TREATMENT_PLAN"
    ALIGNER_FILES = "ALIGNER_FILES"
    REPORT = "REPORT"
    OTHER = "OTHER"


class UploadStatus(str, Enum):
    """Status of a file upload."""

    UPLOADING = "UPLOADING"
    PROCESSING = "PROCESSING"
    READY = "READY"
    FAILED = "FAILED"


class NoteType(str, Enum):
    """Types of case notes."""

    GENERAL = "GENERAL"
    REVISION_REQUEST = "REVISION_REQUEST"
    APPROVAL = "APPROVAL"
    SYSTEM = "SYSTEM"


class ToothInstructionType(str, Enum):
    """Clinical instruction types for individual teeth."""

    CROWN_DO_NOT_MOVE = "CROWN_DO_NOT_MOVE"
    IMPLANT = "IMPLANT"
    BRIDGE_ANCHOR = "BRIDGE_ANCHOR"
    BRIDGE_PONTIC = "BRIDGE_PONTIC"
    EXTRACTION_PLANNED = "EXTRACTION_PLANNED"
    RECENTLY_EXTRACTED = "RECENTLY_EXTRACTED"
    AVOID_TIPPING = "AVOID_TIPPING"
    AVOID_ROTATION = "AVOID_ROTATION"
    LIMIT_MOVEMENT_MM = "LIMIT_MOVEMENT_MM"
    SENSITIVE_ROOT = "SENSITIVE_ROOT"
    ANKYLOSIS_SUSPECTED = "ANKYLOSIS_SUSPECTED"
    CUSTOM_NOTE = "CUSTOM_NOTE"


class InstructionSeverity(str, Enum):
    """How strictly an instruction must be respected."""

    MUST_RESPECT = "MUST_RESPECT"
    PREFER = "PREFER"
    INFO_ONLY = "INFO_ONLY"


class InvoiceStatus(str, Enum):
    """Invoice lifecycle states."""

    DRAFT = "DRAFT"
    SENT = "SENT"
    PAID = "PAID"
    OVERDUE = "OVERDUE"
    CANCELLED = "CANCELLED"
    REFUNDED = "REFUNDED"


class NotificationType(str, Enum):
    """Types of in-app notifications."""

    CASE_SUBMITTED = "CASE_SUBMITTED"
    CASE_ASSIGNED = "CASE_ASSIGNED"
    CASE_IN_PROGRESS = "CASE_IN_PROGRESS"
    CASE_REVIEW_READY = "CASE_REVIEW_READY"
    REVISION_REQUESTED = "REVISION_REQUESTED"
    CASE_COMPLETED = "CASE_COMPLETED"
    INVOICE_CREATED = "INVOICE_CREATED"
    PAYMENT_RECEIVED = "PAYMENT_RECEIVED"
    PAYMENT_OVERDUE = "PAYMENT_OVERDUE"
    AI_PROCESSING_COMPLETE = "AI_PROCESSING_COMPLETE"
    SYSTEM_ANNOUNCEMENT = "SYSTEM_ANNOUNCEMENT"


class AIStagingState(str, Enum):
    """AI segmentation pipeline stages."""

    PENDING = "PENDING"
    DOWNLOADING = "DOWNLOADING"
    PREPROCESSING = "PREPROCESSING"
    RUNNING_AI = "RUNNING_AI"
    POSTPROCESSING = "POSTPROCESSING"
    SAVING = "SAVING"
    SUCCESS = "SUCCESS"
    FAILED = "FAILED"


class CorrectionType(str, Enum):
    """Types of manual corrections to AI segmentation."""

    LABEL_FIX = "LABEL_FIX"
    BOUNDARY_FIX = "BOUNDARY_FIX"
    MISSING_TOOTH = "MISSING_TOOTH"
    EXTRA_SEGMENT = "EXTRA_SEGMENT"


class TreatmentPlanStatus(str, Enum):
    """Lifecycle stages of a treatment plan."""

    DRAFT = "DRAFT"
    SUBMITTED = "SUBMITTED"
    APPROVED = "APPROVED"
    REJECTED = "REJECTED"
