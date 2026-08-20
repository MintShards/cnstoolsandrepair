#!/usr/bin/env python3
"""
Backfill coverage for route stops marked done before the stamp-on-complete fix.

Completing a stop now stamps businesses.last_visited_at (commit ea0739c), but
stops completed before that deploy never stamped anything, so zone and
saved-route coverage bars undercount them. This walks every dated route,
takes each business's newest completed_at, and raises last_visited_at to it
when the stored value is older or missing. Uses the historical completed_at,
never "now", and never regresses a newer real visit — safe to re-run.

Usage:
    python scripts/backfill_completed_visits.py            # apply
    python scripts/backfill_completed_visits.py --dry-run  # report only
"""

import asyncio
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent.parent))

from bson import ObjectId
from bson.errors import InvalidId

from app.database import get_database, connect_to_mongo, close_mongo_connection


async def backfill(dry_run: bool) -> None:
    db = get_database()

    newest_done: dict[str, object] = {}
    async for route in db.routes.find({}, {"stops": 1}):
        for stop in route.get("stops", []):
            if not stop.get("completed"):
                continue
            business_id = stop.get("business_id")
            completed_at = stop.get("completed_at")
            if not business_id or completed_at is None:
                continue
            current = newest_done.get(business_id)
            if current is None or completed_at > current:
                newest_done[business_id] = completed_at

    print(f"Businesses with completed stops: {len(newest_done)}")

    stamped = skipped = missing = 0
    for business_id, completed_at in newest_done.items():
        try:
            oid = ObjectId(business_id)
        except InvalidId:
            missing += 1
            continue
        biz = await db.businesses.find_one({"_id": oid}, {"last_visited_at": 1, "company_name": 1})
        if biz is None:
            missing += 1
            continue
        last_visited = biz.get("last_visited_at")
        if last_visited is not None and last_visited >= completed_at:
            skipped += 1
            continue
        if dry_run:
            print(f"  would stamp: {biz.get('company_name', business_id)} -> {completed_at}")
        else:
            await db.businesses.update_one(
                {"_id": oid}, {"$max": {"last_visited_at": completed_at}}
            )
        stamped += 1

    label = "would stamp" if dry_run else "stamped"
    print(f"{label}: {stamped}, already newer: {skipped}, missing/deleted: {missing}")


async def main() -> None:
    dry_run = "--dry-run" in sys.argv
    await connect_to_mongo()
    try:
        await backfill(dry_run)
    finally:
        await close_mongo_connection()


if __name__ == "__main__":
    asyncio.run(main())
