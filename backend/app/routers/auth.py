import logging
from datetime import datetime
from typing import List

from bson import ObjectId
from fastapi import APIRouter, HTTPException, status, Depends, Request, Response
from slowapi import Limiter
from slowapi.util import get_remote_address

from app.models.auth import (
    LoginRequest, LoginResponse, User, SalesRepCreate, SalesRepUpdate, SalesRepResponse,
    StaffCreate, StaffUpdate, StaffResponse, ChangePasswordRequest, RoleChangeRequest,
)
from app.core.security import verify_password, create_access_token, hash_password
from app.database import get_database
from app.dependencies.auth import get_current_user, require_admin, require_staff_or_admin, ACCESS_TOKEN_COOKIE
from app.config import settings
from app.utils import convert_objectid_to_str, user_display_name
from app.services.activity_service import actor_ref, record_activity


def _account_name(doc: dict) -> str:
    return f"{doc.get('first_name') or ''} {doc.get('last_name') or ''}".strip() or doc.get("email") or "account"


async def _log_account(db, current_user, kind: str, summary: str, details=None) -> None:
    """Account changes are admin-only history (the activity API hides the
    `account_` kinds from everyone else)."""
    await record_activity(db, kind=kind, actor=actor_ref(current_user), summary=summary, details=details)

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


