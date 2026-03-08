# auth.py — Auth route handlers. Thin layer: validate -> service -> respond.

from fastapi import APIRouter, Cookie, Depends, Response
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import get_settings
from app.constants import APP_NAME, REFRESH_TOKEN_EXPIRE_DAYS
from app.database.connection import get_db
from app.middleware.auth_middleware import get_current_user
from app.models.user import User
from app.schemas.auth import (
    ForgotPasswordRequest,
    LoginRequest,
    RegisterRequest,
    ResetPasswordRequest,
    TokenResponse,
    UserResponse,
    VerifyEmailRequest,
)
from app.schemas.common import ApiResponse
from app.services.auth_service import AuthService

router = APIRouter(prefix="/auth", tags=["Authentication"])
settings = get_settings()


@router.post("/register", response_model=ApiResponse[UserResponse])
async def register(
    data: RegisterRequest,
    db: AsyncSession = Depends(get_db),
) -> ApiResponse[UserResponse]:
    """Create a new user account and send verification email."""
    service = AuthService(db)
    user = await service.register(data)
    _token = service.create_verification_token(user)
    # TODO Phase 5: send verification email via SendGrid
    return ApiResponse(
        success=True,
        message="Account created. Please verify your email.",
        data=UserResponse.model_validate(user),
    )


@router.post("/login", response_model=ApiResponse[TokenResponse])
async def login(
    data: LoginRequest,
    response: Response,
    db: AsyncSession = Depends(get_db),
) -> ApiResponse[TokenResponse]:
    """Authenticate user and return tokens."""
    service = AuthService(db)
    user, access_token, refresh_token = await service.login(
        data.email, data.password
    )
    _set_refresh_cookie(response, refresh_token)
    return ApiResponse(
        success=True,
        message="Login successful",
        data=TokenResponse(access_token=access_token),
    )


@router.post("/refresh", response_model=ApiResponse[TokenResponse])
async def refresh_tokens(
    response: Response,
    db: AsyncSession = Depends(get_db),
    refresh_token: str | None = Cookie(None),
) -> ApiResponse[TokenResponse]:
    """Rotate refresh token and return new access token."""
    from app.exceptions import AuthenticationError
    if not refresh_token:
        raise AuthenticationError("Missing refresh token")
    service = AuthService(db)
    new_access, new_refresh = await service.refresh_tokens(refresh_token)
    _set_refresh_cookie(response, new_refresh)
    return ApiResponse(
        success=True,
        message="Token refreshed",
        data=TokenResponse(access_token=new_access),
    )


@router.post("/logout", response_model=ApiResponse[None])
async def logout(response: Response) -> ApiResponse[None]:
    """Clear refresh cookie."""
    response.delete_cookie(
        key="refresh_token",
        httponly=True,
        secure=True,
        samesite="lax",
    )
    return ApiResponse(success=True, message="Logged out successfully")


@router.get("/me", response_model=ApiResponse[UserResponse])
async def get_me(
    current_user: User = Depends(get_current_user),
) -> ApiResponse[UserResponse]:
    """Return current user profile."""
    return ApiResponse(
        success=True,
        message="User profile",
        data=UserResponse.model_validate(current_user),
    )


@router.post("/forgot-password", response_model=ApiResponse[None])
async def forgot_password(
    data: ForgotPasswordRequest,
    db: AsyncSession = Depends(get_db),
) -> ApiResponse[None]:
    """Send a password reset email."""
    service = AuthService(db)
    _token = await service.request_password_reset(data.email)
    # TODO Phase 5: send reset email via SendGrid
    return ApiResponse(
        success=True,
        message="If that email exists, a reset link has been sent.",
    )


@router.post("/reset-password", response_model=ApiResponse[None])
async def reset_password(
    data: ResetPasswordRequest,
    db: AsyncSession = Depends(get_db),
) -> ApiResponse[None]:
    """Reset password using a valid token."""
    service = AuthService(db)
    await service.reset_password(data.token, data.new_password)
    return ApiResponse(
        success=True,
        message="Password reset successful",
    )


@router.post("/verify-email", response_model=ApiResponse[None])
async def verify_email(
    data: VerifyEmailRequest,
    db: AsyncSession = Depends(get_db),
) -> ApiResponse[None]:
    """Verify user email with token."""
    service = AuthService(db)
    await service.verify_email(data.token)
    return ApiResponse(
        success=True,
        message="Email verified successfully",
    )


# -- Private helpers -------------------------------------------------------

def _set_refresh_cookie(response: Response, token: str) -> None:
    """Set httponly secure cookie for refresh token."""
    response.set_cookie(
        key="refresh_token",
        value=token,
        httponly=True,
        secure=True,
        samesite="lax",
        max_age=REFRESH_TOKEN_EXPIRE_DAYS * 24 * 60 * 60,
        path="/api/v1/auth",
    )


