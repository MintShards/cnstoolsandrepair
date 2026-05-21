#!/usr/bin/env python3
"""
Migration: rename 'not_worth_repair' -> 'beyond_economical_repair' in repairs collection.
Run once on production to fix existing documents.
"""
import asyncio
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent.parent))

from motor.motor_asyncio import AsyncIOMotorClient
from app.config import settings

async def migrate():
    client = AsyncIOMotorClient(settings.mongodb_url)
    db = client[settings.database_name]

    # Fix tools.status
    result1 = await db.repairs.update_many(
        {"tools.status": "not_worth_repair"},
        {"$set": {"tools.$[t].status": "beyond_economical_repair"}},
        array_filters=[{"t.status": "not_worth_repair"}]
    )

    # Fix tools.status_history[].status
    result2 = await db.repairs.update_many(
        {"tools.status_history.status": "not_worth_repair"},
        {"$set": {"tools.$[t].status_history.$[h].status": "beyond_economical_repair"}},
        array_filters=[
            {"t.status_history.status": "not_worth_repair"},
            {"h.status": "not_worth_repair"}
        ]
    )

    print(f"tools.status fixed:    {result1.modified_count} document(s)")
    print(f"status_history fixed:  {result2.modified_count} document(s)")
    client.close()

asyncio.run(migrate())