@router.get("/me", response_model=User, response_model_by_alias=False)
async def get_me(current_user: User = Depends(get_current_user)):
    """
    Get current authenticated user information.

    Args:
        current_user: Current user from JWT token (dependency)

    Returns:
        User object with current user information

    Note:
        response_model_by_alias=False so the id field serializes as `id`,
        not its `_id` alias — every frontend consumer (`currentUser.id` in
        the Workspace, RoutePlanner's assign-to default) keys on `id`,
        matching the rest of the API.
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
    await _log_account(db, current_user, "account_created",
                       f"Account created: {_account_name(created)} ({created['email']}) — sales rep")
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
    changes = [
        f"Name: {_account_name(rep)} → {_account_name(updated)}" if _account_name(rep) != _account_name(updated) else None,
        f"Email: {rep.get('email')} → {updated.get('email')}" if rep.get("email") != updated.get("email") else None,
        "Password reset" if data.password is not None else None,
    ]
    if any(changes):
        await _log_account(db, current_user, "account_edited",
                           f"Account edited: {_account_name(updated)} (sales rep)", details=changes)
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
    await _log_account(db, current_user, "account_deactivated",
                       f"Account deactivated: {_account_name(rep)} (sales rep)")
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
    await _log_account(db, current_user, "account_reactivated",
                       f"Account re-activated: {_account_name(rep)} (sales rep)")
    updated = await db.users.find_one({"_id": oid})
    updated = convert_objectid_to_str(updated)
    updated["id"] = updated.pop("_id")
    total_visits = await db.visits.count_documents({"rep_id": rep_id})
    total_routes = await db.routes.count_documents({"assigned_to": rep_id})
    return _build_sales_rep_response(updated, total_visits, total_routes)


# ---------------------------------------------------------------------------
# Staff CRUD (shop workers — role "staff" is operational-only, "admin" is full)
# ---------------------------------------------------------------------------

STAFF_ROLES = ["staff", "technician", "admin"]


def _build_staff_response(doc: dict, include_rate: bool = False) -> StaffResponse:
    """`include_rate` adds what the person's hour costs the shop — a wage
    figure, so only admin callers get it."""
    return StaffResponse(
        id=doc["id"],
        first_name=doc.get("first_name"),
        last_name=doc.get("last_name"),
        name=user_display_name(doc),
        email=doc["email"],
        role=doc.get("role", "admin"),
        is_active=doc.get("is_active", True),
        created_at=doc["created_at"],
        labour_cost_basis=(doc.get("labour_cost_basis") or "hourly") if include_rate else "hourly",
        labour_cost_rate=doc.get("labour_cost_rate") if include_rate else None,
    )


@router.get("/staff", response_model=List[StaffResponse])
async def list_staff(current_user: User = Depends(require_staff_or_admin)):
    """List all shop accounts (role staff or admin). Staff-accessible: it
    feeds the assignee pickers, seen-by names, and the team directory. The
    labour cost rate rides along for admins only."""
    db = get_database()
    include_rate = current_user.role == "admin"
    staff = []
    async for doc in db.users.find({"role": {"$in": STAFF_ROLES}}).sort("created_at", -1):
        doc = convert_objectid_to_str(doc)
        doc["id"] = doc.pop("_id")
        staff.append(_build_staff_response(doc, include_rate))
    return staff


@router.post("/staff", response_model=StaffResponse, status_code=status.HTTP_201_CREATED)
async def create_staff(data: StaffCreate, current_user: User = Depends(require_admin)):
    """Create a new shop account at the requested access level."""
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
        "role": data.role,
        "labour_cost_basis": data.labour_cost_basis,
        "labour_cost_rate": data.labour_cost_rate,
        "is_active": True,
        "created_at": now,
        "updated_at": now,
    }
    result = await db.users.insert_one(doc)
    created = await db.users.find_one({"_id": result.inserted_id})
    created = convert_objectid_to_str(created)
    created["id"] = created.pop("_id")
    logger.info(f"Staff account created: {created['email']} by admin {current_user.email}")
    await _log_account(db, current_user, "account_created",
                       f"Account created: {_account_name(created)} ({created['email']}) — {data.role}")
    return _build_staff_response(created, include_rate=True)


@router.put("/staff/{user_id}", response_model=StaffResponse)
async def update_staff(user_id: str, data: StaffUpdate, current_user: User = Depends(require_admin)):
    """Update a staff member's details, reset their password, or change
    their access level."""
    db = get_database()
    try:
        oid = ObjectId(user_id)
    except Exception:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Staff member not found")

    member = await db.users.find_one({"_id": oid, "role": {"$in": STAFF_ROLES}})
    if not member:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Staff member not found")

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
        logger.info(f"Password reset for staff {member['email']} by admin {current_user.email}")
    if data.role is not None and data.role != member.get("role", "admin"):
        if user_id == current_user.id:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST,
                                detail="You cannot change your own access level")
        # Demoting the last active admin would lock the shop out of the CMS
        # and account management.
        if member.get("role", "admin") == "admin":
            active_admins = await db.users.count_documents({"role": "admin", "is_active": True})
            if member.get("is_active", True) and active_admins <= 1:
                raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST,
                                    detail="Cannot remove admin access from the last active admin account")
        updates["role"] = data.role
        logger.info(f"Access level for {member['email']} set to {data.role} by admin {current_user.email}")
    # Sent explicitly (a number, or null to clear) — never touched otherwise.
    if "labour_cost_rate" in data.model_fields_set:
        updates["labour_cost_rate"] = data.labour_cost_rate
    if data.labour_cost_basis is not None:
        updates["labour_cost_basis"] = data.labour_cost_basis

    await db.users.update_one({"_id": oid}, {"$set": updates})
    updated = await db.users.find_one({"_id": oid})
    changes = [
        f"Name: {_account_name(member)} → {_account_name(updated)}" if _account_name(member) != _account_name(updated) else None,
        f"Email: {member.get('email')} → {updated.get('email')}" if member.get("email") != updated.get("email") else None,
        "Password reset" if data.password is not None else None,
        f"Access: {member.get('role', 'admin')} → {updates['role']}" if "role" in updates else None,
        "Labour terms changed" if ("labour_cost_rate" in updates or "labour_cost_basis" in updates)
        and (member.get("labour_cost_rate") != updated.get("labour_cost_rate")
             or member.get("labour_cost_basis") != updated.get("labour_cost_basis")) else None,
    ]
    if any(changes):
        await _log_account(db, current_user, "account_edited",
                           f"Account edited: {_account_name(updated)}", details=changes)
    updated = convert_objectid_to_str(updated)
    updated["id"] = updated.pop("_id")
    return _build_staff_response(updated, include_rate=True)


@router.patch("/staff/{user_id}/deactivate", response_model=StaffResponse)
async def deactivate_staff(user_id: str, current_user: User = Depends(require_admin)):
    """Deactivate a staff account (blocks login, history preserved). Guards
    against locking the shop out: no self-deactivation, and the last active
    admin can never be deactivated."""
    db = get_database()
    try:
        oid = ObjectId(user_id)
    except Exception:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Staff member not found")

    if user_id == current_user.id:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST,
                            detail="You cannot deactivate your own account")

    member = await db.users.find_one({"_id": oid, "role": {"$in": STAFF_ROLES}})
    if not member:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Staff member not found")

    # Only admin accounts count toward the lockout guard — deactivating a
    # staff-role account can never strand the shop.
    if member.get("role", "admin") == "admin":
        active_admins = await db.users.count_documents({"role": "admin", "is_active": True})
        if member.get("is_active", True) and active_admins <= 1:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST,
                                detail="Cannot deactivate the last active admin account")

    await db.users.update_one({"_id": oid}, {"$set": {"is_active": False, "updated_at": datetime.utcnow()}})
    updated = await db.users.find_one({"_id": oid})
    updated = convert_objectid_to_str(updated)
    updated["id"] = updated.pop("_id")
    logger.info(f"Staff account deactivated: {member['email']} by admin {current_user.email}")
    await _log_account(db, current_user, "account_deactivated",
                       f"Account deactivated: {_account_name(member)} ({member.get('role', 'admin')})")
    return _build_staff_response(updated)


@router.patch("/staff/{user_id}/activate", response_model=StaffResponse)
async def activate_staff(user_id: str, current_user: User = Depends(require_admin)):
    """Re-activate a previously deactivated staff account."""
    db = get_database()
    try:
        oid = ObjectId(user_id)
    except Exception:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Staff member not found")

    member = await db.users.find_one({"_id": oid, "role": {"$in": STAFF_ROLES}})
    if not member:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Staff member not found")

    await db.users.update_one({"_id": oid}, {"$set": {"is_active": True, "updated_at": datetime.utcnow()}})
    updated = await db.users.find_one({"_id": oid})
    updated = convert_objectid_to_str(updated)
    updated["id"] = updated.pop("_id")
    logger.info(f"Staff account re-activated: {member['email']} by admin {current_user.email}")
    await _log_account(db, current_user, "account_reactivated",
                       f"Account re-activated: {_account_name(member)} ({member.get('role', 'admin')})")
    return _build_staff_response(updated)


@router.patch("/users/{user_id}/role", response_model=StaffResponse)
async def change_user_role(
    user_id: str, data: RoleChangeRequest, current_user: User = Depends(require_admin),
):
    """Set ANY account's role to any of the four roles — the one place role
    management lives. Unlike the staff/sales-reps update endpoints (which
    are scoped to their own kind), this can convert across the boundary:
    a sales rep can become a technician, a staff member can become a rep.
    Historical data keeps working either way — task assignments and visit
    logs snapshot names, and lookups resolve by user id regardless of role.

    Guards: no self-change, and the last active admin can never lose admin.
    """
    db = get_database()
    try:
        oid = ObjectId(user_id)
    except Exception:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")

    if user_id == current_user.id:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST,
                            detail="You cannot change your own access level")

    member = await db.users.find_one({"_id": oid})
    if not member:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")

    old_role = member.get("role", "admin")
    if data.role != old_role:
        if old_role == "admin":
            active_admins = await db.users.count_documents({"role": "admin", "is_active": True})
            if member.get("is_active", True) and active_admins <= 1:
                raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST,
                                    detail="Cannot remove admin access from the last active admin account")
        await db.users.update_one(
            {"_id": oid},
            {"$set": {"role": data.role, "updated_at": datetime.utcnow()}},
        )
        logger.info(f"Role for {member['email']} changed {old_role} -> {data.role} "
                    f"by admin {current_user.email}")
        await _log_account(db, current_user, "account_role_changed",
                           f"Access changed: {_account_name(member)} — {old_role} → {data.role}")

    updated = await db.users.find_one({"_id": oid})
    updated = convert_objectid_to_str(updated)
    updated["id"] = updated.pop("_id")
    return _build_staff_response(updated)


@router.post("/change-password")
@limiter.limit("5/minute")
async def change_password(
    request: Request,
    data: ChangePasswordRequest,
    current_user: User = Depends(get_current_user),
):
    """Self-service password change for any logged-in user (admin or sales)."""
    db = get_database()
    user_doc = await db.users.find_one({"email": current_user.email})
    if not user_doc or not verify_password(data.current_password, user_doc.get("password_hash", "")):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST,
                            detail="Current password is incorrect")

    await db.users.update_one(
        {"_id": user_doc["_id"]},
        {"$set": {"password_hash": hash_password(data.new_password), "updated_at": datetime.utcnow()}},
    )
    logger.info(f"Password changed by {current_user.email}")
    await _log_account(db, current_user, "password_changed",
                       f"Password changed: {_account_name(user_doc)} (own account)")
    return {"success": True}
