#!/usr/bin/env python3
"""Rename Hathorn component fields: rod_holder_model/_serial -> reel_model/_serial.

Training vocabulary calls the third component the Reel, so code and data both
use reel_*. This migrates existing repair documents. Values move to the new
key unchanged — nothing is deleted. MongoDB's $rename can't reach fields
inside the tools array, hence the per-document rewrite.

Run it against whichever database backend/.env points at. On the droplet:
    docker exec cns-backend-prod python scripts/migrate_reel_fields.py            # dry run
    docker exec cns-backend-prod python scripts/migrate_reel_fields.py --apply

Usage:
    python scripts/migrate_reel_fields.py           # dry run: list affected docs
    python scripts/migrate_reel_fields.py --apply   # perform the rename
"""

import asyncio
import sys
from pathlib import Path

# Add parent directory to path for imports
sys.path.insert(0, str(Path(__file__).parent.parent))

from app.database import connect_to_mongo, close_mongo_connection, get_database  # noqa: E402

APPLY = "--apply" in sys.argv
OLD_TO_NEW = (("rod_holder_model", "reel_model"), ("rod_holder_serial", "reel_serial"))
QUERY = {"$or": [
    {"tools.rod_holder_model": {"$exists": True}},
    {"tools.rod_holder_serial": {"$exists": True}},
]}


async def main():
    await connect_to_mongo()
    db = get_database()
    print(f"database: {db.name}")
    docs = [d async for d in db.repairs.find(QUERY)]
    print(f"docs holding old keys: {len(docs)}")
    for job in docs:
        for t in job.get("tools", []):
            olds = {k: t[k] for k, _ in OLD_TO_NEW if k in t}
            if olds:
                print(f"  {job.get('request_number')} tool={t.get('brand')} {olds}")

    if not APPLY:
        print("dry run only — nothing modified. Re-run with --apply to migrate.")
    else:
        migrated = 0
        for job in docs:
            tools = job.get("tools", [])
            changed = False
            for t in tools:
                for old, new in OLD_TO_NEW:
                    if old in t:
                        t[new] = t.pop(old)
                        changed = True
            if changed:
                await db.repairs.update_one({"_id": job["_id"]}, {"$set": {"tools": tools}})
                migrated += 1
        remaining = await db.repairs.count_documents(QUERY)
        print(f"migrated {migrated} docs; docs still holding old keys: {remaining}")
        async for job in db.repairs.find({"$or": [
            {"tools.reel_model": {"$exists": True}},
            {"tools.reel_serial": {"$exists": True}},
        ]}):
            for t in job.get("tools", []):
                if "reel_model" in t or "reel_serial" in t:
                    print(f"  after: {job.get('request_number')} reel_model={t.get('reel_model')} reel_serial={t.get('reel_serial')}")

    await close_mongo_connection()


asyncio.run(main())
