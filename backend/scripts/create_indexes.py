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

from pymongo.errors import OperationFailure

# Add parent directory to path to import app modules
sys.path.insert(0, str(Path(__file__).parent.parent))

from app.database import get_database, connect_to_mongo, close_mongo_connection


async def ensure_index(collection, keys, **kwargs):
    """create_index that tolerates drift from hand-created indexes.

    Code 85 (IndexOptionsConflict) usually means the same key spec already
    exists under a different name — e.g. a default-named `email_1` created
    through Compass or an early script run. The index the app needs is
    effectively in place, so warn and continue instead of aborting the whole
    run (which used to stop later collections from ever getting theirs).
    Code 86 (IndexKeySpecsConflict) is the same name with different keys;
    also skipped with a warning so one stale index can't block everything —
    drop it manually if the warning names one you care about.

    Code 11000 (DuplicateKey) means a UNIQUE index cannot build because the
    collection already holds duplicate values — warn with the offending key
    and carry on, so one dirty collection can't block every other index.
    Re-run after cleaning the data to add the constraint.
    """
    name = kwargs.get("name") or str(keys)
    try:
        await collection.create_index(keys, **kwargs)
        print(f"  ✓ {name}")
    except OperationFailure as e:
        detail = (e.details or {}).get("errmsg", str(e))
        if e.code in (85, 86):
            print(f"  ⚠️ Skipped {name}: {detail}")
        elif e.code == 11000:
            print(f"  ⚠️ Could not build unique index {name} — duplicate values already in the data:")
            print(f"     {detail[:200]}")
            print("     Clean up the duplicates and re-run this script to add the constraint.")
        else:
            raise


async def create_contact_indexes():
    """Create indexes for contact_messages collection"""
    print("\n📧 Creating indexes for contact_messages...")

    db = get_database()

    # Index 1: Email + Created At (for email-based rate limiting)
    print("  Creating index: email + created_at...")
    await ensure_index(db.contact_messages, [
        ("email", 1),
        ("created_at", -1)
    ], name="email_rate_limit_idx")

    # Index 2: Created At (for general queries and cleanup)
    print("  Creating index: created_at...")
    await ensure_index(db.contact_messages, 
        "created_at",
        name="created_at_idx"
    )

    print("  ✅ Contact indexes created!")


async def create_quotes_indexes():
    """Create indexes for quotes collection (critical for production)"""
    print("\n📋 Creating indexes for quotes...")

    db = get_database()

    # Index 1: Request Number (unique, for lookups)
    print("  Creating unique index: request_number...")
    await ensure_index(db.quotes, 
        "request_number",
        unique=True,
        name="request_number_unique_idx"
    )

    # Index 2: Created At (for sorting by date)
    print("  Creating index: created_at...")
    await ensure_index(db.quotes, 
        "created_at",
        name="created_at_idx"
    )

    # Index 3: Status (for filtering by status)
    print("  Creating index: status...")
    await ensure_index(db.quotes, 
        "status",
        name="status_idx"
    )

    # Index 4: Email (for customer lookups)
    print("  Creating index: email...")
    await ensure_index(db.quotes, 
        "email",
        name="email_idx"
    )

    # Index 5: Compound Index - Status + Created At (for admin filtering)
    print("  Creating compound index: status + created_at...")
    await ensure_index(db.quotes, [
        ("status", 1),
        ("created_at", -1)
    ], name="status_created_at_idx")

    print("  ✅ Quote indexes created!")


async def create_users_indexes():
    """Create indexes for users collection (admin authentication)"""
    print("\n👤 Creating indexes for users...")

    db = get_database()

    # Index 1: Email (unique, for authentication)
    print("  Creating unique index: email...")
    await ensure_index(db.users, 
        "email",
        unique=True,
        name="email_unique_idx"
    )

    # Index 2: Role (for role-based queries)
    print("  Creating index: role...")
    await ensure_index(db.users, 
        "role",
        name="role_idx"
    )

    # Index 3: Active Status (for filtering active users)
    print("  Creating index: is_active...")
    await ensure_index(db.users, 
        "is_active",
        name="is_active_idx"
    )

    print("  ✅ User indexes created!")


async def create_customers_indexes():
    """Create indexes for customers collection"""
    print("\n👥 Creating indexes for customers...")

    db = get_database()

    print("  Creating unique index: email...")
    await ensure_index(db.customers, 
        "email",
        unique=True,
        name="customers_email_unique_idx"
    )

    print("  Creating index: company_name...")
    await ensure_index(db.customers, 
        "company_name",
        name="customers_company_name_idx"
    )

    print("  Creating index: last_name...")
    await ensure_index(db.customers, 
        "last_name",
        name="customers_last_name_idx"
    )

    print("  Creating index: created_at...")
    await ensure_index(db.customers, 
        [("created_at", -1)],
        name="customers_created_at_idx"
    )

    print("  ✅ Customer indexes created!")


async def create_repairs_indexes():
    """Create indexes for repairs collection"""
    print("\n🔧 Creating indexes for repairs...")

    db = get_database()

    print("  Creating unique index: request_number...")
    await ensure_index(db.repairs, 
        "request_number",
        unique=True,
        name="repairs_request_number_unique_idx"
    )

    print("  Creating index: created_at...")
    await ensure_index(db.repairs, 
        [("created_at", -1)],
        name="repairs_created_at_idx"
    )

    print("  Creating index: tools.status...")
    await ensure_index(db.repairs, 
        "tools.status",
        name="repairs_tool_status_idx"
    )

    print("  Creating index: email...")
    await ensure_index(db.repairs, 
        "email",
        name="repairs_email_idx"
    )

    print("  Creating index: company_name...")
    await ensure_index(db.repairs, 
        "company_name",
        name="repairs_company_name_idx"
    )

    print("  Creating index: customer_id...")
    await ensure_index(db.repairs, 
        "customer_id",
        name="repairs_customer_id_idx"
    )

    print("  ✅ Repair indexes created!")


