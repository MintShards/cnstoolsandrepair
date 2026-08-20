import logging
from datetime import datetime
from typing import List, Optional
from zoneinfo import ZoneInfo

from bson import ObjectId
from bson.errors import InvalidId
from fastapi import APIRouter, Depends, HTTPException, Query, Response, status
from pymongo.collation import Collation

from app.database import get_database
from app.dependencies.auth import require_sales_or_admin
from app.services import zone_tree
from app.models.auth import User
from app.models.route_management import RouteCreate, RouteUpdate, RouteResponse, RouteStopDetail
from app.utils import convert_objectid_to_str

router = APIRouter(prefix="/api/routes", tags=["routes"])
logger = logging.getLogger(__name__)

_PACIFIC = ZoneInfo("America/Vancouver")


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


def _person_name(doc: dict) -> Optional[str]:
    if not doc:
        return None
    return f"{doc.get('first_name', '')} {doc.get('last_name', '')}".strip() or doc.get("email")


async def _build_route_responses(db, docs: List[dict]) -> List[RouteResponse]:
    """Build responses for a page of routes using four queries in total.

    Doing this per row meant one user + one zone lookup per route plus two more
    per stop — a 20-route page issued a few hundred sequential round trips.
    """
    user_ids, zone_ids, business_ids = set(), set(), set()
    for doc in docs:
        if doc.get("assigned_to"):
            user_ids.add(doc["assigned_to"])
        if doc.get("zone_id"):
            zone_ids.add(doc["zone_id"])
        for stop in doc.get("stops", []):
            business_ids.add(stop["business_id"])

    businesses = await _fetch_by_ids(db.businesses, business_ids)
    users = await _fetch_by_ids(db.users, user_ids)
    zones = await _fetch_by_ids(db.zones, zone_ids)
    # Parents complete the zone path for subzones.
    parent_ids = {z.get("parent_id") for z in zones.values() if z.get("parent_id")}
    zones.update(await _fetch_by_ids(db.zones, parent_ids - set(zones)))

    # The visit written up at each stop, keyed by (route, business). Ascending
    # sort means a later visit overwrites an earlier one, keeping the latest.
    visits: dict = {}
    route_ids = [doc["id"] for doc in docs]
    if route_ids:
        cursor = db.visits.find({"route_id": {"$in": route_ids}}).sort("visited_at", 1)
        async for v in cursor:
            visits[(v["route_id"], v["business_id"])] = v

    responses = []
    for doc in docs:
        stop_details = []
        for stop in doc.get("stops", []):
            detail = RouteStopDetail(
                business_id=stop["business_id"],
                order=stop["order"],
                completed=stop.get("completed", False),
                completed_at=stop.get("completed_at"),
            )
            biz = businesses.get(stop["business_id"])
            if biz:
                detail.company_name = biz.get("company_name")
                detail.google_maps_link = biz.get("google_maps_link")
                detail.interest_level = biz.get("interest_level", "cold")
                detail.address = biz.get("address")
                detail.phone = biz.get("phone")
                detail.notes = biz.get("notes")
            visit = visits.get((doc["id"], stop["business_id"]))
            if visit:
                detail.visit_id = str(visit["_id"])
                detail.visit_notes = visit.get("notes")
                detail.follow_up_date = visit.get("follow_up_date")
                detail.follow_up_note = visit.get("follow_up_note")
            stop_details.append(detail)

        route_zone = zones.get(doc.get("zone_id"))
        responses.append(RouteResponse(
            id=doc["id"],
            name=doc.get("name"),
            date=doc["date"],
            zone_id=doc.get("zone_id"),
            zone_name=route_zone["name"] if route_zone else None,
            zone_path=zone_tree.zone_path(doc.get("zone_id"), zones),
            stops=stop_details,
            stops_total=len(stop_details),
            stops_completed=sum(1 for s in stop_details if s.completed),
            assigned_to=doc["assigned_to"],
            assigned_to_name=_person_name(users.get(doc["assigned_to"])),
            dismissed=bool(doc.get("dismissed")),
            saved_route_id=doc.get("saved_route_id"),
            created_by=doc["created_by"],
            created_at=doc["created_at"],
            updated_at=doc["updated_at"],
        ))
    return responses


