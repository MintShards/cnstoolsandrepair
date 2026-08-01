import logging
import re
from datetime import datetime
from typing import List, Optional

from bson import ObjectId
from fastapi import APIRouter, Depends, HTTPException, Query, Response, status
from pymongo.collation import Collation

from app.database import get_database
from app.dependencies.auth import require_admin, require_sales_or_admin
from app.services import zone_tree
from app.models.auth import User
from app.models.route_management import (
    BusinessCreate, BusinessUpdate, BusinessResponse,
    ConvertToCustomerRequest, VisitResponse,
)
from app.utils import convert_objectid_to_str

router = APIRouter(prefix="/api/businesses", tags=["businesses"])
logger = logging.getLogger(__name__)


def _same_name_query(name: str) -> dict:
    """Match company_name ignoring case and whitespace runs, so
    "m&s  truck repair" collides with "M&S Truck Repair"."""
    parts = " ".join(name.split()).split(" ")
    pattern = r"^\s*" + r"\s+".join(re.escape(p) for p in parts) + r"\s*$"
    return {"company_name": {"$regex": pattern, "$options": "i"}}


async def _reject_duplicate_name(db, name: str, exclude_oid=None) -> None:
    """409 when another business already carries this name. One business, one
    row — a second location should get a distinguishing name instead."""
    query = _same_name_query(name)
    if exclude_oid is not None:
        query["_id"] = {"$ne": exclude_oid}
    dup = await db.businesses.find_one(query)
    if dup:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=(
                f'"{dup["company_name"]}" is already in the businesses list. '
                'Edit that one, or add a location to the name (e.g. "— Newton") '
                'if this is genuinely a second branch.'
            ),
        )


async def _fetch_by_ids(collection, ids) -> dict:
    """Fetch many documents in one round trip, keyed by their string id."""
    oids = []
    for raw in ids:
        try:
            oids.append(ObjectId(raw))
        except Exception:
            continue
    if not oids:
        return {}
    cursor = collection.find({"_id": {"$in": oids}})
    return {str(doc["_id"]): doc async for doc in cursor}


def _person_name(doc: dict) -> Optional[str]:
    if not doc:
        return None
    return f"{doc.get('first_name', '')} {doc.get('last_name', '')}".strip() or doc.get("email")


def _zone_ids_of(doc: dict) -> List[str]:
    """A business's zones, tolerating documents written before multi-zone."""
    ids = doc.get("zone_ids")
    if ids:
        return list(ids)
    legacy = doc.get("zone_id")
    return [legacy] if legacy else []


async def _populate_zone_names(db, zone_ids: List[str]) -> List[str]:
    zones = await _fetch_by_ids(db.zones, zone_ids)
    # Ordered by name so the chips and the "+N" summary read consistently.
    return sorted(z["name"] for z in zones.values())


async def _validate_zone_ids(db, zone_ids: List[str]) -> None:
    found = await _fetch_by_ids(db.zones, zone_ids)
    missing = [z for z in zone_ids if z not in found]
    if missing:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Unknown zone id(s): {', '.join(missing)}",
        )


def _build_business_response(doc: dict, zone_names: Optional[List[str]] = None) -> BusinessResponse:
    return BusinessResponse(
        id=doc["id"],
        company_name=doc["company_name"],
        google_maps_link=doc["google_maps_link"],
        zone_ids=_zone_ids_of(doc),
        zone_names=zone_names or [],
        contact_first_name=doc.get("contact_first_name"),
        contact_last_name=doc.get("contact_last_name"),
        phone=doc.get("phone"),
        email=doc.get("email"),
        address=doc.get("address"),
        notes=doc.get("notes"),
        interest_level=doc.get("interest_level", "cold"),
        last_visited_at=doc.get("last_visited_at"),
        visit_count=doc.get("visit_count", 0),
        customer_id=doc.get("customer_id"),
        created_by=doc["created_by"],
        created_at=doc["created_at"],
        updated_at=doc["updated_at"],
    )


