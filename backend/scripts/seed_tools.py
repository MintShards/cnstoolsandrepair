"""
Seed initial tools data with icons and display order.

This script populates the tools_catalog collection with 8 standard pneumatic tool types.
Run once during initial setup or when database is reset.

Usage:
    python3 backend/scripts/seed_tools.py
"""

import asyncio
import sys
from pathlib import Path

# Add parent directory to path for imports
sys.path.insert(0, str(Path(__file__).parent.parent.parent))

from motor.motor_asyncio import AsyncIOMotorClient
from backend.app.config import settings


async def seed_tools():
    """Seed initial tools data into MongoDB"""

    # Connect to MongoDB
    client = AsyncIOMotorClient(settings.MONGODB_URL)
    db = client[settings.DATABASE_NAME]

    print(f"Connected to MongoDB: {settings.DATABASE_NAME}")

    # Initial tools data (from hardcoded ToolsPreview.jsx array)
    tools_data = [
        {
            "name": "Impact Wrenches",
            "category": "impact_tools",
            "description": "High-torque pneumatic impact wrenches for heavy-duty fastening and loosening applications",
            "icon": "construction",
            "image_url": "placeholder-tool.jpg",
            "display_order": 1,
            "active": True
        },
        {
            "name": "Grinders",
            "category": "grinding_tools",
            "description": "Pneumatic angle grinders and die grinders for cutting, grinding, and surface preparation",
            "icon": "auto_fix_high",
            "image_url": "placeholder-tool.jpg",
            "display_order": 2,
            "active": True
        },
        {
            "name": "Drills",
            "category": "drilling_tools",
            "description": "Air-powered drills for precision drilling in metal, wood, and composite materials",
            "icon": "handyman",
            "image_url": "placeholder-tool.jpg",
            "display_order": 3,
            "active": True
        },
        {
            "name": "Sanders",
            "category": "sanding_tools",
            "description": "Pneumatic orbital and belt sanders for surface finishing and material removal",
            "icon": "hardware",
            "image_url": "placeholder-tool.jpg",
            "display_order": 4,
            "active": True
        },
        {
            "name": "Ratchets",
            "category": "fastening_tools",
            "description": "Air ratchets and nutrunners for efficient fastening in tight spaces",
            "icon": "settings",
            "image_url": "placeholder-tool.jpg",
            "display_order": 5,
            "active": True
        },
        {
            "name": "Spray Guns",
            "category": "painting_tools",
            "description": "HVLP and conventional spray guns for automotive and industrial painting applications",
            "icon": "air",
            "image_url": "placeholder-tool.jpg",
            "display_order": 6,
            "active": True
        },
        {
            "name": "Nail Guns",
            "category": "fastening_tools",
            "description": "Pneumatic nailers and staplers for construction and woodworking applications",
            "icon": "push_pin",
            "image_url": "placeholder-tool.jpg",
            "display_order": 7,
            "active": True
        },
        {
            "name": "Air Hammers",
            "category": "impact_tools",
            "description": "Pneumatic chisels and air hammers for metal fabrication and material removal",
            "icon": "gavel",
            "image_url": "placeholder-tool.jpg",
            "display_order": 8,
            "active": True
        }
    ]

    # Check if tools already exist
    existing_count = await db.tools_catalog.count_documents({})

    if existing_count > 0:
        print(f"⚠️  Database already contains {existing_count} tools.")
        response = input("Delete existing tools and reseed? (yes/no): ").lower()

        if response == 'yes':
            result = await db.tools_catalog.delete_many({})
            print(f"✓ Deleted {result.deleted_count} existing tools")
        else:
            print("Cancelled. No changes made.")
            client.close()
            return

    # Insert tools
    result = await db.tools_catalog.insert_many(tools_data)
    print(f"✓ Successfully seeded {len(result.inserted_ids)} tools")

    # List created tools
    print("\nCreated tools:")
    cursor = db.tools_catalog.find({}).sort("display_order", 1)
    tools = await cursor.to_list(length=None)

    for tool in tools:
        print(f"  {tool['display_order']}. {tool['name']} ({tool['icon']})")

    client.close()
    print("\n✅ Migration complete!")


if __name__ == "__main__":
    asyncio.run(seed_tools())
