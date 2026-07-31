import logging
from datetime import datetime
from typing import List, Optional

from bson import ObjectId
from fastapi import APIRouter, Depends, HTTPException, status

from app.database import get_database
from app.dependencies.auth import require_sales_or_admin
from app.models.auth import User
from app.models.route_management import (
    SavedRouteCreate,
    SavedRouteUpdate,
    SavedRouteResponse,
    SavedRouteBusiness,
)
from app.services.zone_tree import coverage_cutoff
from app.utils import convert_objectid_to_str

router = APIRouter(prefix="/api/saved-routes", tags=["saved-routes"])
logger = logging.getLogger(__name__)


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


async def _build_responses(db, docs: List[dict]) -> List[SavedRouteResponse]:
    """Populate zone names, member businesses, coverage and sweep counts for a
    page — three queries total, none per row."""
    zone_ids, business_ids = set(), set()
    for doc in docs:
        if doc.get("zone_id"):
            zone_ids.add(doc["zone_id"])
        business_ids.update(doc.get("business_ids", []))

    zones = await _fetch_by_ids(db.zones, zone_ids)
    businesses = await _fetch_by_ids(db.businesses, business_ids)

    # A sweep is a fully-completed run stamped from this saved route. Dismissed
    # runs still count — dismiss only clears Today, the work happened. Runs
    # created before saved_route_id existed simply never match.
    sweeps: dict = {}
    ids = [doc["id"] for doc in docs]
    if ids:
        pipeline = [
            {"$match": {
                "saved_route_id": {"$in": ids},
                "stops.0": {"$exists": True},
                "stops": {"$not": {"$elemMatch": {"completed": {"$ne": True}}}},
            }},
            {"$group": {"_id": "$saved_route_id", "count": {"$sum": 1}}},
        ]
        async for row in db.routes.aggregate(pipeline):
            sweeps[row["_id"]] = row["count"]

    cutoff = coverage_cutoff()
    responses = []
    for doc in docs:
        # A deleted business silently drops out of the list rather than
        # rendering a ghost stop — saved routes stay startable.
        members, covered = [], 0
        for bid in doc.get("business_ids", []):
            biz = businesses.get(bid)
            if biz:
                members.append(SavedRouteBusiness(
                    id=bid,
                    company_name=biz.get("company_name"),
                    interest_level=biz.get("interest_level", "cold"),
                ))
                last_visited = biz.get("last_visited_at")
                if isinstance(last_visited, datetime) and last_visited >= cutoff:
                    covered += 1
        zone = zones.get(doc.get("zone_id"))
        total = len(members)
        responses.append(SavedRouteResponse(
            id=doc["id"],
            name=doc["name"],
            zone_id=doc.get("zone_id"),
            zone_name=zone["name"] if zone else None,
            business_ids=[m.id for m in members],
            businesses=members,
            business_count=total,
            covered_count=covered,
            coverage_pct=round(covered / total * 100) if total else None,
            times_swept=sweeps.get(doc["id"], 0),
            created_by=doc["created_by"],
            created_at=doc["created_at"],
            updated_at=doc["updated_at"],
        ))
    return responses


async def _get_doc_or_404(db, saved_route_id: str) -> dict:
    try:
        oid = ObjectId(saved_route_id)
    except Exception:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Saved route not found")
    doc = await db.saved_routes.find_one({"_id": oid})
    if not doc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Saved route not found")
    return doc


async def _validate_zone(db, zone_id) -> None:
    if not zone_id:
        return
    try:
        zone = await db.zones.find_one({"_id": ObjectId(zone_id)})
    except Exception:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid zone_id")
    if not zone:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Zone not found")


@router.get("/", response_model=List[SavedRouteResponse])
async def list_saved_routes(
    zone_id: Optional[str] = None,
    business_id: Optional[str] = None,
    current_user: User = Depends(require_sales_or_admin),
):
    """List saved routes. They're a shared team library — every rep sees all
    of them; that's what makes "tap any route, any day" work.
    """
    db = get_database()
    query: dict = {}
    if zone_id:
        query["zone_id"] = zone_id
    if business_id:
        query["business_ids"] = business_id

    docs = []
    async for doc in db.saved_routes.find(query).sort("name", 1):
        doc = convert_objectid_to_str(doc)
        doc["id"] = doc.pop("_id")
        docs.append(doc)
    return await _build_responses(db, docs)


