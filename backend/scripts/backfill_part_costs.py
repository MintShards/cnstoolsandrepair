"""Give every job part that is linked to the parts library, but carries no
cost of its own, the library part's cost.

Job accounting counts a tool's installed parts at `cost` (what the shop paid).
New and edited parts get that snapshot on save; this fills the parts saved
before the field existed. Dry run by default: prints what it would set and
changes nothing. Pass --apply to write.

    python scripts/backfill_part_costs.py            # dry run
    python scripts/backfill_part_costs.py --apply    # write
"""
import asyncio
import os
import sys

from bson import ObjectId

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.database import connect_to_mongo, close_mongo_connection, get_database  # noqa: E402


async def main(apply: bool) -> None:
    await connect_to_mongo()
    try:
        db = get_database()
        # One pass over the library, so each job needs no lookups of its own.
        costs = {}
        async for lp in db.parts_library_parts.find({"cost": {"$ne": None}}, {"cost": 1}):
            costs[str(lp["_id"])] = lp["cost"]
        print(f"{len(costs)} library part(s) carry a cost")

        planned = 0
        no_library_cost = 0
        async for job in db.repairs.find({"tools.parts.library_part_id": {"$exists": True}}, {"request_number": 1, "tools": 1}):
            set_ops = {}
            for ti, tool in enumerate(job.get("tools") or []):
                for pi, part in enumerate(tool.get("parts") or []):
                    if part.get("cost") is not None or not part.get("library_part_id"):
                        continue
                    cost = costs.get(part["library_part_id"])
                    if cost is None:
                        no_library_cost += 1
                        continue
                    set_ops[f"tools.{ti}.parts.{pi}.cost"] = cost
                    planned += 1
                    print(f"  {job.get('request_number')} tool[{ti}] {part.get('name')}: cost {cost}")
            if apply and set_ops:
                await db.repairs.update_one({"_id": ObjectId(job["_id"])}, {"$set": set_ops})
        mode = "APPLIED" if apply else "DRY RUN"
        print(f"{mode}: {planned} part(s) get a cost; {no_library_cost} linked part(s) have no cost in the library")
        if not apply and planned:
            print("Re-run with --apply to write these changes.")
    finally:
        await close_mongo_connection()


if __name__ == "__main__":
    asyncio.run(main(apply="--apply" in sys.argv[1:]))