# Whitelist of sortable columns → the field the pipeline actually sorts on.
# `interest_level` and `status` sort on computed ranks so the order is meaningful
# rather than alphabetical (cold/hot/warm) or by raw ObjectId.
SORT_FIELDS = {
    "company_name": "company_name",
    "interest_level": "_interest_rank",
    "status": "_is_customer",
    "last_visited_at": "last_visited_at",
    "zone_name": "_zone_name",
}

# strength=2 makes the A–Z sort case-insensitive; without it Mongo's byte order
# dumps every lowercase company name after the uppercase ones.
_CASE_INSENSITIVE = Collation(locale="en", strength=2)


@router.get("/", response_model=List[BusinessResponse])
async def list_businesses(
    response: Response,
    skip: int = Query(default=0, ge=0),
    limit: int = Query(default=50, ge=1, le=200),
    search: Optional[str] = None,
    zone_id: Optional[str] = None,
    interest_level: Optional[str] = None,
    sort_by: str = Query(default="company_name"),
    sort_dir: str = Query(default="asc", pattern="^(asc|desc)$"),
    current_user: User = Depends(require_sales_or_admin),
):
    """List/search businesses with optional zone and interest level filters.

    Sorting is server-side because the list is paginated — sorting only the
    current page would silently misrepresent the rest of the result set.
    """
    db = get_database()
    query: dict = {}

    if search:
        # Escaped: an unbalanced "(" in a search box would otherwise 500 on a bad regex.
        query["company_name"] = {"$regex": re.escape(search.strip()), "$options": "i"}
    if zone_id:
        # Filtering by a parent zone includes everything in its children —
        # "Surrey but not Surrey's sub-areas" isn't a thing anyone wants, so this
        # is always inclusive rather than an opt-in flag. On a flat set of zones
        # scope_ids returns just [zone_id] and this behaves exactly as before.
        query["zone_ids"] = {"$in": await zone_tree.scope_ids(db, zone_id)}
    if interest_level and interest_level in ("cold", "warm", "hot"):
        query["interest_level"] = interest_level

    if sort_by not in SORT_FIELDS:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Cannot sort by '{sort_by}'. Allowed: {', '.join(sorted(SORT_FIELDS))}",
        )
    sort_key = SORT_FIELDS[sort_by]
    direction = 1 if sort_dir == "asc" else -1

    total = await db.businesses.count_documents(query)
    response.headers["X-Total-Count"] = str(total)
    response.headers["Access-Control-Expose-Headers"] = "X-Total-Count"

    pipeline = [
        {"$match": query},
        {"$addFields": {
            "_interest_rank": {
                "$switch": {
                    "branches": [
                        {"case": {"$eq": ["$interest_level", "hot"]}, "then": 3},
                        {"case": {"$eq": ["$interest_level", "warm"]}, "then": 2},
                    ],
                    "default": 1,
                }
            },
            "_is_customer": {
                "$cond": [{"$ifNull": ["$customer_id", False]}, 1, 0]
            },
        }},
        # Join every zone the business belongs to, so the rows below don't need a
        # per-business query and Zone stays sortable. Compare on $toString of the
        # zone _id: zone_ids holds strings, and converting the other way would
        # throw on any malformed id.
        {"$lookup": {
            "from": "zones",
            "let": {"zids": {"$ifNull": ["$zone_ids", []]}},
            "pipeline": [
                {"$match": {"$expr": {"$in": [{"$toString": "$_id"}, "$$zids"]}}},
                {"$project": {"_id": 0, "name": 1}},
                {"$sort": {"name": 1}},
            ],
            "as": "_zones",
        }},
        {"$addFields": {
            "_zone_names": "$_zones.name",
            # Sorting by a list isn't meaningful, so key off the first zone name.
            "_zone_name": {"$arrayElemAt": ["$_zones.name", 0]},
        }},
        {"$project": {"_zones": 0}},
        # _id breaks ties so pagination stays stable across pages.
        {"$sort": {sort_key: direction, "_id": 1}},
        {"$skip": skip},
        {"$limit": limit},
    ]

    results = []
    async for doc in db.businesses.aggregate(pipeline, collation=_CASE_INSENSITIVE):
        doc.pop("_interest_rank", None)
        doc.pop("_is_customer", None)
        doc.pop("_zone_name", None)
        zone_names = doc.pop("_zone_names", []) or []
        doc = convert_objectid_to_str(doc)
        doc["id"] = doc.pop("_id")
        results.append(_build_business_response(doc, zone_names))
    return results


