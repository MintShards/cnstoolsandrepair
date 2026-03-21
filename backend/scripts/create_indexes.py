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
    print("\n📧 Creating indexes for contact_messages...")

    db = get_database()

    # Index 1: Email + Created At (for email-based rate limiting)
    print("  Creating index: email + created_at...")
    await db.contact_messages.create_index([
        ("email", 1),
        ("created_at", -1)
    ], name="email_rate_limit_idx")
    print("  ✓ Created email_rate_limit_idx")

    # Index 2: Created At (for general queries and cleanup)
    print("  Creating index: created_at...")
    await db.contact_messages.create_index(
        "created_at",
        name="created_at_idx"
    )
    print("  ✓ Created created_at_idx")

    print("  ✅ Contact indexes created!")


async def create_quotes_indexes():
    """Create indexes for quotes collection (critical for production)"""
    print("\n📋 Creating indexes for quotes...")

    db = get_database()

    # Index 1: Request Number (unique, for lookups)
    print("  Creating unique index: request_number...")
    await db.quotes.create_index(
        "request_number",
        unique=True,
        name="request_number_unique_idx"
    )
    print("  ✓ Created request_number_unique_idx")

    # Index 2: Created At (for sorting by date)
    print("  Creating index: created_at...")
    await db.quotes.create_index(
        "created_at",
        name="created_at_idx"
    )
    print("  ✓ Created created_at_idx")

    # Index 3: Status (for filtering by status)
    print("  Creating index: status...")
    await db.quotes.create_index(
        "status",
        name="status_idx"
    )
    print("  ✓ Created status_idx")

    # Index 4: Email (for customer lookups)
    print("  Creating index: email...")
    await db.quotes.create_index(
        "email",
        name="email_idx"
    )
    print("  ✓ Created email_idx")

    # Index 5: Compound Index - Status + Created At (for admin filtering)
    print("  Creating compound index: status + created_at...")
    await db.quotes.create_index([
        ("status", 1),
        ("created_at", -1)
    ], name="status_created_at_idx")
    print("  ✓ Created status_created_at_idx")

    print("  ✅ Quote indexes created!")


async def create_users_indexes():
    """Create indexes for users collection (admin authentication)"""
    print("\n👤 Creating indexes for users...")

    db = get_database()

    # Index 1: Email (unique, for authentication)
    print("  Creating unique index: email...")
    await db.users.create_index(
        "email",
        unique=True,
        name="email_unique_idx"
    )
    print("  ✓ Created email_unique_idx")

    # Index 2: Role (for role-based queries)
    print("  Creating index: role...")
    await db.users.create_index(
        "role",
        name="role_idx"
    )
    print("  ✓ Created role_idx")

    # Index 3: Active Status (for filtering active users)
    print("  Creating index: is_active...")
    await db.users.create_index(
        "is_active",
        name="is_active_idx"
    )
    print("  ✓ Created is_active_idx")

    print("  ✅ User indexes created!")


async def create_all_indexes():
    """Create all production indexes"""
    print("\n" + "=" * 60)
    print("PRODUCTION DATABASE INDEX CREATION")
    print("=" * 60)

    try:
        # Create indexes for all collections
        await create_quotes_indexes()
        await create_users_indexes()
        await create_contact_indexes()

        print("\n" + "=" * 60)
        print("✅ ALL PRODUCTION INDEXES CREATED SUCCESSFULLY!")
        print("=" * 60)

    except Exception as e:
        print(f"\n❌ Error creating indexes: {str(e)}")
        raise


async def verify_indexes():
    """Verify that indexes were created"""
    print("\n" + "=" * 60)
    print("VERIFYING INDEXES")
    print("=" * 60)

    db = get_database()

    collections = [
        ("quotes", "📋"),
        ("users", "👤"),
        ("contact_messages", "📧")
    ]

    total_indexes = 0

    for collection_name, icon in collections:
        print(f"\n{icon} {collection_name.upper()} collection:")
        try:
            indexes = await db[collection_name].list_indexes().to_list(None)
            print(f"  Total indexes: {len(indexes)}")
            for idx in indexes:
                index_type = "unique" if idx.get('unique', False) else "standard"
                print(f"  - {idx['name']} ({index_type}): {idx.get('key', {})}")
            total_indexes += len(indexes)
        except Exception as e:
            print(f"  ⚠️ Collection does not exist yet: {str(e)}")

    print("\n" + "=" * 60)
    print(f"✅ TOTAL INDEXES ACROSS ALL COLLECTIONS: {total_indexes}")
    print("=" * 60)


async def main():
    """Main execution function"""
    from app.config import settings

    print("\n" + "=" * 60)
    print("DATABASE INDEX CREATION SCRIPT")
    print("=" * 60)
    print(f"\nDatabase: {settings.database_name}")
    print(f"Environment: {settings.environment}")
    print("=" * 60)

    try:
        # Connect to MongoDB
        print("\n🔌 Connecting to MongoDB...")
        await connect_to_mongo()
        print("✓ Connected successfully")

        # Create all production indexes
        await create_all_indexes()

        # Verify indexes
        await verify_indexes()

        print("\n🎉 INDEX CREATION COMPLETE!")
        print("\nNext steps:")
        print("  1. Verify indexes in MongoDB Atlas UI")
        print("  2. Test query performance with indexes")
        print("  3. Monitor slow query logs")

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
