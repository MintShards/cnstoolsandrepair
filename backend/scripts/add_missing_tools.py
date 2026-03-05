"""Add only missing tools to complete the set of 8."""

import requests

API_URL = "http://localhost:8000/api/tools/"

# Check which tools exist
response = requests.get(API_URL)
existing_tools = response.json()
existing_names = {t['name'] for t in existing_tools}

print(f"Existing tools: {existing_names}")

# All 8 standard tools
all_tools = [
    {
        "name": "Impact Wrenches",
        "category": "impact_tools",
        "description": "High-torque pneumatic impact wrenches for heavy-duty fastening and loosening applications",
        "icon": "construction",
        "display_order": 1
    },
    {
        "name": "Grinders",
        "category": "grinding_tools",
        "description": "Pneumatic angle grinders and die grinders for cutting, grinding, and surface preparation",
        "icon": "auto_fix_high",
        "display_order": 2
    },
    {
        "name": "Sanders",
        "category": "sanding_tools",
        "description": "Pneumatic orbital and belt sanders for surface finishing and material removal",
        "icon": "hardware",
        "display_order": 4
    },
    {
        "name": "Nail Guns",
        "category": "fastening_tools",
        "description": "Pneumatic nailers and staplers for construction and woodworking applications",
        "icon": "push_pin",
        "display_order": 7
    },
    {
        "name": "Air Hammers",
        "category": "impact_tools",
        "description": "Pneumatic chisels and air hammers for metal fabrication and material removal",
        "icon": "gavel",
        "display_order": 8
    }
]

# Add only missing tools
missing_tools = [t for t in all_tools if t['name'] not in existing_names]

print(f"\n🔧 Adding {len(missing_tools)} missing tools:")
for tool in missing_tools:
    try:
        response = requests.post(API_URL, json=tool)
        if response.status_code == 201:
            print(f"  ✓ {tool['name']}")
        else:
            print(f"  ✗ {tool['name']}: {response.status_code}")
    except Exception as e:
        print(f"  ✗ {tool['name']}: {e}")

# Verify final count
response = requests.get(API_URL)
final_tools = response.json()
print(f"\n✅ Total active tools: {len(final_tools)}")
for t in sorted(final_tools, key=lambda x: x['display_order']):
    print(f"  {t['display_order']}. {t['name']} ({t['icon']})")
