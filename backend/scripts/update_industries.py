#!/usr/bin/env python3
"""
MongoDB Industries Collection Update Script

This script updates the industries collection to:
1. Remove Railway industry
2. Add 10 new industrial sectors focused on B2B pneumatic tool repair

Run from backend directory:
    python scripts/update_industries.py
"""

import asyncio
import sys
from pathlib import Path

# Add parent directory to path for imports
sys.path.insert(0, str(Path(__file__).parent.parent))

from motor.motor_asyncio import AsyncIOMotorClient
from app.config import settings


# New industries data matching frontend IndustriesServed component
NEW_INDUSTRIES = [
    {
        "name": "Automotive Repair & Body Shops",
        "description": "Auto repair shops and body shops rely on pneumatic tools for precision work, from impact wrenches to spray guns.",
        "icon": "directions_car",
        "active": True,
    },
    {
        "name": "Fleet & Truck Maintenance",
        "description": "Fleet maintenance operations depend on reliable pneumatic equipment for heavy-duty truck and trailer repairs.",
        "icon": "local_shipping",
        "active": True,
    },
    {
        "name": "Manufacturing & Industrial Assembly",
        "description": "Industrial manufacturing plants use pneumatic tools for assembly lines, fabrication, and quality control.",
        "icon": "precision_manufacturing",
        "active": True,
    },
    {
        "name": "Metal Fabrication & Welding",
        "description": "Metal fabrication shops require precision pneumatic tools for cutting, grinding, and finishing metalwork.",
        "icon": "manufacturing",
        "active": True,
    },
    {
        "name": "Construction & Concrete Trades",
        "description": "Construction sites depend on pneumatic tools for framing, finishing, concrete work, and heavy-duty applications.",
        "icon": "apartment",
        "active": True,
    },
    {
        "name": "Oil, Gas & Energy",
        "description": "Energy sector operations in hazardous environments require certified pneumatic tools for safe, spark-free operation.",
        "icon": "oil_barrel",
        "active": True,
    },
    {
        "name": "Aerospace & Aviation Maintenance",
        "description": "Aircraft maintenance and aerospace manufacturing require precision pneumatic tools meeting strict safety and quality standards.",
        "icon": "flight",
        "active": True,
    },
    {
        "name": "Marine & Shipbuilding",
        "description": "Marine operations and shipyards use heavy-duty pneumatic tools for construction, maintenance, and repair work.",
        "icon": "sailing",
        "active": True,
    },
    {
        "name": "Mining & Aggregates",
        "description": "Mining operations require rugged pneumatic tools for drilling, grinding, and material processing in harsh environments.",
        "icon": "landscape",
        "active": True,
    },
    {
        "name": "Maintenance, Repair & Operations (MRO)",
        "description": "MRO facilities across all industries depend on reliable pneumatic tools for general maintenance and repair operations.",
        "icon": "settings",
        "active": True,
    },
]


async def update_industries():
    """Update industries collection with new data"""

    # Connect to MongoDB
    client = AsyncIOMotorClient(settings.mongodb_url)
    db = client[settings.database_name]

    try:
        print("🔗 Connected to MongoDB")
        print(f"📊 Database: {settings.database_name}")
        print()

        # Step 1: Soft delete Railway industry
        print("🗑️  Step 1: Removing Railway industry...")
        railway_result = await db.industries.update_many(
            {"name": {"$regex": "railway", "$options": "i"}},
            {"$set": {"active": False}}
        )
        print(f"   ✓ Deactivated {railway_result.modified_count} Railway industry record(s)")
        print()

        # Step 2: Check for existing industries to avoid duplicates
        print("🔍 Step 2: Checking for existing industries...")
        existing_industries = await db.industries.find(
            {"active": True},
            {"name": 1}
        ).to_list(length=None)

        existing_names = {ind["name"] for ind in existing_industries}
        print(f"   Found {len(existing_names)} existing active industries")
        print()

        # Step 3: Insert new industries (skip if already exists)
        print("➕ Step 3: Adding new industries...")
        added_count = 0
        skipped_count = 0

        for industry in NEW_INDUSTRIES:
            if industry["name"] in existing_names:
                print(f"   ⏭️  Skipped: {industry['name']} (already exists)")
                skipped_count += 1
            else:
                await db.industries.insert_one(industry)
                print(f"   ✓ Added: {industry['name']}")
                added_count += 1

        print()
        print("=" * 60)
        print("📊 MIGRATION SUMMARY")
        print("=" * 60)
        print(f"✓ Railway records deactivated: {railway_result.modified_count}")
        print(f"✓ New industries added: {added_count}")
        print(f"⏭️  Industries skipped (duplicates): {skipped_count}")
        print()

        # Step 4: Display final industry list
        print("📋 Current Active Industries:")
        print("-" * 60)
        final_industries = await db.industries.find(
            {"active": True}
        ).sort("name", 1).to_list(length=None)

        for ind in final_industries:
            print(f"   • {ind['name']} ({ind['icon']})")

        print()
        print(f"✅ Total active industries: {len(final_industries)}")
        print()

    except Exception as e:
        print(f"❌ Error during migration: {e}")
        raise
    finally:
        client.close()
        print("🔌 Disconnected from MongoDB")


if __name__ == "__main__":
    print()
    print("=" * 60)
    print("  CNS TOOLS - INDUSTRIES COLLECTION UPDATE")
    print("=" * 60)
    print()

    asyncio.run(update_industries())

    print()
    print("✅ Migration completed successfully!")
    print()
