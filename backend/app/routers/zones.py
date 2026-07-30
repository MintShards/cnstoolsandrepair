import logging
import re
from datetime import datetime
from typing import Dict, List, Optional

from bson import ObjectId
from fastapi import APIRouter, Depends, HTTPException, status

from app.database import get_database
from app.dependencies.auth import require_admin, require_sales_or_admin
from app.models.auth import User
from app.models.route_management import (
    COVERAGE_WINDOW_DAYS, ZoneCreate, ZoneUpdate, ZoneResponse,
)
from app.services import zone_tree
from app.utils import convert_objectid_to_str

router = APIRouter(prefix="/api/zones", tags=["zones"])
logger = logging.getLogger(__name__)

_EMPTY_STATS = {"total": 0, "covered": 0, "direct": 0}


async def _zone_stats(db) -> Dict[str, dict]:
    """Business and coverage counts keyed by zone id, for every zone at once.

    A business counts toward its own zones *and* those zones' parents. Building
    that scope set with ``$setUnion`` before the ``$unwind`` is what makes a
    parent's count distinct: a business filed under two children of the same
    parent contributes to that parent exactly once, structurally, rather than
    relying on anyone remembering to de-duplicate downstream.

    Grouping on the literal zone id (as this used to) would report 0 for any
    parent that holds only child zones.
    """
    cutoff = zone_tree.coverage_cutoff()
    pipeline = [
        {"$addFields": {"_zids": {"$ifNull": ["$zone_ids", []]}}},
        # Same $toString join pattern as the businesses list: zone_ids holds
        # strings, and converting the other way throws on a malformed id.
        {"$lookup": {
            "from": "zones",
            "let": {"zids": "$_zids"},
            "pipeline": [
                {"$match": {"$expr": {"$in": [{"$toString": "$_id"}, "$$zids"]}}},
                {"$project": {"_id": 0, "parent_id": 1}},
            ],
            "as": "_zdocs",
        }},
        {"$addFields": {
            # $filter is needed because "$_zdocs.parent_id" skips documents where
            # the field is missing (legacy zones) but keeps explicit nulls.
            "_scopes": {"$setUnion": [
                "$_zids",
                {"$filter": {
                    "input": "$_zdocs.parent_id",
                    "as": "p",
                    "cond": {"$ne": ["$$p", None]},
                }},
            ]},
            # Never-visited is NOT covered, and stays in the denominator —
            # otherwise a zone of untouched prospects would report 100%.
            "_covered": {"$and": [
                {"$ne": ["$last_visited_at", None]},
                {"$gte": ["$last_visited_at", cutoff]},
            ]},
        }},
        {"$facet": {
            "scoped": [
                {"$unwind": "$_scopes"},
                {"$group": {
                    "_id": "$_scopes",
                    "total": {"$sum": 1},
                    "covered": {"$sum": {"$cond": ["$_covered", 1, 0]}},
                }},
            ],
            "direct": [
                {"$unwind": "$_zids"},
                {"$group": {"_id": "$_zids", "n": {"$sum": 1}}},
            ],
        }},
    ]

    stats: Dict[str, dict] = {}
    async for facet in db.businesses.aggregate(pipeline):
        for row in facet.get("scoped", []):
            stats.setdefault(row["_id"], dict(_EMPTY_STATS))
            stats[row["_id"]]["total"] = row["total"]
            stats[row["_id"]]["covered"] = row["covered"]
        for row in facet.get("direct", []):
            stats.setdefault(row["_id"], dict(_EMPTY_STATS))
            stats[row["_id"]]["direct"] = row["n"]
    return stats


