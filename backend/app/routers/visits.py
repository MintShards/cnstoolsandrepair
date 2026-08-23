import logging
from datetime import datetime
from typing import List

from bson import ObjectId
from fastapi import APIRouter, Depends, HTTPException, Query, Response, status
from pymongo.collation import Collation

from app.database import get_database
from app.dependencies.auth import require_sales_or_admin
from app.models.auth import User
from app.models.route_management import VisitCreate, VisitUpdate, VisitResponse
from app.utils import convert_objectid_to_str

router = APIRouter(prefix="/api/visits", tags=["visits"])
logger = logging.getLogger(__name__)


async def _fetch_by_ids(collection, ids) -> dict:
    """Fetch many documents in one round trip, keyed by their string id.

    Ids that aren't valid ObjectIds are skipped rather than raising, matching the
    previous per-row behaviour of treating a bad reference as "not found".
    """
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


async def _build_visit_responses(db, docs: List[dict]) -> List[VisitResponse]:
    """Build a page of visits with two queries instead of two per row."""
    businesses = await _fetch_by_ids(db.businesses, {d["business_id"] for d in docs})
    reps = await _fetch_by_ids(db.users, {d["rep_id"] for d in docs})

    results = []
    for doc in docs:
        biz = businesses.get(doc["business_id"])
        rep = reps.get(doc["rep_id"])
        results.append(VisitResponse(
            id=doc["id"],
            business_id=doc["business_id"],
            business_name=biz.get("company_name") if biz else None,
            route_id=doc.get("route_id"),
            rep_id=doc["rep_id"],
            rep_name=(f"{rep.get('first_name', '')} {rep.get('last_name', '')}".strip()
                      or rep.get("email")) if rep else None,
            notes=doc.get("notes"),
            interest_level=doc["interest_level"],
            follow_up_date=doc.get("follow_up_date"),
            follow_up_note=doc.get("follow_up_note"),
            visited_at=doc["visited_at"],
            business_phone=biz.get("phone") if biz else None,
            business_maps_link=biz.get("google_maps_link") if biz else None,
            business_address=biz.get("address") if biz else None,
        ))
    return results


async def _build_visit_response(db, doc: dict) -> VisitResponse:
    """Single-visit convenience wrapper around the batch builder."""
    return (await _build_visit_responses(db, [doc]))[0]


# Whitelist of sortable columns → the field the pipeline sorts on. Business name
# is joined, since the visit document only stores business_id.
FOLLOW_UP_SORT_FIELDS = {
    "follow_up_date": "follow_up_date",
    "business_name": "_business_name",
    "interest_level": "_interest_rank",
    "visited_at": "visited_at",
}

_CASE_INSENSITIVE = Collation(locale="en", strength=2)


# /follow-ups MUST be defined before /{visit_id} to avoid matching "follow-ups" as an ID
@router.get("/follow-ups", response_model=List[VisitResponse])
async def get_follow_ups(
    response: Response,
    skip: int = Query(default=0, ge=0),
    limit: int = Query(default=30, ge=1, le=100),
    sort_by: str = Query(default="follow_up_date"),
    sort_dir: str = Query(default="asc", pattern="^(asc|desc)$"),
    current_user: User = Depends(require_sales_or_admin),
):
    """Get follow-ups for the current user, oldest due date first by default so
    overdue items lead. Paginated with skip/limit, so sorting is server-side.
    """
    db = get_database()

    query: dict = {"follow_up_date": {"$ne": None}}
    if current_user.role == "sales":
        query["rep_id"] = current_user.id

    if sort_by not in FOLLOW_UP_SORT_FIELDS:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Cannot sort by '{sort_by}'. Allowed: {', '.join(sorted(FOLLOW_UP_SORT_FIELDS))}",
        )
    sort_key = FOLLOW_UP_SORT_FIELDS[sort_by]
    direction = 1 if sort_dir == "asc" else -1

    total = await db.visits.count_documents(query)
    response.headers["X-Total-Count"] = str(total)
    response.headers["Access-Control-Expose-Headers"] = "X-Total-Count"

    pipeline = [
        {"$match": query},
        # business_id is a string, so match on $toString of the business _id.
        {"$lookup": {
            "from": "businesses",
            "let": {"bid": "$business_id"},
            "pipeline": [
                {"$match": {"$expr": {"$eq": [{"$toString": "$_id"}, "$$bid"]}}},
                {"$project": {"_id": 0, "company_name": 1}},
            ],
            "as": "_business",
        }},
        {"$addFields": {
            "_business_name": {"$arrayElemAt": ["$_business.company_name", 0]},
            "_interest_rank": {
                "$switch": {
                    "branches": [
                        {"case": {"$eq": ["$interest_level", "hot"]}, "then": 3},
                        {"case": {"$eq": ["$interest_level", "warm"]}, "then": 2},
                    ],
                    "default": 1,
                }
            },
        }},
        {"$project": {"_business": 0}},
        # _id breaks ties so pagination stays stable across pages.
        {"$sort": {sort_key: direction, "_id": 1}},
        {"$skip": skip},
        {"$limit": limit},
    ]

    docs = []
    async for doc in db.visits.aggregate(pipeline, collation=_CASE_INSENSITIVE):
        doc.pop("_business_name", None)
        doc.pop("_interest_rank", None)
        doc = convert_objectid_to_str(doc)
        doc["id"] = doc.pop("_id")
        docs.append(doc)
    return await _build_visit_responses(db, docs)


