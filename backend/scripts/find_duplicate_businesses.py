#!/usr/bin/env python3
"""List businesses whose names collide ignoring case and whitespace runs.

The API now refuses to create or rename into a duplicate, but rows that were
already duplicated before that check (or inserted by scripts) stay. This only
READS — merge or delete survivors by hand in the UI.

Usage (prod):  docker exec cns-backend-prod python scripts/find_duplicate_businesses.py
"""

import asyncio
import sys
from collections import defaultdict
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent.parent))

from app.database import get_database, connect_to_mongo, close_mongo_connection


def name_key(name: str) -> str:
    return " ".join((name or "").split()).lower()


async def main():
    from app.config import settings
    print(f"Scanning businesses for duplicate names — db: {settings.database_name}")

    await connect_to_mongo()
    try:
        db = get_database()
        groups = defaultdict(list)
        async for doc in db.businesses.find({}, {"company_name": 1, "zone_ids": 1, "customer_id": 1, "visit_count": 1}):
            groups[name_key(doc.get("company_name"))].append(doc)

        dupes = {k: v for k, v in groups.items() if len(v) > 1}
        if not dupes:
            print("✓ No duplicate business names found.")
            return

        print(f"\n⚠ {len(dupes)} duplicated name{'s' if len(dupes) != 1 else ''}:")
        for docs in dupes.values():
            print()
            for d in docs:
                linked = " · linked to a customer" if d.get("customer_id") else ""
                visits = d.get("visit_count") or 0
                print(f"  {d['company_name']!r:45} id={d['_id']}  visits={visits}{linked}")
        print(
            "\nKeep the row with the visit history / customer link, move its zones"
            "\nand saved-route memberships over if needed, then delete the other."
        )
    finally:
        await close_mongo_connection()


if __name__ == "__main__":
    asyncio.run(main())