async def create_route_management_indexes():
    """Indexes for zones / businesses / routes"""
    print("\n🗺️  Creating ROUTE MANAGEMENT indexes...")
    db = get_database()

    # Deliberately NOT sparse: zones created before the hierarchy have no
    # parent_id field at all, and a sparse index would exclude them from the
    # {"parent_id": None} query that finds top-level zones.
    print("  Creating index: zones.parent_id...")
    await ensure_index(db.zones, "parent_id", name="zones_parent_id_idx")

    # Multikey — drives the zone filter, the $unwind rollup and the $in scope.
    print("  Creating index: businesses.zone_ids...")
    await ensure_index(db.businesses, "zone_ids", name="businesses_zone_ids_idx")

    print("  Creating index: businesses.last_visited_at...")
    await ensure_index(db.businesses, "last_visited_at", name="businesses_last_visited_idx")

    print("  Creating index: routes.zone_id...")
    await ensure_index(db.routes, "zone_id", name="routes_zone_id_idx")

    # The hottest query in the app: /api/routes/today filters date + assignee.
    print("  Creating index: routes (date, assigned_to)...")
    await ensure_index(db.routes, 
        [("date", 1), ("assigned_to", 1)],
        name="routes_date_assigned_idx"
    )

    # Sweep counts group completed runs by the saved route that spawned them.
    print("  Creating index: routes.saved_route_id...")
    await ensure_index(db.routes, "saved_route_id", name="routes_saved_route_idx")

    print("  Creating index: visits (business_id, visited_at desc)...")
    await ensure_index(db.visits, 
        [("business_id", 1), ("visited_at", -1)],
        name="visits_business_recent_idx"
    )

    print("  Creating index: visits (rep_id, follow_up_date)...")
    await ensure_index(db.visits, 
        [("rep_id", 1), ("follow_up_date", 1)],
        name="visits_rep_follow_up_idx"
    )

    # Stop enrichment joins visits back onto runs by route.
    print("  Creating index: visits.route_id...")
    await ensure_index(db.visits, "route_id", name="visits_route_id_idx")

    print("  Creating index: saved_routes.zone_id...")
    await ensure_index(db.saved_routes, "zone_id", name="saved_routes_zone_id_idx")

    print("  ✅ Route management indexes created!")


async def create_workspace_indexes():
    """Indexes for the Shop Hub tasks + messages collections"""
    print("\n📌 Creating WORKSPACE (tasks/messages) indexes...")
    db = get_database()

    # Board/list default view: open tasks ordered by due date.
    print("  Creating index: tasks (status, due_date)...")
    await ensure_index(db.tasks, 
        [("status", 1), ("due_date", 1)],
        name="tasks_status_due_idx"
    )

    # "My tasks" badge counts and the assignee filter.
    print("  Creating index: tasks (assignee_id, status)...")
    await ensure_index(db.tasks, 
        [("assignee_id", 1), ("status", 1)],
        name="tasks_assignee_status_idx"
    )

    print("  Creating index: tasks.created_at desc...")
    await ensure_index(db.tasks, [("created_at", -1)], name="tasks_created_idx")

    # Feed pages newest-first; the unread $ne count stays unindexed by design
    # (fine at shop scale — see plan notes).
    print("  Creating index: messages.created_at desc...")
    await ensure_index(db.messages, [("created_at", -1)], name="messages_created_idx")

    print("  Creating index: messages (pinned, created_at desc)...")
    await ensure_index(db.messages, 
        [("pinned", 1), ("created_at", -1)],
        name="messages_pinned_created_idx"
    )

    print("  ✅ Workspace indexes created!")


async def create_all_indexes():
    """Create every index the app needs, on whatever database .env points to."""
    from app.config import settings
    print("\n" + "=" * 60)
    print(f"CREATING INDEXES ON: {settings.database_name} ({settings.environment})")
    print("=" * 60)

    try:
        # Create indexes for all collections
        await create_quotes_indexes()
        await create_users_indexes()
        await create_contact_indexes()
        await create_repairs_indexes()
        await create_customers_indexes()
        await create_route_management_indexes()
        await create_workspace_indexes()

        print("\n" + "=" * 60)
        print("✅ ALL INDEXES CREATED SUCCESSFULLY!")
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
        ("customers", "👥"),
        ("contact_messages", "📧"),
        ("repairs", "🔧"),
        ("zones", "🗺️"),
        ("businesses", "🏭"),
        ("routes", "🚚"),
        ("visits", "📝"),
        ("saved_routes", "🔖"),
        ("tasks", "✅"),
        ("messages", "💬")
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

    # Safety gate: never touch a production database by accident. Dev runs
    # need no flag; production requires the operator to say so explicitly.
    looks_like_prod = (
        settings.environment == "production"
        or settings.database_name.endswith("_prod")
    )
    if looks_like_prod and "--allow-production" not in sys.argv:
        print(f"\n🛑 This looks like a PRODUCTION database ({settings.database_name}, "
              f"environment={settings.environment}).")
        print("   Nothing was changed. To run against production on purpose:")
        print("   python scripts/create_indexes.py --allow-production")
        sys.exit(2)

    try:
        # Connect to MongoDB
        print("\n🔌 Connecting to MongoDB...")
        await connect_to_mongo()
        print("✓ Connected successfully")

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
