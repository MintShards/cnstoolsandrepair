import logging
from datetime import datetime
from typing import List

from bson import ObjectId
from fastapi import APIRouter, HTTPException, status, Depends, Request, Response
from slowapi import Limiter
from slowapi.util import get_remote_address

from app.models.auth import LoginRequest, LoginResponse, User, SalesRepCreate, SalesRepUpdate, SalesRepResponse
from app.core.security import verify_password, create_access_token, hash_password
from app.database import get_database
from app.dependencies.auth import get_current_user, require_admin, ACCESS_TOKEN_COOKIE
from app.config import settings
from app.utils import convert_objectid_to_str

logger = logging.getLogger(__name__)

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


# ---------------------------------------------------------------------------
# Sales Rep CRUD (admin only)
# ---------------------------------------------------------------------------

def _build_sales_rep_response(doc: dict, total_visits: int = 0, total_routes: int = 0) -> SalesRepResponse:
    return SalesRepResponse(
        id=doc["id"],
        first_name=doc.get("first_name"),
        last_name=doc.get("last_name"),
        email=doc["email"],
        is_active=doc.get("is_active", True),
        created_at=doc["created_at"],
        total_visits=total_visits,
        total_routes=total_routes,
    )


@router.get("/sales-reps", response_model=List[SalesRepResponse])
async def list_sales_reps(current_user: User = Depends(require_admin)):
    """List all sales rep accounts with visit/route stats."""
    db = get_database()

    # Two grouped counts for all reps, rather than two counts per rep.
    visit_counts = {
        g["_id"]: g["n"]
        async for g in db.visits.aggregate([{"$group": {"_id": "$rep_id", "n": {"$sum": 1}}}])
    }
    route_counts = {
        g["_id"]: g["n"]
        async for g in db.routes.aggregate([{"$group": {"_id": "$assigned_to", "n": {"$sum": 1}}}])
    }

    reps = []
    async for doc in db.users.find({"role": "sales"}).sort("created_at", -1):
        doc = convert_objectid_to_str(doc)
        doc["id"] = doc.pop("_id")
        reps.append(_build_sales_rep_response(
            doc, visit_counts.get(doc["id"], 0), route_counts.get(doc["id"], 0),
        ))
    return reps


@router.post("/sales-reps", response_model=SalesRepResponse, status_code=status.HTTP_201_CREATED)
async def create_sales_rep(data: SalesRepCreate, current_user: User = Depends(require_admin)):
    """Create a new sales rep account."""
    db = get_database()

    existing = await db.users.find_one({"email": data.email.lower().strip()})
    if existing:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Email already registered")

    now = datetime.utcnow()
    doc = {
        "first_name": data.first_name.strip(),
        "last_name": data.last_name.strip(),
        "email": data.email.lower().strip(),
        "password_hash": hash_password(data.password),
        "role": "sales",
        "is_active": True,
        "created_at": now,
        "updated_at": now,
    }
    result = await db.users.insert_one(doc)
    created = await db.users.find_one({"_id": result.inserted_id})
    created = convert_objectid_to_str(created)
    created["id"] = created.pop("_id")
    logger.info(f"Sales rep created: {created['email']} by admin {current_user.email}")
    return _build_sales_rep_response(created)


@router.put("/sales-reps/{rep_id}", response_model=SalesRepResponse)
async def update_sales_rep(rep_id: str, data: SalesRepUpdate, current_user: User = Depends(require_admin)):
    """Update a sales rep's details or reset their password."""
    db = get_database()
    try:
        oid = ObjectId(rep_id)
    except Exception:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Sales rep not found")

    rep = await db.users.find_one({"_id": oid, "role": "sales"})
    if not rep:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Sales rep not found")

    updates: dict = {"updated_at": datetime.utcnow()}
    if data.first_name is not None:
        updates["first_name"] = data.first_name.strip()
    if data.last_name is not None:
        updates["last_name"] = data.last_name.strip()
    if data.email is not None:
        email = data.email.lower().strip()
        conflict = await db.users.find_one({"email": email, "_id": {"$ne": oid}})
        if conflict:
            raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Email already in use")
        updates["email"] = email
    if data.password is not None:
        updates["password_hash"] = hash_password(data.password)

    await db.users.update_one({"_id": oid}, {"$set": updates})
    updated = await db.users.find_one({"_id": oid})
    updated = convert_objectid_to_str(updated)
    updated["id"] = updated.pop("_id")
    total_visits = await db.visits.count_documents({"rep_id": rep_id})
    total_routes = await db.routes.count_documents({"assigned_to": rep_id})
    return _build_sales_rep_response(updated, total_visits, total_routes)


@router.patch("/sales-reps/{rep_id}/deactivate", response_model=SalesRepResponse)
async def deactivate_sales_rep(rep_id: str, current_user: User = Depends(require_admin)):
    """Deactivate a sales rep (they can no longer log in, history preserved)."""
    db = get_database()
    try:
        oid = ObjectId(rep_id)
    except Exception:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Sales rep not found")

    rep = await db.users.find_one({"_id": oid, "role": "sales"})
    if not rep:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Sales rep not found")

    await db.users.update_one({"_id": oid}, {"$set": {"is_active": False, "updated_at": datetime.utcnow()}})
    updated = await db.users.find_one({"_id": oid})
    updated = convert_objectid_to_str(updated)
    updated["id"] = updated.pop("_id")
    total_visits = await db.visits.count_documents({"rep_id": rep_id})
    total_routes = await db.routes.count_documents({"assigned_to": rep_id})
    return _build_sales_rep_response(updated, total_visits, total_routes)


@router.patch("/sales-reps/{rep_id}/activate", response_model=SalesRepResponse)
async def activate_sales_rep(rep_id: str, current_user: User = Depends(require_admin)):
    """Re-activate a previously deactivated sales rep."""
    db = get_database()
    try:
        oid = ObjectId(rep_id)
    except Exception:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Sales rep not found")

    rep = await db.users.find_one({"_id": oid, "role": "sales"})
    if not rep:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Sales rep not found")

    await db.users.update_one({"_id": oid}, {"$set": {"is_active": True, "updated_at": datetime.utcnow()}})
    updated = await db.users.find_one({"_id": oid})
    updated = convert_objectid_to_str(updated)
    updated["id"] = updated.pop("_id")
    total_visits = await db.visits.count_documents({"rep_id": rep_id})
    total_routes = await db.routes.count_documents({"assigned_to": rep_id})
    return _build_sales_rep_response(updated, total_visits, total_routes)