@router.post("/", response_model=SavedRouteResponse, status_code=status.HTTP_201_CREATED)
async def create_saved_route(data: SavedRouteCreate, current_user: User = Depends(require_sales_or_admin)):
    db = get_database()
    await _validate_zone(db, data.zone_id)

    now = datetime.utcnow()
    doc = {
        "name": data.name.strip(),
        "zone_id": data.zone_id,
        "business_ids": data.business_ids,
        "created_by": current_user.id,
        "created_at": now,
        "updated_at": now,
    }
    result = await db.saved_routes.insert_one(doc)
    created = await db.saved_routes.find_one({"_id": result.inserted_id})
    created = convert_objectid_to_str(created)
    created["id"] = created.pop("_id")
    logger.info(f"Saved route '{data.name}' created by {current_user.email}")
    return (await _build_responses(db, [created]))[0]


@router.put("/{saved_route_id}", response_model=SavedRouteResponse)
async def update_saved_route(
    saved_route_id: str,
    data: SavedRouteUpdate,
    current_user: User = Depends(require_sales_or_admin),
):
    db = get_database()
    doc = await _get_doc_or_404(db, saved_route_id)

    updates = data.model_dump(exclude_unset=True)
    if "zone_id" in updates:
        await _validate_zone(db, updates["zone_id"])
    if "name" in updates and updates["name"]:
        updates["name"] = updates["name"].strip()
    updates["updated_at"] = datetime.utcnow()

    await db.saved_routes.update_one({"_id": doc["_id"]}, {"$set": updates})
    updated = await db.saved_routes.find_one({"_id": doc["_id"]})
    updated = convert_objectid_to_str(updated)
    updated["id"] = updated.pop("_id")
    return (await _build_responses(db, [updated]))[0]


@router.delete("/{saved_route_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_saved_route(saved_route_id: str, current_user: User = Depends(require_sales_or_admin)):
    """Delete a saved route. Past runs created from it are untouched."""
    db = get_database()
    doc = await _get_doc_or_404(db, saved_route_id)
    await db.saved_routes.delete_one({"_id": doc["_id"]})
    logger.info(f"Saved route {saved_route_id} deleted by {current_user.email}")


@router.post("/{saved_route_id}/businesses/{business_id}", response_model=SavedRouteResponse)
async def add_business(
    saved_route_id: str,
    business_id: str,
    current_user: User = Depends(require_sales_or_admin),
):
    """Append a business to the end of the route (used by the business form's
    route designation chips). $addToSet keeps double-adds harmless.
    """
    db = get_database()
    doc = await _get_doc_or_404(db, saved_route_id)

    try:
        biz = await db.businesses.find_one({"_id": ObjectId(business_id)})
    except Exception:
        biz = None
    if not biz:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Business not found")

    await db.saved_routes.update_one(
        {"_id": doc["_id"]},
        {"$addToSet": {"business_ids": business_id}, "$set": {"updated_at": datetime.utcnow()}},
    )
    updated = await db.saved_routes.find_one({"_id": doc["_id"]})
    updated = convert_objectid_to_str(updated)
    updated["id"] = updated.pop("_id")
    return (await _build_responses(db, [updated]))[0]


@router.delete("/{saved_route_id}/businesses/{business_id}", response_model=SavedRouteResponse)
async def remove_business(
    saved_route_id: str,
    business_id: str,
    current_user: User = Depends(require_sales_or_admin),
):
    db = get_database()
    doc = await _get_doc_or_404(db, saved_route_id)
    await db.saved_routes.update_one(
        {"_id": doc["_id"]},
        {"$pull": {"business_ids": business_id}, "$set": {"updated_at": datetime.utcnow()}},
    )
    updated = await db.saved_routes.find_one({"_id": doc["_id"]})
    updated = convert_objectid_to_str(updated)
    updated["id"] = updated.pop("_id")
    return (await _build_responses(db, [updated]))[0]
