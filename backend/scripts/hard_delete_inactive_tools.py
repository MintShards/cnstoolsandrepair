"""
Hard delete inactive tools from MongoDB.

This script directly connects to MongoDB and permanently removes inactive tools.

Usage:
    cd backend
    source venv/bin/activate
    python3 scripts/hard_delete_inactive_tools.py
"""

import asyncio
import sys
from pathlib import Path

# Add parent directory to path
sys.path.insert(0, str(Path(__file__).parent.parent.parent))

from motor.motor_asyncio import AsyncIOMotorClient
from backend.app.config import settings


async def hard_delete_inactive():
    """Permanently delete inactive tools from database"""

    # Connect to MongoDB
    client = AsyncIOMotorClient(settings.mongodb_url)
    db = client[settings.database_name]

    print("🧹 Hard Delete Inactive Tools")
    print("=" * 50)
    print(f"Database: {settings.database_name}")

    # Count tools
    total = await db.tools_catalog.count_documents({})
    active = await db.tools_catalog.count_documents({"active": True})
    inactive = await db.tools_catalog.count_documents({"active": False})

    print(f"\n📊 Current Status:")
    print(f"   Total: {total} tools")
    print(f"   Active: {active} tools")
    print(f"   Inactive: {inactive} tools")

    if inactive == 0:
        print("\n✅ No inactive tools to delete!")
        client.close()
        return

    # Show samples
    print(f"\n🗑️  Inactive tools to be permanently deleted:")
    cursor = db.tools_catalog.find({"active": False}).limit(10)
    samples = await cursor.to_list(length=10)

    for tool in samples:
        print(f"   • {tool['name']} (Category: {tool['category']})")

    if inactive > 10:
        print(f"   ... and {inactive - 10} more")

    # Confirm
    print(f"\n⚠️  WARNING: This will PERMANENTLY delete {inactive} tools from the database!")
    response = input("Type 'DELETE' to confirm: ")

    if response != 'DELETE':
        print("Cancelled. No changes made.")
        client.close()
        return

    # Delete
    result = await db.tools_catalog.delete_many({"active": False})
    print(f"\n✅ Deleted {result.deleted_count} inactive tools")

    # Show final count
    remaining = await db.tools_catalog.count_documents({})
    print(f"📊 Remaining tools: {remaining}")

    client.close()


if __name__ == "__main__":
    asyncio.run(hard_delete_inactive())
