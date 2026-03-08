# exceptions.py — Custom exception hierarchy for the entire backend.
# All business logic errors use these — never bare except.

from fastapi import status


class AppException(Exception):
    """Base exception for all application errors."""

    def __init__(
        self,
        message: str,
        status_code: int = status.HTTP_500_INTERNAL_SERVER_ERROR,
        detail: str | None = None,
    ) -> None:
        self.message = message
        self.status_code = status_code
        self.detail = detail or message
        super().__init__(self.message)


class AuthenticationError(AppException):
    """Raised when authentication fails."""

    def __init__(self, message: str = "Authentication failed") -> None:
        super().__init__(message, status.HTTP_401_UNAUTHORIZED)


class AuthorizationError(AppException):
    """Raised when user lacks permission."""

    def __init__(self, message: str = "Insufficient permissions") -> None:
        super().__init__(message, status.HTTP_403_FORBIDDEN)


class NotFoundError(AppException):
    """Raised when a resource is not found."""

    def __init__(self, resource: str = "Resource") -> None:
        super().__init__(f"{resource} not found", status.HTTP_404_NOT_FOUND)


class ConflictError(AppException):
    """Raised when a resource already exists."""

    def __init__(self, message: str = "Resource already exists") -> None:
        super().__init__(message, status.HTTP_409_CONFLICT)


class ValidationError(AppException):
    """Raised when input validation fails."""

    def __init__(self, message: str = "Validation failed") -> None:
        super().__init__(message, status.HTTP_422_UNPROCESSABLE_ENTITY)


class RateLimitError(AppException):
    """Raised when rate limit is exceeded."""

    def __init__(self, message: str = "Too many requests") -> None:
        super().__init__(message, status.HTTP_429_TOO_MANY_REQUESTS)


class BadRequestError(AppException):
    """Raised for general bad request errors."""

    def __init__(self, message: str = "Bad request") -> None:
        super().__init__(message, status.HTTP_400_BAD_REQUEST)


class FileUploadError(AppException):
    """Raised when file upload fails."""

    def __init__(self, message: str = "File upload failed") -> None:
        super().__init__(message, status.HTTP_400_BAD_REQUEST)


class PaymentError(AppException):
    """Raised when a payment operation fails."""

    def __init__(self, message: str = "Payment processing failed") -> None:
        super().__init__(message, status.HTTP_402_PAYMENT_REQUIRED)
