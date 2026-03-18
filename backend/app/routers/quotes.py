from fastapi import APIRouter, HTTPException, UploadFile, File, Form, Request
from typing import List
from bson import ObjectId
from datetime import datetime, timedelta
import json
from pydantic import ValidationError
from app.database import get_database, get_next_request_number
from app.models.quote import QuoteCreate, QuoteResponse, Quote, ToolEntry, QuoteUpdate
from app.services.file_service import save_upload_file, delete_file
from app.services.email_service import send_quote_notification
from app.utils.helpers import convert_objectid_to_str
from app.logging_config import log_quote_created, log_quote_deleted, log_email_notification
from slowapi import Limiter
from slowapi.util import get_remote_address

router = APIRouter(prefix="/api/quotes", tags=["quotes"])
limiter = Limiter(key_func=get_remote_address)

# In-memory cache for idempotency (use Redis in production)
idempotency_cache = {}


def clean_expired_idempotency_keys():
    """Remove expired idempotency keys (older than 5 minutes)"""
    current_time = datetime.utcnow()
    expired_keys = [
        key for key, (timestamp, _) in idempotency_cache.items()
        if current_time - timestamp > timedelta(minutes=5)
    ]
    for key in expired_keys:
        del idempotency_cache[key]


@router.post("/", response_model=QuoteResponse, status_code=201)
@limiter.limit("5/hour")
async def create_quote(
    request: Request,
    company_name: str | None = Form(None),
    contact_person: str = Form(...),
    email: str = Form(...),
    phone: str = Form(...),
    tools: str = Form(...),  # JSON string array of tools
    photos: List[UploadFile] = File(default=[]),
    idempotency_key: str | None = Form(default=None)
):
    """Create a new quote request with multiple tools and photo uploads"""

    # Clean expired idempotency keys periodically
    clean_expired_idempotency_keys()

    # Check for duplicate submission using idempotency key
    if idempotency_key and idempotency_key in idempotency_cache:
        timestamp, cached_response = idempotency_cache[idempotency_key]
        print(f"Duplicate submission detected with key: {idempotency_key}")
        return cached_response

    db = get_database()

    # Generate request number
    request_number = await get_next_request_number()

    # Parse tools JSON array
    try:
        tools_data = json.loads(tools)
        tool_entries = [ToolEntry(**tool) for tool in tools_data]
    except (json.JSONDecodeError, ValueError) as e:
        raise HTTPException(status_code=400, detail=f"Invalid tools data: {str(e)}")

    # Save uploaded photos (to 'quotes' folder in Spaces or local)
    photo_filenames = []
    for photo in photos:
        if photo.filename:
            filename = await save_upload_file(photo, folder="quotes")
            photo_filenames.append(filename)

    # Create quote document (handle empty company_name as None)
    try:
        quote_data = QuoteCreate(
            company_name=company_name if company_name and company_name.strip() else None,
            contact_person=contact_person,
            email=email,
            phone=phone,
            tools=tool_entries,
            photos=photo_filenames
        )
    except ValidationError as e:
        # Return 422 for validation errors (not 500)
        raise HTTPException(status_code=422, detail=e.errors())

    # Insert into database
    quote_dict = quote_data.model_dump()
    quote_dict["request_number"] = request_number
    quote_dict["status"] = "pending"
    quote_dict["created_at"] = datetime.utcnow()
    quote_dict["updated_at"] = datetime.utcnow()

    result = await db.quotes.insert_one(quote_dict)

    # Fetch created quote
    created_quote = await db.quotes.find_one({"_id": result.inserted_id})
    created_quote = convert_objectid_to_str(created_quote)

    # Create Quote object for email notification (before renaming _id)
    quote_obj = Quote(
        _id=created_quote["_id"],
        request_number=created_quote["request_number"],
        status=created_quote["status"],
        created_at=created_quote["created_at"],
        updated_at=created_quote["updated_at"],
        **quote_data.model_dump()
    )

    # Rename _id to id for QuoteResponse
    created_quote["id"] = created_quote.pop("_id")

    # Send email notification (non-blocking) and track success
    email_sent = False
    try:
        email_sent = await send_quote_notification(quote_obj)
        log_email_notification(request_number, email_sent)
    except Exception as e:
        log_email_notification(request_number, False, str(e))

    # Add email_sent status to response
    created_quote["email_sent"] = email_sent

    response = QuoteResponse(**created_quote)

    # Cache response for idempotency (5 minute TTL)
    if idempotency_key:
        idempotency_cache[idempotency_key] = (datetime.utcnow(), response)

    # Log quote creation
    log_quote_created(
        request_number=request_number,
        customer_email=email,
        tool_count=len(tool_entries),
        photo_count=len(photo_filenames)
    )

    return response


