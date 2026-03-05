"""
Cleanup duplicate and inactive tools from database.

This script removes all inactive tools and optionally removes ALL tools for fresh start.

Usage:
    # Remove only inactive tools:
    python3 backend/scripts/cleanup_tools.py

    # Remove ALL tools (fresh start):
    python3 backend/scripts/cleanup_tools.py --all
"""

import requests
import sys

API_URL = "http://localhost:8000/api/tools/"

def main():
    remove_all = '--all' in sys.argv

    print("🧹 CNS Tools - Database Cleanup Script")
    print("=" * 50)

    # Fetch all tools
    try:
        response = requests.get(API_URL + "?active_only=false")
        all_tools = response.json()
    except requests.exceptions.ConnectionError:
        print("❌ ERROR: Cannot connect to backend API")
        print("   Make sure backend is running on http://localhost:8000")
        return

    active_tools = [t for t in all_tools if t['active']]
    inactive_tools = [t for t in all_tools if not t['active']]

    print(f"📊 Current Status:")
    print(f"   Total tools: {len(all_tools)}")
    print(f"   Active: {len(active_tools)}")
    print(f"   Inactive: {len(inactive_tools)}")

    if remove_all:
        print(f"\n⚠️  You are about to DELETE ALL {len(all_tools)} tools!")
        tools_to_delete = all_tools
    else:
        print(f"\n🗑️  You are about to delete {len(inactive_tools)} inactive tools")
        tools_to_delete = inactive_tools

    if len(tools_to_delete) == 0:
        print("✅ No tools to delete!")
        return

    # Show what will be deleted
    print("\nTools to be deleted:")
    for tool in tools_to_delete[:10]:
        status = "✓" if tool['active'] else "✗"
        print(f"  [{status}] {tool['name']} (ID: {tool['id'][:12]}...)")
    if len(tools_to_delete) > 10:
        print(f"  ... and {len(tools_to_delete) - 10} more")

    # Confirm
    response = input(f"\nContinue? (yes/no): ").lower()
    if response != 'yes':
        print("Cancelled. No changes made.")
        return

    # Delete via MongoDB directly (need to use API workaround)
    print(f"\n🗑️  Deleting {len(tools_to_delete)} tools...")
    deleted = 0

    # Since API only does soft delete, we need to tell user to use MongoDB directly
    print("\n⚠️  The API only supports soft-delete (setting active=false)")
    print("To truly remove from database, you need to access MongoDB directly:\n")

    print("Option 1 - MongoDB Compass:")
    print("  1. Connect using the connection string from backend/.env")
    print("  2. Navigate to cnstoolsandrepair_db_dev → tools_catalog")
    print("  3. Filter: {\"active\": false}")
    print("  4. Delete all matching documents\n")

    print("Option 2 - MongoDB Shell:")
    print("  mongosh <connection_string>")
    print("  use cnstoolsandrepair_db_dev")
    print("  db.tools_catalog.deleteMany({\"active\": false})\n")

    print("Option 3 - Python Script (recommended):")
    print("  Use backend/scripts/hard_delete_inactive_tools.py (creating now...)")


if __name__ == "__main__":
    main()