def _build_zone_response(
    doc: dict,
    stats: Optional[dict] = None,
    child_count: int = 0,
) -> ZoneResponse:
    stats = stats or _EMPTY_STATS
    total = stats.get("total", 0)
    covered = stats.get("covered", 0)
    return ZoneResponse(
        id=doc["id"],
        name=doc["name"],
        description=doc.get("description"),
        parent_id=doc.get("parent_id"),
        child_count=child_count,
        business_count=total,
        direct_business_count=stats.get("direct", 0),
        covered_count=covered,
        # Undefined rather than 0% when there's nothing to cover.
        coverage_pct=round(covered / total * 100) if total else None,
        coverage_window_days=COVERAGE_WINDOW_DAYS,
        created_at=doc["created_at"],
        updated_at=doc["updated_at"],
    )


async def _build_zone_responses(db, docs: List[dict]) -> List[ZoneResponse]:
    """Assemble responses for a set of zones with a fixed number of queries."""
    stats = await _zone_stats(db)

    # Child counts for every zone in one pass over the collection.
    child_counts: Dict[str, int] = {}
    async for row in db.zones.aggregate([
        {"$match": {"parent_id": {"$ne": None}}},
        {"$group": {"_id": "$parent_id", "n": {"$sum": 1}}},
    ]):
        child_counts[row["_id"]] = row["n"]

    return [
        _build_zone_response(
            doc,
            stats=stats.get(doc["id"]),
            child_count=child_counts.get(doc["id"], 0),
        )
        for doc in docs
    ]


async def _assert_valid_parent(db, parent_id: Optional[str], zone_id: Optional[str]) -> None:
    """Enforce the two-level invariant.

    Rules (b) and (d) together *are* the invariant — a child may not hold
    children, and a zone that holds children may not become a child — so no cycle
    detection or recursive walk is needed.
    """
    if not parent_id:
        return

    # (c) self-parent — checked first so a childless zone naming itself doesn't
    # fall through to (b) and report a confusing message about its own parent.
    if zone_id and parent_id == zone_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="A zone can't be inside itself.",
        )

    try:
        parent = await db.zones.find_one({"_id": ObjectId(parent_id)})
    except Exception:
        parent = None
    # (a) parent exists
    if not parent:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="That parent zone doesn't exist.",
        )
    # (b) the parent must itself be top-level
    if parent.get("parent_id"):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=(
                f"Zones only nest one level deep — {parent['name']} is already inside "
                "another zone, so it can't hold zones of its own."
            ),
        )
    # (d) the zone being moved must not itself have children
    if zone_id:
        kids = await db.zones.count_documents({"parent_id": zone_id})
        if kids:
            zone = await db.zones.find_one({"_id": ObjectId(zone_id)})
            name = zone["name"] if zone else "This zone"
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=(
                    f"{name} has {kids} zone{'s' if kids != 1 else ''} inside it, so it "
                    "can't be moved inside another zone. Move those out first."
                ),
            )


async def _assert_name_free(db, name: str, parent_id: Optional[str], exclude_id: Optional[str] = None) -> None:
    """Names are unique per parent, so "Downtown" can exist under two parents."""
    query: dict = {
        "name": {"$regex": f"^{re.escape(name.strip())}$", "$options": "i"},
        "parent_id": parent_id,
    }
    if exclude_id:
        query["_id"] = {"$ne": ObjectId(exclude_id)}
    if await db.zones.find_one(query):
        where = "inside that parent zone" if parent_id else "at the top level"
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"A zone called \"{name.strip()}\" already exists {where}.",
        )


async def _load_zone(db, zone_id: str) -> dict:
    """Fetch one zone as a response-shaped dict, or 404."""
    try:
        oid = ObjectId(zone_id)
    except Exception:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Zone not found")
    doc = await db.zones.find_one({"_id": oid})
    if not doc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Zone not found")
    doc = convert_objectid_to_str(doc)
    doc["id"] = doc.pop("_id")
    return doc