@router.get("/{quote_id}", response_model=QuoteResponse)
async def get_quote(quote_id: str):
    """Get a quote by ID"""

    db = get_database()

    try:
        quote = await db.quotes.find_one({"_id": ObjectId(quote_id)})
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid quote ID format")

    if not quote:
        raise HTTPException(status_code=404, detail="Quote not found")

    quote = convert_objectid_to_str(quote)
    quote["id"] = quote.pop("_id")
    return QuoteResponse(**quote)


@router.get("/", response_model=List[QuoteResponse])
async def list_quotes(
    skip: int = 0,
    limit: int = 50,
    status: str | None = None
):
    """List all quotes with optional filtering"""

    db = get_database()

    query = {}
    if status:
        query["status"] = status

    cursor = db.quotes.find(query).sort("created_at", -1).skip(skip).limit(limit)
    quotes = await cursor.to_list(length=limit)

    quotes = [convert_objectid_to_str(quote) for quote in quotes]
    for quote in quotes:
        quote["id"] = quote.pop("_id")
    return [QuoteResponse(**quote) for quote in quotes]


@router.put("/{quote_id}", response_model=QuoteResponse)
async def update_quote(quote_id: str, quote_update: QuoteUpdate):
    """Update quote status"""

    db = get_database()

    try:
        object_id = ObjectId(quote_id)
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid quote ID format")

    # Check if quote exists
    existing_quote = await db.quotes.find_one({"_id": object_id})
    if not existing_quote:
        raise HTTPException(status_code=404, detail="Quote not found")

    # Update status and updated_at timestamp
    update_data = {
        "status": quote_update.status.value,
        "updated_at": datetime.utcnow()
    }

    result = await db.quotes.update_one(
        {"_id": object_id},
        {"$set": update_data}
    )

    if result.modified_count == 0:
        raise HTTPException(status_code=500, detail="Failed to update quote")

    # Fetch updated quote
    updated_quote = await db.quotes.find_one({"_id": object_id})
    updated_quote = convert_objectid_to_str(updated_quote)
    updated_quote["id"] = updated_quote.pop("_id")

    return QuoteResponse(**updated_quote)


@router.delete("/{quote_id}", status_code=204)
async def delete_quote(quote_id: str):
    """Delete a quote request and all associated photos from storage"""

    db = get_database()

    try:
        object_id = ObjectId(quote_id)
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid quote ID format")

    # Fetch quote to get photo URLs before deletion
    quote = await db.quotes.find_one({"_id": object_id})
    if not quote:
        raise HTTPException(status_code=404, detail="Quote not found")

    # Delete all associated photos from Spaces or local storage
    photos = quote.get("photos", [])
    deleted_count = 0
    failed_count = 0

    for photo in photos:
        try:
            success = await delete_file(photo)
            if success:
                deleted_count += 1
            else:
                failed_count += 1
                print(f"Failed to delete photo: {photo}")
        except Exception as e:
            failed_count += 1
            print(f"Error deleting photo {photo}: {str(e)}")

    # Log photo cleanup results
    if failed_count > 0:
        from app.logging_config import logger
        logger.warning(
            f"Photo cleanup incomplete for quote {quote.get('request_number', 'unknown')}",
            extra={
                "deleted_count": deleted_count,
                "failed_count": failed_count,
                "total_count": len(photos)
            }
        )

    # Delete quote document from database
    result = await db.quotes.delete_one({"_id": object_id})

    if result.deleted_count == 0:
        raise HTTPException(status_code=500, detail="Failed to delete quote from database")

    # Log quote deletion
    log_quote_deleted(quote.get("request_number", "unknown"))

    # Return 204 No Content (successful deletion)
    return None