async def _build_route_response(db, doc: dict) -> RouteResponse:
    """Single-route convenience wrapper around the batch builder."""
    return (await _build_route_responses(db, [doc]))[0]


async def _validate_route_zone(db, zone_id) -> None:
    """Shared by create and update — update previously accepted any string."""
    if not zone_id:
        return
    try:
        zone = await db.zones.find_one({"_id": ObjectId(zone_id)})
    except Exception:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid zone_id")
    if not zone:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Zone not found")


# /today MUST be defined before /{route_id} to avoid matching "today" as an ID
@router.get("/today", response_model=List[RouteResponse])
async def get_today_route(current_user: User = Depends(require_sales_or_admin)):
    """Get today's routes.
    Sales reps: returns their own route (0 or 1 item).
    Admins: returns all routes for today across all reps.
    """
    db = get_database()
    # Route dates are shop-local, so "today" must be Pacific — a UTC server would
    # roll over to tomorrow at 5pm Pacific and drop the rep's route mid-shift.
    today_str = datetime.now(_PACIFIC).strftime("%Y-%m-%d")

    # Dismissed runs leave the runner but stay in the run history list.
    query: dict = {"date": today_str, "dismissed": {"$ne": True}}
    if current_user.role == "sales":
        query["assigned_to"] = current_user.id

    docs = []
    async for doc in db.routes.find(query).sort("created_at", -1):
        doc = convert_objectid_to_str(doc)
        doc["id"] = doc.pop("_id")
        docs.append(doc)
    return await _build_route_responses(db, docs)


# Whitelist of sortable columns → the field the pipeline sorts on. Progress and
# stop count are computed, since neither is stored on the route document.
ROUTE_SORT_FIELDS = {
    "date": "date",
    "name": "name",
    "assigned_to_name": "_rep_name",
    "progress": "_progress",
}

_CASE_INSENSITIVE = Collation(locale="en", strength=2)


@router.get("/", response_model=List[RouteResponse])
async def list_routes(
    response: Response,
    date_filter: Optional[str] = Query(None, alias="date"),
    assigned_to: Optional[str] = None,
    zone_id: Optional[str] = None,
    skip: int = Query(default=0, ge=0),
    limit: int = Query(default=50, ge=1, le=100),
    sort_by: str = Query(default="date"),
    sort_dir: str = Query(default="desc", pattern="^(asc|desc)$"),
    current_user: User = Depends(require_sales_or_admin),
):
    """List routes. Sales reps see only their own; admins see all.

    Sorting is server-side because the list is paginated — sorting only the
    current page would silently misrepresent the rest of the result set.
    """
    db = get_database()
    query: dict = {}

    if current_user.role == "sales":
        query["assigned_to"] = current_user.id
    elif assigned_to:
        query["assigned_to"] = assigned_to

    if date_filter:
        query["date"] = date_filter
    if zone_id:
        # Includes routes tagged to this zone's children, which is what lets a
        # parent zone show all the routes inside it without a new endpoint.
        query["zone_id"] = {"$in": await zone_tree.scope_ids(db, zone_id)}

    if sort_by not in ROUTE_SORT_FIELDS:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Cannot sort by '{sort_by}'. Allowed: {', '.join(sorted(ROUTE_SORT_FIELDS))}",
        )
    sort_key = ROUTE_SORT_FIELDS[sort_by]
    direction = 1 if sort_dir == "asc" else -1

    total = await db.routes.count_documents(query)
    response.headers["X-Total-Count"] = str(total)
    response.headers["Access-Control-Expose-Headers"] = "X-Total-Count"

    pipeline = [
        {"$match": query},
        # assigned_to is a string id, so compare against $toString of the user _id
        # rather than converting the other way (which throws on a malformed id).
        {"$lookup": {
            "from": "users",
            "let": {"uid": "$assigned_to"},
            "pipeline": [
                {"$match": {"$expr": {"$eq": [{"$toString": "$_id"}, "$$uid"]}}},
                {"$project": {"_id": 0, "first_name": 1, "last_name": 1, "email": 1}},
            ],
            "as": "_rep",
        }},
        {"$addFields": {
            "_stops_total": {"$size": {"$ifNull": ["$stops", []]}},
            "_stops_done": {
                "$size": {
                    "$filter": {
                        "input": {"$ifNull": ["$stops", []]},
                        "as": "s",
                        "cond": {"$eq": ["$$s.completed", True]},
                    }
                }
            },
            "_rep_name": {"$arrayElemAt": [
                {"$map": {
                    "input": "$_rep",
                    "as": "r",
                    "in": {"$trim": {"input": {"$concat": [
                        {"$ifNull": ["$$r.first_name", ""]}, " ", {"$ifNull": ["$$r.last_name", ""]},
                    ]}}},
                }}, 0,
            ]},
        }},
        {"$addFields": {
            "_progress": {
                "$cond": [
                    {"$gt": ["$_stops_total", 0]},
                    {"$divide": ["$_stops_done", "$_stops_total"]},
                    0,
                ]
            },
        }},
        {"$project": {"_rep": 0}},
        # _id breaks ties so pagination stays stable across pages.
        {"$sort": {sort_key: direction, "_id": 1}},
        {"$skip": skip},
        {"$limit": limit},
    ]

    docs = []
    async for doc in db.routes.aggregate(pipeline, collation=_CASE_INSENSITIVE):
        for key in ("_stops_total", "_stops_done", "_rep_name", "_progress"):
            doc.pop(key, None)
        doc = convert_objectid_to_str(doc)
        doc["id"] = doc.pop("_id")
        docs.append(doc)
    return await _build_route_responses(db, docs)


