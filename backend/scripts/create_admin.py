#!/usr/bin/env python3
"""
Admin User Creation Script

Creates an admin user for CNS Tool Repair backend.
Usage: python scripts/create_admin.py
"""
import asyncio
import sys
from pathlib import Path

# Add parent directory to path for imports
sys.path.insert(0, str(Path(__file__).parent.parent))

from motor.motor_asyncio import AsyncIOMotorClient
from app.config import settings
from app.core.security import hash_password
from datetime import datetime


async def create_admin_user():
    """Create admin user interactively"""
    print("=" * 60)
    print("CNS Tool Repair - Admin User Creation")
    print("=" * 60)
    print()

    # Get user input
    email = input("Enter admin email: ").strip()
    if not email:
        print("❌ Error: Email cannot be empty")
        return False

    password = input("Enter admin password (min 8 characters): ").strip()
    if len(password) < 8:
        print("❌ Error: Password must be at least 8 characters")
        return False

    confirm_password = input("Confirm password: ").strip()
    if password != confirm_password:
        print("❌ Error: Passwords do not match")
        return False

    name = input("Enter admin name (optional): ").strip() or "Admin"

    print()
    print("Connecting to MongoDB...")

    # Connect to database
    try:
        client = AsyncIOMotorClient(settings.mongodb_url)
        db = client[settings.database_name]

        # Check if user already exists
        existing_user = await db.users.find_one({"email": email})
        if existing_user:
            print(f"⚠️  Warning: User with email '{email}' already exists")
            overwrite = input("Do you want to update this user? (yes/no): ").strip().lower()
            if overwrite != "yes":
                print("❌ Operation cancelled")
                client.close()
                return False

            # Update existing user
            result = await db.users.update_one(
                {"email": email},
                {
                    "$set": {
                        "name": name,
                        "password_hash": hash_password(password),
                        "role": "admin",
                        "is_active": True,
                        "updated_at": datetime.utcnow()
                    }
                }
            )

            if result.modified_count > 0:
                print()
                print("✅ Admin user updated successfully!")
                print(f"   Email: {email}")
                print(f"   Name: {name}")
                print(f"   Role: admin")
            else:
                print("❌ Error: Failed to update user")
                client.close()
                return False

        else:
            # Create new user
            admin_user = {
                "email": email,
                "name": name,
                "password_hash": hash_password(password),
                "role": "admin",
                "is_active": True,
                "created_at": datetime.utcnow(),
                "updated_at": datetime.utcnow()
            }

            result = await db.users.insert_one(admin_user)

            if result.inserted_id:
                print()
                print("✅ Admin user created successfully!")
                print(f"   Email: {email}")
                print(f"   Name: {name}")
                print(f"   Role: admin")
                print(f"   User ID: {result.inserted_id}")
            else:
                print("❌ Error: Failed to create user")
                client.close()
                return False

        print()
        print("You can now login at: /admin/login")
        print()

        client.close()
        return True

    except Exception as e:
        print(f"❌ Database error: {str(e)}")
        return False


async def list_admin_users():
    """List all admin users"""
    try:
        client = AsyncIOMotorClient(settings.mongodb_url)
        db = client[settings.database_name]

        print()
        print("=" * 60)
        print("Existing Admin Users")
        print("=" * 60)

        cursor = db.users.find({"role": "admin"})
        users = await cursor.to_list(length=100)

        if not users:
            print("No admin users found")
        else:
            for user in users:
                status = "✅ Active" if user.get("is_active", False) else "❌ Inactive"
                print(f"\n📧 {user['email']}")
                print(f"   Name: {user.get('name', 'N/A')}")
                print(f"   Status: {status}")
                print(f"   Created: {user.get('created_at', 'N/A')}")

        print()
        client.close()

    except Exception as e:
        print(f"❌ Error: {str(e)}")


def main():
    """Main entry point"""
    print()
    print("Database Configuration:")
    print(f"  URL: {settings.mongodb_url[:50]}...")
    print(f"  Database: {settings.database_name}")
    print(f"  Environment: {settings.environment}")
    print()

    # Check if user wants to list users first
    action = input("Action: (c)reate admin / (l)ist admins / (q)uit: ").strip().lower()

    if action == "l":
        asyncio.run(list_admin_users())
        print()
        if input("Do you want to create a new admin? (yes/no): ").strip().lower() == "yes":
            asyncio.run(create_admin_user())
    elif action == "c":
        asyncio.run(create_admin_user())
    elif action == "q":
        print("Goodbye!")
    else:
        print("Invalid action. Please choose 'c', 'l', or 'q'")


if __name__ == "__main__":
    main()
