#!/usr/bin/env python3
"""
Set where a number series starts.

Quote, request and work-order numbers all come from the `counters`
collection (see app/database.py). This moves one of them forward so the
next number issued is the one you ask for — handy for starting a series at
a round number instead of 0001.

Only moves forward. Lowering a counter would hand out a number that already
exists, so it is refused unless you pass --force.

Usage:
    python scripts/set_counter.py --list
    python scripts/set_counter.py --counter product_quote --start 100 --dry-run
    python scripts/set_counter.py --counter product_quote --start 100
"""

import argparse
import asyncio
import sys
from datetime import datetime, timezone
from pathlib import Path

# Add parent directory to path for imports
sys.path.insert(0, str(Path(__file__).parent.parent))

from motor.motor_asyncio import AsyncIOMotorClient
from app.config import settings

# counter name -> the prefix it produces, for readable output
PREFIXES = {
    "product_quote": "PQ",
    "request": "REQ",
    "workorder": "WO",
}


async def main():
    parser = argparse.ArgumentParser(description="Set where a number series starts")
    parser.add_argument("--counter", choices=sorted(PREFIXES), help="which series to move")
    parser.add_argument("--start", type=int, help="the next number to be issued")
    parser.add_argument("--year", type=int, default=datetime.now(timezone.utc).year)
    parser.add_argument("--list", action="store_true", help="show every counter and exit")
    parser.add_argument("--dry-run", action="store_true", help="show the change without writing")
    parser.add_argument("--force", action="store_true", help="allow moving a counter backwards")
    args = parser.parse_args()

    client = AsyncIOMotorClient(settings.mongodb_url, serverSelectionTimeoutMS=10000)
    db = client[settings.database_name]

    try:
        await client.admin.command("ping")
        print(f"\nDatabase: {settings.database_name}\n")

        if args.list or not args.counter:
            counters = await db.counters.find({}).to_list(length=None)
            if not counters:
                print("  (no counters yet — they are created on first use)")
            for c in sorted(counters, key=lambda x: x["_id"]):
                print(f"  {c['_id']:<28} seq={c.get('seq')}")
            if not args.counter:
                print("\nPass --counter and --start to move one.")
            return

        if args.start is None or args.start < 1:
            parser.error("--start must be a positive number")

        counter_id = f"{args.counter}_{args.year}"
        prefix = PREFIXES[args.counter]
        new_seq = args.start - 1

        existing = await db.counters.find_one({"_id": counter_id})
        current_seq = existing.get("seq", 0) if existing else 0
        next_now = f"{prefix}-{args.year}-{current_seq + 1:04d}"
        next_after = f"{prefix}-{args.year}-{args.start:04d}"

        print(f"  counter:      {counter_id}")
        print(f"  next number:  {next_now}  ->  {next_after}")

        if new_seq < current_seq and not args.force:
            print(
                f"\nRefusing to move backwards: {next_after} was already issued.\n"
                "Re-run with --force only if you are certain no record uses it."
            )
            return

        if args.dry_run:
            print("\nDry run — nothing written.")
            return

        await db.counters.update_one(
            {"_id": counter_id},
            {"$set": {"seq": new_seq}},
            upsert=True,
        )

        confirmed = await db.counters.find_one({"_id": counter_id})
        print(f"\nDone. seq={confirmed['seq']}, so the next one issued is {next_after}")

    finally:
        client.close()


if __name__ == "__main__":
    asyncio.run(main())
