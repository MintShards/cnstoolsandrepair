#!/usr/bin/env python3
"""
Seed the Tools for Sale catalogue.

Loads scripts/data/products_seed.json into the `products` collection. Matching
is by SKU, so re-running is safe: existing entries are updated in place and
nothing the shop edited in Admin Settings gets duplicated.

Photos are already hosted on Spaces, so this script does no uploading — it only
writes documents.

Usage:
    python scripts/seed_products.py            # add missing, update existing
    python scripts/seed_products.py --dry-run  # show what would change
    python scripts/seed_products.py --new-only # never touch existing entries
"""

import asyncio
import json
import sys
from pathlib import Path

# Add parent directory to path for imports
sys.path.insert(0, str(Path(__file__).parent.parent))

from motor.motor_asyncio import AsyncIOMotorClient
from app.config import settings

SEED_FILE = Path(__file__).parent / "data" / "products_seed.json"

# Fields the seed owns. Anything else on an existing document is left alone.
SEED_FIELDS = [
    "brand", "model", "name", "category", "product_group",
    "spec_line", "description", "image_url", "featured",
    "active", "display_order",
]


async def main():
    dry_run = "--dry-run" in sys.argv
    new_only = "--new-only" in sys.argv

    print("\n" + "=" * 60)
    print("SEED TOOLS FOR SALE CATALOGUE")
    print("=" * 60)
    print(f"\nDatabase: {settings.database_name}")
    if dry_run:
        print("Mode:     DRY RUN (no writes)")
    elif new_only:
        print("Mode:     NEW ONLY (existing products untouched)")

    products = json.loads(SEED_FILE.read_text(encoding="utf-8"))
    print(f"Seed file: {len(products)} products")

    client = AsyncIOMotorClient(settings.mongodb_url, serverSelectionTimeoutMS=10000)
    db = client[settings.database_name]

    try:
        await client.admin.command("ping")
        print("Connected to MongoDB\n")

        created = updated = skipped = 0

        for product in products:
            sku = product["sku"]
            doc = {field: product[field] for field in SEED_FIELDS}
            doc["sku"] = sku

            existing = await db.products.find_one({"sku": sku})

            if existing and new_only:
                skipped += 1
                continue

            if existing:
                changes = [f for f in SEED_FIELDS if existing.get(f) != doc[f]]
                if not changes:
                    skipped += 1
                    continue
                print(f"  update {sku}  {product['name'][:48]:<48} ({', '.join(changes)})")
                if not dry_run:
                    await db.products.update_one({"_id": existing["_id"]}, {"$set": doc})
                updated += 1
            else:
                print(f"  create {sku}  {product['name'][:48]}")
                if not dry_run:
                    await db.products.insert_one(doc)
                created += 1

        print(f"\nCreated {created} · updated {updated} · unchanged {skipped}")

        total = await db.products.count_documents({})
        live = await db.products.count_documents({"active": True})
        print(f"Catalogue now holds {total} products ({live} live on the website)")

    finally:
        client.close()


if __name__ == "__main__":
    asyncio.run(main())
