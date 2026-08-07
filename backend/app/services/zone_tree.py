"""Helpers for the two-level zone hierarchy.

Zones nest exactly one level: a top-level zone has no ``parent_id``, a child
points at its parent. The routers that filter by zone need "which zone ids
count as *this* zone", so that logic lives here rather than being duplicated
per router.

Legacy note: zones created before the hierarchy have no ``parent_id`` field at
all. Mongo's ``{"parent_id": None}`` matches missing fields as well as explicit
nulls, so those zones are already valid top-level zones with no migration. Any
index on ``parent_id`` must therefore be plain, never sparse.
"""
from datetime import datetime, timedelta
from typing import List

from app.models.route_management import COVERAGE_WINDOW_DAYS


def coverage_cutoff() -> datetime:
    """Visits at or after this instant count as coverage (naive UTC, as stored)."""
    return datetime.utcnow() - timedelta(days=COVERAGE_WINDOW_DAYS)


def zone_path(zone_id, zones: dict):
    """'Parent › Child' for a subzone, the zone's own name otherwise — a
    subzone's name alone can't tell which zone it sits under.

    ``zones`` is a prefetched {id: zone doc} map that must already contain the
    parent for the path to include it.
    """
    zone = zones.get(zone_id)
    if not zone:
        return None
    parent = zones.get(zone.get("parent_id"))
    return f"{parent['name']} › {zone['name']}" if parent else zone["name"]


async def child_ids(db, zone_id: str) -> List[str]:
    """Ids of the zones directly inside ``zone_id`` (one level only)."""
    cursor = db.zones.find({"parent_id": zone_id}, {"_id": 1})
    return [str(doc["_id"]) async for doc in cursor]


async def scope_ids(db, zone_id: str) -> List[str]:
    """The zone itself plus its children.

    Filtering by a parent should return everything inside it, so every zone
    filter runs through this. On a flat database it returns ``[zone_id]`` and the
    behaviour is identical to before the hierarchy existed.
    """
    return [zone_id] + await child_ids(db, zone_id)