@router.post("/", response_model=BusinessResponse, status_code=status.HTTP_201_CREATED)
async def create_business(data: BusinessCreate, current_user: User = Depends(require_admin)):
    """Create a new business prospect (admin only)."""
    db = get_database()

    await _validate_zone_ids(db, data.zone_ids)
    await _reject_duplicate_name(db, data.company_name)

    now = datetime.utcnow()
    doc = {
        "company_name": data.company_name.strip(),
        "google_maps_link": data.google_maps_link.strip(),
        "zone_ids": data.zone_ids,
        "contact_first_name": data.contact_first_name,
        "contact_last_name": data.contact_last_name,
        "phone": data.phone,
        "email": data.email.lower().strip() if data.email else None,
        "address": data.address,
        "notes": data.notes,
        "interest_level": data.interest_level,
        "last_visited_at": None,
        "visit_count": 0,
        "customer_id": None,
        "created_by": current_user.id,
        "created_at": now,
        "updated_at": now,
    }
    result = await db.businesses.insert_one(doc)
    created = await db.businesses.find_one({"_id": result.inserted_id})
    created = convert_objectid_to_str(created)
    created["id"] = created.pop("_id")
    logger.info(f"Business created: {created['company_name']} by {current_user.email}")
    return _build_business_response(created, await _populate_zone_names(db, data.zone_ids))


@router.get("/{business_id}", response_model=BusinessResponse)
async def get_business(business_id: str, current_user: User = Depends(require_sales_or_admin)):
    """Get a single business by ID."""
    db = get_database()
    try:
        oid = ObjectId(business_id)
    except Exception:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Business not found")

    doc = await db.businesses.find_one({"_id": oid})
    if not doc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Business not found")

    doc = convert_objectid_to_str(doc)
    doc["id"] = doc.pop("_id")
    return _build_business_response(doc, await _populate_zone_names(db, _zone_ids_of(doc)))


@router.put("/{business_id}", response_model=BusinessResponse)
async def update_business(business_id: str, data: BusinessUpdate, current_user: User = Depends(require_admin)):
    """Update a business prospect (admin only)."""
    db = get_database()
    try:
        oid = ObjectId(business_id)
    except Exception:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Business not found")

    doc = await db.businesses.find_one({"_id": oid})
    if not doc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Business not found")

    updates: dict = {"updated_at": datetime.utcnow()}
    update_data = data.model_dump(exclude_unset=True)

    if "zone_ids" in update_data and update_data["zone_ids"]:
        await _validate_zone_ids(db, update_data["zone_ids"])
        # Drop the pre-multi-zone field so the two can't disagree.
        updates_unset = {"zone_id": ""}
    else:
        updates_unset = None

    if "email" in update_data and update_data["email"]:
        update_data["email"] = update_data["email"].lower().strip()
    if "company_name" in update_data and update_data["company_name"]:
        update_data["company_name"] = update_data["company_name"].strip()
        # Renaming into an existing business is the same duplicate, later.
        await _reject_duplicate_name(db, update_data["company_name"], exclude_oid=oid)

    updates.update(update_data)
    mutation: dict = {"$set": updates}
    if updates_unset:
        mutation["$unset"] = updates_unset
    await db.businesses.update_one({"_id": oid}, mutation)

    updated = await db.businesses.find_one({"_id": oid})
    updated = convert_objectid_to_str(updated)
    updated["id"] = updated.pop("_id")
    return _build_business_response(updated, await _populate_zone_names(db, _zone_ids_of(updated)))


