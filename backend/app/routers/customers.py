import logging
import re
from fastapi import APIRouter, HTTPException, Depends, Query, Response
from typing import List, Optional
from bson import ObjectId
from datetime import datetime
from zoneinfo import ZoneInfo

from app.database import get_database
from app.models.customer import CustomerCreate, CustomerUpdate, CustomerResponse
from app.models.repair import RepairJobResponse
from app.models.auth import User
from app.dependencies.auth import require_admin
from app.utils.helpers import convert_objectid_to_str
from app.routers.repairs import _migrate_tool_parts, _build_job_response

router = APIRouter(prefix="/api/customers", tags=["customers"])
logger = logging.getLogger(__name__)

_PACIFIC = ZoneInfo("America/Vancouver")

# Terminal repair statuses — customers with only these are "inactive"
_TERMINAL_STATUSES = ["completed", "closed", "declined", "beyond_economical_repair", "abandoned"]


def _build_customer_response(doc: dict) -> CustomerResponse:
    """Convert a customer dict from DB into a CustomerResponse"""
    doc["id"] = doc.pop("_id")
    return CustomerResponse(**doc)



# ──────────────────────────────────────────────
# SEARCH BY EMAIL (must be defined before /{customer_id})
# ──────────────────────────────────────────────

@router.get("/search/by-email", response_model=Optional[CustomerResponse])
async def search_customer_by_email(
    email: str,
    current_user: User = Depends(require_admin)
):
    """Find a customer by exact email address. Returns null if not found."""
    db = get_database()
    doc = await db.customers.find_one({"email": email.lower().strip()})
    if not doc:
        return None
    doc = convert_objectid_to_str(doc)
    return _build_customer_response(doc)


# ──────────────────────────────────────────────
# LIST
# ──────────────────────────────────────────────

@router.get("/", response_model=List[CustomerResponse])
async def list_customers(
    response: Response,
    skip: int = Query(default=0, ge=0),
    limit: int = Query(default=50, ge=1, le=200),
    search: Optional[str] = None,
    sort_by: Optional[str] = Query(default="smart", regex="^(created_at|updated_at|company_name|smart)$"),
    sort_order: Optional[str] = Query(default="desc", regex="^(asc|desc)$"),
    current_user: User = Depends(require_admin)
):
    """List customers with optional search by company, contact, or email"""
    db = get_database()

    query = {}
    if search:
        escaped = re.escape(search)
        query["$or"] = [
            {"company_name": {"$regex": escaped, "$options": "i"}},
            {"first_name": {"$regex": escaped, "$options": "i"}},
            {"last_name": {"$regex": escaped, "$options": "i"}},
            {"email": {"$regex": escaped, "$options": "i"}},
        ]

    total = await db.customers.count_documents(query)
    response.headers["X-Total-Count"] = str(total)
    response.headers["Access-Control-Expose-Headers"] = "X-Total-Count"

    if sort_by == "smart":
        # Customers with active (non-terminal) repair jobs sort first,
        # then by most recent job activity, then by customer creation date.
        pipeline = [
            {"$match": query},
            # Lookup repairs for each customer (by string customer_id)
            {"$addFields": {"_cid_str": {"$toString": "$_id"}}},
            {"$lookup": {
                "from": "repairs",
                "localField": "_cid_str",
                "foreignField": "customer_id",
                "as": "_repairs",
            }},
            {"$addFields": {
                # Does this customer have any non-terminal tool status?
                "_has_active": {
                    "$cond": [
                        {"$gt": [
                            {"$size": {
                                "$filter": {
                                    "input": {"$ifNull": ["$_repairs", []]},
                                    "as": "r",
                                    "cond": {
                                        "$gt": [
                                            {"$size": {
                                                "$filter": {
                                                    "input": {"$ifNull": ["$$r.tools", []]},
                                                    "as": "t",
                                                    "cond": {"$not": [{"$in": ["$$t.status", _TERMINAL_STATUSES]}]},
                                                }
                                            }},
                                            0,
                                        ]
                                    },
                                }
                            }},
                            0,
                        ]},
                        0,  # has active jobs → sort first
                        1,  # no active jobs → sort after
                    ]
                },
                # Most recent job updated_at (for secondary sort)
                "_latest_job_activity": {
                    "$max": "$_repairs.updated_at"
                },
            }},
            {"$sort": {
                "_has_active": 1,
                "_latest_job_activity": -1,
                "created_at": -1,
            }},
            {"$skip": skip},
            {"$limit": limit},
            {"$unset": ["_cid_str", "_repairs", "_has_active", "_latest_job_activity"]},
        ]

        docs = await db.customers.aggregate(pipeline).to_list(length=limit)
    else:
        sort_direction = 1 if sort_order == "asc" else -1
        sort_field = sort_by if sort_by in ("created_at", "updated_at", "company_name") else "created_at"
        cursor = db.customers.find(query).sort(sort_field, sort_direction).skip(skip).limit(limit)
        docs = await cursor.to_list(length=limit)

    docs = [convert_objectid_to_str(d) for d in docs]
    return [_build_customer_response(d) for d in docs]


