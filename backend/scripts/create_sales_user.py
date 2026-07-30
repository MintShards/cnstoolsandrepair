#!/usr/bin/env python3
"""
Sales Rep User Creation Script (CLI fallback)

Creates a sales rep user for CNS Tool Repair backend.
Primary flow: use the admin dashboard Sales Reps tab.
CLI fallback: python scripts/create_sales_user.py

Usage: Run from the backend/ directory
"""
import asyncio
import sys
from pathlib import Path
from datetime import datetime

sys.path.insert(0, str(Path(__file__).parent.parent))

from motor.motor_asyncio import AsyncIOMotorClient
from app.config import settings
from app.core.security import hash_password


async def create_sales_user():
    print("=" * 60)
    print("CNS Tool Repair - Sales Rep User Creation")
    print("=" * 60)
    print()

    first_name = input("Enter first name: ").strip()
    if not first_name:
        print("❌ Error: First name cannot be empty")
        return False

    last_name = input("Enter last name: ").strip()
    if not last_name:
        print("❌ Error: Last name cannot be empty")
        return False

    email = input("Enter email: ").strip().lower()
    if not email:
        print("❌ Error: Email cannot be empty")
        return False

    password = input("Enter password (min 8 characters): ").strip()
    if len(password) < 8:
        print("❌ Error: Password must be at least 8 characters")
        return False

    confirm_password = input("Confirm password: ").strip()
    if password != confirm_password:
        print("❌ Error: Passwords do not match")
        return False

    client = AsyncIOMotorClient(settings.mongodb_url)
    db = client[settings.database_name]

    try:
        existing = await db.users.find_one({"email": email})
        if existing:
            print(f"❌ Error: User with email {email} already exists")
            return False

        now = datetime.utcnow()
        user_doc = {
            "first_name": first_name,
            "last_name": last_name,
            "email": email,
            "password_hash": hash_password(password),
            "role": "sales",
            "is_active": True,
            "created_at": now,
            "updated_at": now,
        }

        result = await db.users.insert_one(user_doc)
        print()
        print("✅ Sales rep created successfully!")
        print(f"   Name:  {first_name} {last_name}")
        print(f"   Email: {email}")
        print(f"   Role:  sales")
        print(f"   ID:    {result.inserted_id}")
        print()
        print("Login at: /sales/login")
        return True

    except Exception as e:
        print(f"❌ Error creating sales rep: {e}")
        return False
    finally:
        client.close()


if __name__ == "__main__":
    success = asyncio.run(create_sales_user())
    sys.exit(0 if success else 1)