@router.post("/", response_model=RouteResponse, status_code=status.HTTP_201_CREATED)
async def create_route(data: RouteCreate, current_user: User = Depends(require_sales_or_admin)):
    """Create a new route. Sales reps can only assign to themselves."""
    db = get_database()

    assigned_to = data.assigned_to
    if current_user.role == "sales":
        assigned_to = current_user.id  # Sales reps can only assign to self
    elif not assigned_to:
        assigned_to = current_user.id  # Admin defaults to self if not specified

    await _validate_route_zone(db, data.zone_id)

    # A run's saved_route_id feeds the team-visible sweep counter, so it must
    # point at a real saved route — not an arbitrary client-supplied string.
    if data.saved_route_id:
        try:
            saved = await db.saved_routes.find_one({"_id": ObjectId(data.saved_route_id)})
        except Exception:
            saved = None
        if not saved:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid saved_route_id")

    now = datetime.utcnow()
    # Runs always start with clean stops — completion happens in the field
    # (complete_stop, visit logging, or an owner's edit), never at creation.
    # Otherwise one crafted POST could mint a fully-completed "sweep".
    stops_data = [s.model_dump() for s in data.stops]
    for stop in stops_data:
        stop["completed"] = False
        stop["completed_at"] = None

    doc = {
        "name": data.name,
        "date": data.date,
        "zone_id": data.zone_id,
        "stops": stops_data,
        "assigned_to": assigned_to,
        "saved_route_id": data.saved_route_id,
        "created_by": current_user.id,
        "created_at": now,
        "updated_at": now,
    }
    result = await db.routes.insert_one(doc)
    created = await db.routes.find_one({"_id": result.inserted_id})
    created = convert_objectid_to_str(created)
    created["id"] = created.pop("_id")
    logger.info(f"Route created for {assigned_to} on {data.date} by {current_user.email}")
    return await _build_route_response(db, created)


