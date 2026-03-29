import logging
from motor.motor_asyncio import AsyncIOMotorClient, AsyncIOMotorDatabase
from app.config import settings
from datetime import datetime

logger = logging.getLogger(__name__)

client: AsyncIOMotorClient = None
database: AsyncIOMotorDatabase = None


async def connect_to_mongo():
    """Connect to MongoDB"""
    global client, database
    client = AsyncIOMotorClient(settings.mongodb_url)
    database = client[settings.database_name]


async def close_mongo_connection():
    """Close MongoDB connection"""
    global client
    if client:
        client.close()
        logger.info("Closed MongoDB connection")


def get_database() -> AsyncIOMotorDatabase:
    """Get database instance"""
    return database


async def get_next_request_number(year: int = None) -> str:
    """
    Generate next request number in format REQ-YYYY-XXXX
    Uses atomic MongoDB findAndModify to ensure thread-safe counter

    Args:
        year: Year for the request (defaults to current year)

    Returns:
        Request number string like "REQ-2026-0001"
    """
    if year is None:
        year = datetime.utcnow().year

    db = get_database()
    counter_id = f"request_{year}"

    # Atomic increment using findOneAndUpdate
    result = await db.counters.find_one_and_update(
        {"_id": counter_id},
        {"$inc": {"seq": 1}},
        upsert=True,
        return_document=True
    )

    seq = result["seq"]
    request_number = f"REQ-{year}-{seq:04d}"

    return request_number
