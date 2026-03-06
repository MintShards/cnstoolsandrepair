from fastapi import APIRouter, HTTPException, status, Depends

from app.models.auth import LoginRequest, LoginResponse, User
from app.core.security import verify_password, create_access_token
from app.database import get_database
from app.dependencies.auth import get_current_user

router = APIRouter(prefix="/api/auth", tags=["authentication"])


@router.post("/login", response_model=LoginResponse)
async def login(credentials: LoginRequest):
    """
    User login endpoint - validates email and password, returns JWT token.

    Args:
        credentials: LoginRequest with email and password

    Returns:
        LoginResponse with JWT access token

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

    return LoginResponse(access_token=access_token)


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