@router.put("/{route_id}", response_model=RouteResponse)
async def update_route(route_id: str, data: RouteUpdate, current_user: User = Depends(require_sales_or_admin)):
    """Update a route (reorder stops, change date, etc.)."""
    db = get_database()
    try:
        oid = ObjectId(route_id)
    except Exception:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Route not found")

    doc = await db.routes.find_one({"_id": oid})
    if not doc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Route not found")

    if current_user.role == "sales" and doc["assigned_to"] != current_user.id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Access denied")

    updates: dict = {"updated_at": datetime.utcnow()}
    update_data = data.model_dump(exclude_unset=True)

    if "stops" in update_data and update_data["stops"] is not None:
        update_data["stops"] = [s if isinstance(s, dict) else s.model_dump() for s in (data.stops or [])]

    # Validated on update too — this path used to $set whatever string arrived.
    if "zone_id" in update_data:
        await _validate_route_zone(db, update_data["zone_id"])

    # Mirror create_route: a rep can never hand their route to someone else,
    # and an admin can only assign a real, active account.
    if "assigned_to" in update_data:
        if current_user.role == "sales":
            update_data["assigned_to"] = current_user.id
        else:
            try:
                assignee = await db.users.find_one({"_id": ObjectId(update_data["assigned_to"])})
            except Exception:
                assignee = None
            if not assignee:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Assigned user not found",
                )

    updates.update(update_data)
    await db.routes.update_one({"_id": oid}, {"$set": updates})

    updated = await db.routes.find_one({"_id": oid})
    updated = convert_objectid_to_str(updated)
    updated["id"] = updated.pop("_id")
    return await _build_route_response(db, updated)


@router.delete("/{route_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_route(route_id: str, current_user: User = Depends(require_sales_or_admin)):
    """Delete a route."""
    db = get_database()
    try:
        oid = ObjectId(route_id)
    except Exception:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Route not found")

    doc = await db.routes.find_one({"_id": oid})
    if not doc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Route not found")

    if current_user.role == "sales" and doc["assigned_to"] != current_user.id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Access denied")

    await db.routes.delete_one({"_id": oid})
    logger.info(f"Route {route_id} deleted by {current_user.email}")


@router.patch("/{route_id}/dismiss", response_model=RouteResponse)
async def dismiss_route(route_id: str, current_user: User = Depends(require_sales_or_admin)):
    """Clear a run from today's view without deleting it.

    The run keeps its stops, progress, and place in run history — dismissal
    only excludes it from /today. Deleting is a separate, destructive act.
    """
    db = get_database()
    try:
        oid = ObjectId(route_id)
    except Exception:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Route not found")

    doc = await db.routes.find_one({"_id": oid})
    if not doc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Route not found")

    if current_user.role == "sales" and doc["assigned_to"] != current_user.id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Access denied")

    await db.routes.update_one(
        {"_id": oid},
        {"$set": {"dismissed": True, "updated_at": datetime.utcnow()}}
    )

    updated = await db.routes.find_one({"_id": oid})
    updated = convert_objectid_to_str(updated)
    updated["id"] = updated.pop("_id")
    return await _build_route_response(db, updated)


@router.patch("/{route_id}/stops/{stop_index}/complete", response_model=RouteResponse)
async def complete_stop(route_id: str, stop_index: int, current_user: User = Depends(require_sales_or_admin)):
    """Mark a route stop as completed."""
    db = get_database()
    try:
        oid = ObjectId(route_id)
    except Exception:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Route not found")

    doc = await db.routes.find_one({"_id": oid})
    if not doc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Route not found")

    if current_user.role == "sales" and doc["assigned_to"] != current_user.id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Access denied")

    stops = doc.get("stops", [])
    if stop_index < 0 or stop_index >= len(stops):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid stop index")

    stops[stop_index]["completed"] = True
    stops[stop_index]["completed_at"] = datetime.utcnow()

    await db.routes.update_one(
        {"_id": oid},
        {"$set": {"stops": stops, "updated_at": datetime.utcnow()}}
    )

    # Completing a stop counts as a visit for coverage: zone and saved-route
    # sweep math reads businesses.last_visited_at, so stamp it here too. $max
    # never regresses a newer timestamp from a real logged visit.
    business_id = stops[stop_index].get("business_id")
    if business_id:
        try:
            await db.businesses.update_one(
                {"_id": ObjectId(business_id)},
                {"$max": {"last_visited_at": datetime.utcnow()}},
            )
        except InvalidId:
            pass  # legacy stop with a malformed id must not block completion

    updated = await db.routes.find_one({"_id": oid})
    updated = convert_objectid_to_str(updated)
    updated["id"] = updated.pop("_id")
    return await _build_route_response(db, updated)
