#!/usr/bin/env python3
"""
Copy Dev Data to Production Database

Copies essential collections from development database to production database
to initialize production with working content (settings, tools, brands, etc.)

Usage:
    python scripts/copy_dev_to_prod.py

Safety:
- Skips users collection (admin already exists in prod)
- Skips quotes collection (keep dev/prod separate)
- Skips counters collection (let prod generate its own)
- Only copies if target collection is empty (won't overwrite)
"""

import asyncio
import sys
from pathlib import Path

# Add parent directory to path for imports
sys.path.insert(0, str(Path(__file__).parent.parent))

from motor.motor_asyncio import AsyncIOMotorClient
from app.config import settings


def print_header(title):
    """Print formatted section header"""
    print("\n" + "=" * 60)
    print(title)
    print("=" * 60)


async def copy_collection(dev_db, prod_db, collection_name):
    """Copy a collection from dev to prod if prod is empty"""

    # Check if prod collection already has data
    prod_count = await prod_db[collection_name].count_documents({})
    if prod_count > 0:
        print(f"⏭️  {collection_name}: Skipped (already has {prod_count} documents)")
        return True

    # Get all documents from dev
    dev_count = await dev_db[collection_name].count_documents({})
    if dev_count == 0:
        print(f"⚠️  {collection_name}: Skipped (dev collection is empty)")
        return True

    print(f"📋 {collection_name}: Copying {dev_count} documents...")

    try:
        # Get all documents from dev
        cursor = dev_db[collection_name].find({})
        documents = await cursor.to_list(length=None)

        if documents:
            # Insert into prod
            result = await prod_db[collection_name].insert_many(documents)
            inserted_count = len(result.inserted_ids)
            print(f"✅ {collection_name}: Copied {inserted_count} documents successfully")
            return True
        else:
            print(f"⚠️  {collection_name}: No documents to copy")
            return True

    except Exception as e:
        print(f"❌ {collection_name}: Copy failed - {str(e)}")
        return False


async def main():
    """Main function to copy dev data to prod"""

    print_header("COPY DEV DATA TO PRODUCTION")

    # Prompt for dev MongoDB connection string
    print("\n📝 Enter your DEV MongoDB connection string:")
    print("   (The cluster where your development database lives)")
    dev_mongodb_url = input("Dev MongoDB URL: ").strip()

    if not dev_mongodb_url:
        print("❌ Dev MongoDB URL is required")
        sys.exit(1)

    print(f"\nDev Database:  cnstoolsandrepair_db_dev (separate cluster)")
    print(f"Prod Database: {settings.database_name}")
    print("=" * 60)

    # Confirm action
    print("\n⚠️  This will copy data from dev to production database")
    print("   Only empty collections will be populated.")

    proceed = input("\nContinue? (yes/no): ").strip().lower()
    if proceed != "yes":
        print("Aborted.")
        sys.exit(0)

    try:
        # Connect to BOTH MongoDB clusters
        print("\n🔌 Connecting to MongoDB clusters...")

        # Dev cluster connection
        dev_client = AsyncIOMotorClient(dev_mongodb_url, serverSelectionTimeoutMS=10000)
        dev_db = dev_client["cnstoolsandrepair_db_dev"]

        # Prod cluster connection (from settings)
        prod_client = AsyncIOMotorClient(settings.mongodb_url, serverSelectionTimeoutMS=10000)
        prod_db = prod_client[settings.database_name]

        # Test both connections
        await dev_client.admin.command('ping')
        print("✅ Connected to Dev cluster successfully")

        await prod_client.admin.command('ping')
        print("✅ Connected to Prod cluster successfully")

        # Collections to copy (in order of importance)
        collections_to_copy = [
            "settings",                    # Critical - fixes homepage and admin
            "home_content",                # Homepage sections
            "about_content",               # About page content
            "contact_page_content",        # Contact page content
            "brands",                      # Brand logos carousel
            "tools_catalog",               # Services page tools
            "gallery",                     # Gallery photos
            "industries_page_content",     # Industries page content
        ]

        print("\n📦 Copying Collections")
        print("-" * 60)

        results = []
        for collection in collections_to_copy:
            success = await copy_collection(dev_db, prod_db, collection)
            results.append((collection, success))

        # Summary
        print("\n" + "=" * 60)
        print("COPY SUMMARY")
        print("=" * 60)

        successful = sum(1 for _, success in results if success)
        total = len(results)

        for collection, success in results:
            icon = "✅" if success else "❌"
            print(f"{icon} {collection}")

        print("-" * 60)
        print(f"Status: {successful}/{total} collections processed successfully")

        if successful == total:
            print("\n✅ DATA COPY COMPLETE!")
            print("\n🎉 Your production database now has content!")
            print("\n📋 Next Steps:")
            print("  1. Refresh homepage: https://cnstoolsandrepair.com")
            print("  2. Check admin dashboard: https://cnstoolsandrepair.com/admin/login")
            print("  3. Verify all pages load correctly")
            print("  4. Test quote submission")
        else:
            print("\n⚠️  COPY COMPLETED WITH ERRORS")
            print("   Review failed collections above")

        # Close both connections
        dev_client.close()
        prod_client.close()

        sys.exit(0 if successful == total else 1)

    except Exception as e:
        print(f"\n❌ Fatal error: {str(e)}")
        import traceback
        traceback.print_exc()
        sys.exit(1)


if __name__ == "__main__":
    asyncio.run(main())