@router.delete("/{business_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_business(business_id: str, current_user: User = Depends(require_admin)):
    """Delete a business prospect (admin only)."""
    db = get_database()
    try:
        oid = ObjectId(business_id)
    except Exception:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Business not found")

    doc = await db.businesses.find_one({"_id": oid})
    if not doc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Business not found")

    await db.businesses.delete_one({"_id": oid})
    logger.info(f"Business deleted: {business_id} by {current_user.email}")


@router.get("/{business_id}/visits", response_model=List[VisitResponse])
async def get_business_visits(
    business_id: str,
    skip: int = Query(default=0, ge=0),
    limit: int = Query(default=50, ge=1, le=100),
    current_user: User = Depends(require_sales_or_admin),
):
    """Get visit history for a business."""
    db = get_database()
    try:
        ObjectId(business_id)
    except Exception:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Business not found")

    biz = await db.businesses.find_one({"_id": ObjectId(business_id)})
    if not biz:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Business not found")

    docs = []
    async for doc in db.visits.find({"business_id": business_id}).sort("visited_at", -1).skip(skip).limit(limit):
        doc = convert_objectid_to_str(doc)
        doc["id"] = doc.pop("_id")
        docs.append(doc)

    # One lookup for every rep on the page rather than one per visit.
    reps = await _fetch_by_ids(db.users, {d["rep_id"] for d in docs})
    visits = [
        VisitResponse(
            id=doc["id"],
            business_id=doc["business_id"],
            business_name=biz.get("company_name"),
            route_id=doc.get("route_id"),
            rep_id=doc["rep_id"],
            rep_name=_person_name(reps.get(doc["rep_id"])),
            notes=doc.get("notes"),
            interest_level=doc["interest_level"],
            follow_up_date=doc.get("follow_up_date"),
            follow_up_note=doc.get("follow_up_note"),
            visited_at=doc["visited_at"],
        )
        for doc in docs
    ]
    return visits


@router.post("/{business_id}/convert-to-customer", status_code=status.HTTP_201_CREATED)
async def convert_to_customer(
    business_id: str,
    data: ConvertToCustomerRequest,
    current_user: User = Depends(require_admin),
):
    """Convert a business prospect to a repair tracker customer.

    Only the 7 contact fields are copied — visit history, interest level,
    and all route management data stays in route management collections.
    """
    db = get_database()
    try:
        oid = ObjectId(business_id)
    except Exception:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Business not found")

    biz = await db.businesses.find_one({"_id": oid})
    if not biz:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Business not found")

    if biz.get("customer_id"):
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="This business has already been converted to a customer"
        )

    # Check for duplicate email in customers collection
    email = data.email.lower().strip() if data.email else None
    if email:
        existing_customer = await db.customers.find_one({"email": email})
        if existing_customer:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="A customer with this email already exists in the repair tracker"
            )

    # Create customer with the 7 allowed fields
    now = datetime.utcnow()
    customer_doc = {
        "first_name": data.first_name.strip(),
        "last_name": data.last_name.strip(),
        "company_name": data.company_name.strip(),
        "email": email,
        "phone": data.phone,
        "address": data.address,
        "customer_notes": data.notes,
        "created_at": now,
        "updated_at": now,
    }
    result = await db.customers.insert_one(customer_doc)
    customer_id = str(result.inserted_id)

    # Link business to customer
    await db.businesses.update_one(
        {"_id": oid},
        {"$set": {"customer_id": customer_id, "updated_at": now}}
    )

    logger.info(
        f"Business {business_id} ({biz['company_name']}) converted to customer {customer_id} "
        f"by {current_user.email}"
    )
    return {"customer_id": customer_id, "message": "Business successfully converted to customer"}
