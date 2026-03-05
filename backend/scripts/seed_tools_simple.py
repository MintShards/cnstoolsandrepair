"""
Seed initial tools data - Simplified version using requests to API.

This script populates the tools_catalog collection by calling the FastAPI endpoints.
Run this while the backend server is running.

Usage:
    # Start backend first:
    cd backend
    python3 -m uvicorn app.main:app --reload --host 0.0.0.0 --port 8000

    # Then in another terminal:
    python3 backend/scripts/seed_tools_simple.py
"""

import requests
import json

API_URL = "http://localhost:8000/api/tools/"

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


def main():
    print("🔧 CNS Tools - Database Seeding Script")
    print("=" * 50)

    # Check if backend is running
    try:
        response = requests.get(API_URL + "?active_only=false")
        existing_tools = response.json()
        print(f"✓ Connected to backend API")
        print(f"  Current tools in database: {len(existing_tools)}")
    except requests.exceptions.ConnectionError:
        print("❌ ERROR: Cannot connect to backend API")
        print("   Make sure backend is running:")
        print("   cd backend && python3 -m uvicorn app.main:app --reload --host 0.0.0.0 --port 8000")
        return

    # Confirm if tools already exist
    if len(existing_tools) > 0:
        print(f"\n⚠️  Database already contains {len(existing_tools)} tools:")
        for tool in existing_tools[:5]:  # Show first 5
            print(f"   - {tool['name']}")
        if len(existing_tools) > 5:
            print(f"   ... and {len(existing_tools) - 5} more")

        response = input("\nContinue and add tools anyway? (yes/no): ").lower()
        if response != 'yes':
            print("Cancelled. No changes made.")
            return

    # Create tools via API
    print(f"\n📝 Creating {len(tools_data)} tools...")
    created_count = 0

    for tool in tools_data:
        try:
            response = requests.post(
                API_URL,
                json=tool,
                headers={"Content-Type": "application/json"}
            )

            if response.status_code == 201:
                created_tool = response.json()
                print(f"  ✓ Created: {created_tool['name']} ({created_tool['icon']})")
                created_count += 1
            else:
                print(f"  ✗ Failed to create {tool['name']}: {response.status_code}")
                print(f"    {response.text}")
        except Exception as e:
            print(f"  ✗ Error creating {tool['name']}: {str(e)}")

    print(f"\n✅ Successfully created {created_count}/{len(tools_data)} tools!")

    # Fetch and display all tools
    response = requests.get(API_URL)
    final_tools = response.json()

    print(f"\n📋 Current tools in database ({len(final_tools)} active):")
    for i, tool in enumerate(final_tools, 1):
        status = "✓" if tool['active'] else "✗"
        print(f"  {i}. [{status}] {tool['name']} ({tool['icon']}) - Order: {tool['display_order']}")

    print("\n🎉 Migration complete!")
    print("\nNext steps:")
    print("  1. Visit http://localhost:5173/ to see tools on homepage")
    print("  2. Visit http://localhost:5173/admin/tools to manage tools")


if __name__ == "__main__":
    main()