@router.get("/", response_model=List[ZoneResponse])
async def list_zones(current_user: User = Depends(require_sales_or_admin)):
    """List every zone, flat and unpaginated.

    Deliberately returns the whole set: the four zone pickers in the UI build
    their parent/child grouping from this one response, so paginating it would
    drag a paging story into every dropdown.
    """
    db = get_database()
    docs = []
    async for doc in db.zones.find({}).sort("name", 1):
        doc = convert_objectid_to_str(doc)
        doc["id"] = doc.pop("_id")
        docs.append(doc)
    return await _build_zone_responses(db, docs)


@router.post("/", response_model=ZoneResponse, status_code=status.HTTP_201_CREATED)
async def create_zone(data: ZoneCreate, current_user: User = Depends(require_admin)):
    """Create a new geographic zone, optionally inside a parent."""
    db = get_database()

    await _assert_valid_parent(db, data.parent_id, None)
    await _assert_name_free(db, data.name, data.parent_id)

    now = datetime.utcnow()
    doc = {
        "name": data.name.strip(),
        "description": data.description,
        "parent_id": data.parent_id,
        "created_at": now,
        "updated_at": now,
    }
    result = await db.zones.insert_one(doc)
    created = await _load_zone(db, str(result.inserted_id))
    logger.info(f"Zone created: {created['name']} by {current_user.email}")
    return (await _build_zone_responses(db, [created]))[0]


@router.put("/{zone_id}", response_model=ZoneResponse)
async def update_zone(zone_id: str, data: ZoneUpdate, current_user: User = Depends(require_admin)):
    """Update a zone's name, description, or which parent it sits in."""
    db = get_database()
    zone = await _load_zone(db, zone_id)
    oid = ObjectId(zone_id)

    updates: dict = {"updated_at": datetime.utcnow()}
    update_data = data.model_dump(exclude_unset=True)

    # Keyed on presence, not None: an explicit null promotes a child to top-level.
    moving = "parent_id" in update_data
    target_parent = update_data["parent_id"] if moving else zone.get("parent_id")
    if moving:
        await _assert_valid_parent(db, update_data["parent_id"], zone_id)
        updates["parent_id"] = update_data["parent_id"]

    # Re-checked against the *new* scope: promoting a child "Downtown" to
    # top-level has to collide with an existing top-level "Downtown".
    if data.name is not None or moving:
        await _assert_name_free(db, data.name or zone["name"], target_parent, exclude_id=zone_id)
    if data.name is not None:
        updates["name"] = data.name.strip()

    # Keyed on presence, not None: a blank description is how the UI clears it.
    if "description" in update_data:
        updates["description"] = update_data["description"]

    await db.zones.update_one({"_id": oid}, {"$set": updates})
    updated = await _load_zone(db, zone_id)
    return (await _build_zone_responses(db, [updated]))[0]


@router.delete("/{zone_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_zone(zone_id: str, current_user: User = Depends(require_admin)):
    """Delete a zone, refusing while anything still references it."""
    db = get_database()
    await _load_zone(db, zone_id)
    oid = ObjectId(zone_id)

    # Checks all three references. Previously only businesses were counted, so a
    # parent holding just child zones passed the guard and orphaned them, and a
    # zone still used by routes could be deleted outright. Because it refuses
    # outright when children exist, it never has to look deeper than one level.
    children = await db.zones.count_documents({"parent_id": zone_id})
    businesses = await db.businesses.count_documents({"zone_ids": zone_id})
    routes = await db.routes.count_documents({"zone_id": zone_id})

    if children or businesses or routes:
        pieces = []
        if children:
            pieces.append(f"{children} zone{'s' if children != 1 else ''} inside it")
        if businesses:
            pieces.append(f"{businesses} business{'es' if businesses != 1 else ''}")
        if routes:
            pieces.append(f"{routes} route{'s' if routes != 1 else ''}")
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"Can't remove this zone — it still has {' and '.join(pieces)}. Remove those first.",
        )

    await db.zones.delete_one({"_id": oid})
    logger.info(f"Zone deleted: {zone_id} by {current_user.email}")
