#!/usr/bin/env python3
"""
Database Index Creation Script

Creates performance indexes for contact message rate limiting.
Run this script once after deploying the rate limiting feature.

Usage:
    python scripts/create_indexes.py
"""

import asyncio
import sys
from pathlib import Path

# Add parent directory to path to import app modules
sys.path.insert(0, str(Path(__file__).parent.parent))

from app.database import get_database, connect_to_mongo, close_mongo_connection


async def create_contact_indexes():
    """Create indexes for contact_messages collection"""
    print("Creating database indexes for contact_messages...")

    db = get_database()

    # Index 1: Email + Created At (for email-based rate limiting)
    print("Creating index: email + created_at...")
    await db.contact_messages.create_index([
        ("email", 1),
        ("created_at", -1)
    ], name="email_rate_limit_idx")
    print("✓ Created email_rate_limit_idx")

    # Index 2: Created At (for general queries and cleanup)
    print("Creating index: created_at...")
    await db.contact_messages.create_index(
        "created_at",
        name="created_at_idx"
    )
    print("✓ Created created_at_idx")

    # Optional: TTL Index (auto-delete messages older than 90 days)
    # Uncomment if you want automatic cleanup
    # print("Creating TTL index: auto-delete after 90 days...")
    # await db.contact_messages.create_index(
    #     "created_at",
    #     expireAfterSeconds=7776000,  # 90 days
    #     name="auto_cleanup_ttl_idx"
    # )
    # print("✓ Created auto_cleanup_ttl_idx")

    print("\n✅ All indexes created successfully!")


async def verify_indexes():
    """Verify that indexes were created"""
    print("\nVerifying indexes...")

    db = get_database()

    indexes = await db.contact_messages.list_indexes().to_list(None)

    print(f"\nTotal indexes: {len(indexes)}")
    for idx in indexes:
        print(f"  - {idx['name']}: {idx.get('key', {})}")


async def main():
    """Main execution function"""
    try:
        # Connect to MongoDB
        print("Connecting to MongoDB...")
        await connect_to_mongo()
        print("✓ Connected\n")

        # Create indexes
        await create_contact_indexes()

        # Verify indexes
        await verify_indexes()

    except Exception as e:
        print(f"\n❌ Error: {str(e)}")
        import traceback
        traceback.print_exc()
        sys.exit(1)

    finally:
        # Close connection
        await close_mongo_connection()
        print("\n✓ Disconnected from MongoDB")


if __name__ == "__main__":
    asyncio.run(main())
