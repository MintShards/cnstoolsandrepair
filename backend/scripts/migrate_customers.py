#!/usr/bin/env python3
"""
Customer Migration Script

Extracts embedded customer data from existing repair jobs and creates
customer profile documents in the customers collection. Updates each
repair job with a customer_id reference.

Safe to run multiple times (idempotent).

Usage:
    python scripts/migrate_customers.py
"""

import asyncio
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent.parent))

from app.database import get_database, connect_to_mongo, close_mongo_connection
from datetime import datetime


async def migrate():
    db = get_database()

    print("\n" + "=" * 60)
    print("CUSTOMER MIGRATION")
    print("=" * 60)

    # Find all repair jobs without a customer_id
    cursor = db.repairs.find({"customer_id": {"$exists": False}})
    jobs = await cursor.to_list(length=10000)

    print(f"\nFound {len(jobs)} repair job(s) without customer_id")

    if not jobs:
        print("Nothing to migrate.")
        return

    linked = 0
    created = 0
    skipped = 0

    for job in jobs:
        job_id = job["_id"]
        email = str(job.get("email", "")).lower().strip()

        if not email:
            print(f"  ⚠️  Job {job.get('request_number', job_id)} has no email — skipping")
            skipped += 1
            continue

        # Check if customer with this email already exists
        existing = await db.customers.find_one({"email": email})

        if existing:
            customer_id = str(existing["_id"])
            linked += 1
        else:
            now = datetime.utcnow()
            new_customer = {
                "company_name": job.get("company_name"),
                "contact_person": job.get("contact_person", ""),
                "email": email,
                "phone": job.get("phone", ""),
                "address": job.get("address"),
                "customer_notes": job.get("customer_notes"),
                "created_at": job.get("created_at", now),
                "updated_at": now,
            }
            result = await db.customers.insert_one(new_customer)
            customer_id = str(result.inserted_id)
            created += 1

        # Update the repair job with customer_id
        await db.repairs.update_one(
            {"_id": job_id},
            {"$set": {"customer_id": customer_id}}
        )

    print(f"\n✅ Migration complete:")
    print(f"   Created {created} new customer profile(s)")
    print(f"   Linked {linked} job(s) to existing customer(s)")
    print(f"   Skipped {skipped} job(s) (no email)")
    print("=" * 60)


async def main():
    from app.config import settings
    print(f"\nDatabase: {settings.database_name}")
    print(f"Environment: {settings.environment}")

    print("\n🔌 Connecting to MongoDB...")
    await connect_to_mongo()
    print("✓ Connected")

    try:
        await migrate()
    except Exception as e:
        print(f"\n❌ Migration failed: {str(e)}")
        import traceback
        traceback.print_exc()
        sys.exit(1)
    finally:
        await close_mongo_connection()
        print("\n✓ Disconnected from MongoDB")


if __name__ == "__main__":
    asyncio.run(main())
