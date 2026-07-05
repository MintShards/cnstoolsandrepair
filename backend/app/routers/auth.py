from fastapi import APIRouter, HTTPException, status, Depends, Request, Response
from slowapi import Limiter
from slowapi.util import get_remote_address

from app.models.auth import LoginRequest, LoginResponse, User
from app.core.security import verify_password, create_access_token
from app.database import get_database
from app.dependencies.auth import get_current_user, ACCESS_TOKEN_COOKIE
from app.config import settings

router = APIRouter(prefix="/api/auth", tags=["authentication"])
limiter = Limiter(key_func=get_remote_address)


def _set_auth_cookie(response: Response, token: str) -> None:
    """Set the JWT as an httpOnly cookie. Secure is enabled in production (HTTPS);
    SameSite=Strict provides CSRF protection for the same-origin admin panel."""
    response.set_cookie(
        key=ACCESS_TOKEN_COOKIE,
        value=token,
        httponly=True,
        secure=settings.environment == "production",
        samesite="strict",
        max_age=settings.jwt_expiration_hours * 3600,
        path="/",
    )


def _clear_auth_cookie(response: Response) -> None:
    """Clear the JWT cookie. Attributes must match those used when setting it."""
    response.delete_cookie(
        key=ACCESS_TOKEN_COOKIE,
        path="/",
        httponly=True,
        secure=settings.environment == "production",
        samesite="strict",
    )


@router.post("/login", response_model=LoginResponse)
@limiter.limit("5/minute;30/hour")
async def login(request: Request, response: Response, credentials: LoginRequest):
    """
    Admin login - validates email/password and sets the JWT as an httpOnly cookie.

    Args:
        credentials: LoginRequest with email and password

    Returns:
        LoginResponse confirming success (the JWT is in the httpOnly cookie)

    Raises:
        HTTPException: 401 if credentials are invalid
    """
    db = get_database()

    # Find user by email
    user = await db.users.find_one({"email": credentials.email})
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid email or password"
        )

    # Verify password
    if not verify_password(credentials.password, user["password_hash"]):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid email or password"
        )

    # Check if user is active
    if not user.get("is_active", False):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="User account is disabled"
        )

    # Create JWT token with user email and role
    access_token = create_access_token(
        data={"sub": user["email"], "role": user["role"]}
    )

    _set_auth_cookie(response, access_token)
    return LoginResponse(success=True, role=user["role"])


@router.post("/logout")
async def logout(response: Response):
    """Log out by clearing the JWT cookie."""
    _clear_auth_cookie(response)
    return {"success": True}


@router.get("/me", response_model=User)
async def get_me(current_user: User = Depends(get_current_user)):
    """
    Get current authenticated user information.

    Args:
        current_user: Current user from JWT token (dependency)

    Returns:
        User object with current user information
    """
    return current_user