# ──────────────────────────────────────────────
# CREATE
# ──────────────────────────────────────────────

@router.post("/", response_model=CustomerResponse, status_code=201)
async def create_customer(
    customer_data: CustomerCreate,
    current_user: User = Depends(require_admin)
):
    """Create a new customer profile"""
    db = get_database()

    # Normalize email
    email = str(customer_data.email).lower().strip()

    # Check for duplicate email
    existing = await db.customers.find_one({"email": email})
    if existing:
        raise HTTPException(
            status_code=409,
            detail="A customer with this email address already exists"
        )

    now = datetime.utcnow()
    doc = customer_data.model_dump()
    doc["email"] = email
    doc["created_at"] = now
    doc["updated_at"] = now

    result = await db.customers.insert_one(doc)
    created = await db.customers.find_one({"_id": result.inserted_id})
    created = convert_objectid_to_str(created)

    return _build_customer_response(created)


# ──────────────────────────────────────────────
# GET ONE
# ──────────────────────────────────────────────

@router.get("/{customer_id}", response_model=CustomerResponse)
async def get_customer(
    customer_id: str,
    current_user: User = Depends(require_admin)
):
    """Get a customer profile by ID"""
    db = get_database()

    try:
        doc = await db.customers.find_one({"_id": ObjectId(customer_id)})
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid customer ID format")

    if not doc:
        raise HTTPException(status_code=404, detail="Customer not found")

    doc = convert_objectid_to_str(doc)
    return _build_customer_response(doc)


# ──────────────────────────────────────────────
# GET JOBS FOR CUSTOMER
# ──────────────────────────────────────────────

@router.get("/{customer_id}/jobs", response_model=List[RepairJobResponse])
async def get_customer_jobs(
    customer_id: str,
    current_user: User = Depends(require_admin)
):
    """Get all repair jobs linked to a customer"""
    db = get_database()

    try:
        ObjectId(customer_id)
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid customer ID format")

    # Verify customer exists
    customer = await db.customers.find_one({"_id": ObjectId(customer_id)})
    if not customer:
        raise HTTPException(status_code=404, detail="Customer not found")

    cursor = db.repairs.find({"customer_id": customer_id}).sort("created_at", -1)
    jobs = await cursor.to_list(length=200)
    jobs = [convert_objectid_to_str(j) for j in jobs]

    return [_build_job_response(j) for j in jobs]


# ──────────────────────────────────────────────
# UPDATE
# ──────────────────────────────────────────────

@router.put("/{customer_id}", response_model=CustomerResponse)
async def update_customer(
    customer_id: str,
    customer_update: CustomerUpdate,
    current_user: User = Depends(require_admin)
):
    """Update a customer profile"""
    db = get_database()

    try:
        object_id = ObjectId(customer_id)
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid customer ID format")

    existing = await db.customers.find_one({"_id": object_id})
    if not existing:
        raise HTTPException(status_code=404, detail="Customer not found")

    update_data = customer_update.model_dump(exclude_unset=True)

    # Check email uniqueness if email is being changed
    if "email" in update_data:
        new_email = str(update_data["email"]).lower().strip()
        update_data["email"] = new_email
        dup = await db.customers.find_one({"email": new_email, "_id": {"$ne": object_id}})
        if dup:
            raise HTTPException(
                status_code=409,
                detail="Another customer with this email address already exists"
            )

    update_data["updated_at"] = datetime.utcnow()
    await db.customers.update_one({"_id": object_id}, {"$set": update_data})

    updated = await db.customers.find_one({"_id": object_id})
    updated = convert_objectid_to_str(updated)
    return _build_customer_response(updated)


# ──────────────────────────────────────────────
# DELETE
# ──────────────────────────────────────────────

@router.delete("/{customer_id}", status_code=204)
async def delete_customer(
    customer_id: str,
    current_user: User = Depends(require_admin)
):
    """Delete a customer profile (only if no linked repair jobs)"""
    db = get_database()

    try:
        object_id = ObjectId(customer_id)
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid customer ID format")

    existing = await db.customers.find_one({"_id": object_id})
    if not existing:
        raise HTTPException(status_code=404, detail="Customer not found")

    # Block deletion if linked repair jobs exist
    linked_jobs = await db.repairs.count_documents({"customer_id": customer_id})
    if linked_jobs > 0:
        raise HTTPException(
            status_code=409,
            detail=f"Cannot delete customer with {linked_jobs} linked repair job(s). Delete the repair jobs first."
        )

    await db.customers.delete_one({"_id": object_id})
    return None
