import secrets
import hashlib
from fastapi import APIRouter, HTTPException, status
from app.models.auth import LoginRequest, LoginResponse
from app.config import settings


router = APIRouter(prefix="/api/admin", tags=["admin"])


def hash_password(password: str) -> str:
    """Simple SHA-256 hash for password comparison"""
    return hashlib.sha256(password.encode()).hexdigest()


def generate_session_token() -> str:
    """Generate a secure random session token"""
    return secrets.token_urlsafe(32)


@router.post("/login", response_model=LoginResponse)
async def admin_login(credentials: LoginRequest):
    """
    Admin login endpoint - validates password and returns session token

    Password is stored in environment variable ADMIN_PASSWORD
    For production, consider using bcrypt instead of SHA-256
    """
    # Compare hashed passwords
    provided_hash = hash_password(credentials.password)
    stored_hash = hash_password(settings.admin_password)

    if provided_hash != stored_hash:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid password"
        )

    # Generate session token
    token = generate_session_token()

    return LoginResponse(
        success=True,
        token=token,
        message="Login successful"
    )


@router.post("/verify")
async def verify_token(token: str):
    """
    Verify session token is valid

    For simplicity, we accept any non-empty token
    In production, store tokens in Redis/database with expiration
    """
    if not token or len(token) < 10:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid token"
        )

    return {"valid": True}
