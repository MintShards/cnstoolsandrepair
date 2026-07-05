from typing import Optional

from fastapi import Depends, HTTPException, status, Request
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from app.core.security import decode_access_token
from app.models.auth import User
from app.database import get_database
from app.utils import convert_objectid_to_str

# Name of the httpOnly cookie that carries the JWT (primary auth mechanism).
ACCESS_TOKEN_COOKIE = "access_token"

# HTTP Bearer scheme kept as an OPTIONAL fallback (e.g. API testing / Swagger).
# auto_error=False so a missing header doesn't 401 before we check the cookie.
security = HTTPBearer(auto_error=False)


async def get_current_user(
    request: Request,
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(security),
) -> User:
    """
    Dependency to get the current authenticated user from the JWT.

    The token is read from the httpOnly ``access_token`` cookie first, falling
    back to an ``Authorization: Bearer`` header if present.

    Returns:
        User object if authentication succeeds

    Raises:
        HTTPException: 401 if token is missing/invalid or user not found
    """
    # Prefer the httpOnly cookie; fall back to a bearer header.
    token = request.cookies.get(ACCESS_TOKEN_COOKIE)
    if not token and credentials is not None:
        token = credentials.credentials

    if not token:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Not authenticated",
            headers={"WWW-Authenticate": "Bearer"},
        )

    # Decode JWT token
    payload = decode_access_token(token)
    if payload is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Could not validate credentials",
            headers={"WWW-Authenticate": "Bearer"},
        )

    # Extract email from token payload
    email = payload.get("sub")
    if not email:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Could not validate credentials",
            headers={"WWW-Authenticate": "Bearer"},
        )

    # Fetch user from database
    db = get_database()
    user_doc = await db.users.find_one({"email": email})

    if user_doc is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="User not found",
            headers={"WWW-Authenticate": "Bearer"},
        )

    # Convert ObjectId to string and rename _id to id
    user_doc = convert_objectid_to_str(user_doc)
    user_doc["id"] = user_doc.pop("_id")

    # Check if user is active
    if not user_doc.get("is_active", False):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="User account is disabled"
        )

    # Return User model
    return User(**user_doc)


async def require_admin(current_user: User = Depends(get_current_user)) -> User:
    """
    Dependency to require admin role.

    Args:
        current_user: Current authenticated user from get_current_user dependency

    Returns:
        User object if user is an admin

    Raises:
        HTTPException: 403 if user is not an admin
    """
    if current_user.role != "admin":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Admin access required"
        )

    return current_user
