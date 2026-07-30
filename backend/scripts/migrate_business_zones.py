#!/usr/bin/env python3
"""
Migrate businesses from a single `zone_id` to a `zone_ids` array.

A business can now belong to several zones (a shop on a boundary road often gets
worked from either side). This converts each existing `zone_id: "abc"` into
`zone_ids: ["abc"]` and removes the old field.

Safe to run more than once — documents that already have `zone_ids` are skipped.

Usage (from the backend/ directory):

    python scripts/migrate_business_zones.py           # migrate
    python scripts/migrate_business_zones.py --dry-run # report only
"""
import argparse
import asyncio
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent.parent))

from motor.motor_asyncio import AsyncIOMotorClient  # noqa: E402
from app.config import settings  # noqa: E402


async def main() -> int:
    parser = argparse.ArgumentParser(description="Migrate businesses to multi-zone")
    parser.add_argument("--dry-run", action="store_true", help="report what would change")
    parser.add_argument("--yes", action="store_true", help="skip the confirmation prompt")
    args = parser.parse_args()

    print("=" * 62)
    print("CNS Tool Repair — businesses: zone_id → zone_ids")
    print("=" * 62)
    print(f"\n  database: {settings.database_name}")
    print(f"  cluster:  {settings.mongodb_url.split('@')[-1].split('/')[0]}")
    print(f"  mode:     {'dry run' if args.dry_run else 'MIGRATE'}\n")

    if not args.dry_run and not args.yes:
        if input("Type 'yes' to continue: ").strip().lower() != "yes":
            print("Aborted — nothing was changed.")
            return 1

    client = AsyncIOMotorClient(settings.mongodb_url)
    db = client[settings.database_name]
    try:
        await db.command("ping")

        needs = await db.businesses.count_documents(
            {"zone_id": {"$exists": True}, "zone_ids": {"$exists": False}}
        )
        already = await db.businesses.count_documents({"zone_ids": {"$exists": True}})
        orphaned = await db.businesses.count_documents(
            {"zone_id": {"$exists": False}, "zone_ids": {"$exists": False}}
        )

        print(f"  to migrate:      {needs}")
        print(f"  already migrated:{already:>4}")
        if orphaned:
            print(f"  ⚠️  no zone at all:{orphaned:>4} (left as-is, they'll show no zone)")

        if args.dry_run or needs == 0:
            print("\n✅ Nothing written." if args.dry_run else "\n✅ Already up to date.")
            return 0

        # Copy the scalar into a one-element array, then drop the old field.
        result = await db.businesses.update_many(
            {"zone_id": {"$exists": True}, "zone_ids": {"$exists": False}},
            [
                {"$set": {"zone_ids": ["$zone_id"]}},
                {"$unset": "zone_id"},
            ],
        )
        print(f"\n✅ Migrated {result.modified_count} business(es) to zone_ids.")
        return 0
    except Exception as exc:
        print(f"❌ {type(exc).__name__}: {exc}")
        return 1
    finally:
        client.close()


if __name__ == "__main__":
    sys.exit(asyncio.run(main()))