@router.post("/", response_model=VisitResponse, status_code=status.HTTP_201_CREATED)
async def create_visit(data: VisitCreate, current_user: User = Depends(require_sales_or_admin)):
    """Log a visit to a business.

    Automatically:
    - Updates the business's interest_level, last_visited_at, and visit_count
    - Marks the corresponding route stop as completed (if route_id provided)
    """
    db = get_database()

    # Validate business exists
    try:
        biz_oid = ObjectId(data.business_id)
    except Exception:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid business_id")

    biz = await db.businesses.find_one({"_id": biz_oid})
    if not biz:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Business not found")

    now = datetime.utcnow()
    visit_doc = {
        "business_id": data.business_id,
        "route_id": data.route_id,
        "rep_id": current_user.id,
        "notes": data.notes,
        "interest_level": data.interest_level,
        "follow_up_date": data.follow_up_date,
        "follow_up_note": data.follow_up_note,
        "visited_at": now,
    }
    result = await db.visits.insert_one(visit_doc)

    # Update business interest level, last_visited_at, and visit_count
    await db.businesses.update_one(
        {"_id": biz_oid},
        {
            "$set": {
                "interest_level": data.interest_level,
                "last_visited_at": now,
                "updated_at": now,
            },
            "$inc": {"visit_count": 1},
        }
    )

    # Mark the corresponding stop in the route as completed. Ownership is
    # enforced like complete_stop: a rep can only advance their OWN route —
    # otherwise a crafted route_id could corrupt another rep's progress.
    if data.route_id:
        try:
            route_oid = ObjectId(data.route_id)
            route = await db.routes.find_one({"_id": route_oid})
            if route and (
                current_user.role != "sales" or route.get("assigned_to") == current_user.id
            ):
                stops = route.get("stops", [])
                for stop in stops:
                    if stop["business_id"] == data.business_id and not stop.get("completed"):
                        stop["completed"] = True
                        stop["completed_at"] = now
                        break
                await db.routes.update_one(
                    {"_id": route_oid},
                    {"$set": {"stops": stops, "updated_at": now}}
                )
        except Exception:
            pass  # Route stop marking is best-effort

    created = await db.visits.find_one({"_id": result.inserted_id})
    created = convert_objectid_to_str(created)
    created["id"] = created.pop("_id")
    logger.info(f"Visit logged for business {data.business_id} by {current_user.email}")
    return await _build_visit_response(db, created)


@router.put("/{visit_id}", response_model=VisitResponse)
async def update_visit(visit_id: str, data: VisitUpdate, current_user: User = Depends(require_sales_or_admin)):
    """Update a visit's notes, interest level, or follow-up info.
    Sales reps can only update their own visits.
    """
    db = get_database()
    try:
        oid = ObjectId(visit_id)
    except Exception:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Visit not found")

    doc = await db.visits.find_one({"_id": oid})
    if not doc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Visit not found")

    if current_user.role == "sales" and doc["rep_id"] != current_user.id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Access denied")

    updates = data.model_dump(exclude_unset=True)
    if updates:
        await db.visits.update_one({"_id": oid}, {"$set": updates})

        # If interest_level changed, sync to business
        if "interest_level" in updates:
            try:
                await db.businesses.update_one(
                    {"_id": ObjectId(doc["business_id"])},
                    {"$set": {"interest_level": updates["interest_level"], "updated_at": datetime.utcnow()}}
                )
            except Exception:
                pass

    updated = await db.visits.find_one({"_id": oid})
    updated = convert_objectid_to_str(updated)
    updated["id"] = updated.pop("_id")
    return await _build_visit_response(db, updated)
