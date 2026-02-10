from fastapi import APIRouter, HTTPException, UploadFile, File, Form
from typing import List, Optional
from bson import ObjectId
from datetime import datetime
from app.database import get_database
from app.models.quote import QuoteCreate, QuoteResponse, Quote, UrgencyLevel
from app.services.file_service import save_upload_file
from app.services.email_service import send_quote_notification
from app.utils.helpers import convert_objectid_to_str

router = APIRouter(prefix="/api/quotes", tags=["quotes"])


@router.post("/", response_model=QuoteResponse, status_code=201)
async def create_quote(
    company_name: str = Form(...),
    contact_person: str = Form(...),
    email: str = Form(...),
    phone: str = Form(...),
    tool_type: str = Form(...),
    tool_brand: str = Form(...),
    tool_model: str = Form(...),
    quantity: int = Form(...),
    problem_description: str = Form(...),
    urgency_level: UrgencyLevel = Form(UrgencyLevel.MEDIUM),
    photos: List[UploadFile] = File(default=[])
):
    """Create a new quote request with photo uploads"""

    db = get_database()

    # Save uploaded photos
    photo_filenames = []
    for photo in photos:
        if photo.filename:
            filename = await save_upload_file(photo)
            photo_filenames.append(filename)

    # Create quote document
    quote_data = QuoteCreate(
        company_name=company_name,
        contact_person=contact_person,
        email=email,
        phone=phone,
        tool_type=tool_type,
        tool_brand=tool_brand,
        tool_model=tool_model,
        quantity=quantity,
        problem_description=problem_description,
        urgency_level=urgency_level,
        photos=photo_filenames
    )

    # Insert into database
    quote_dict = quote_data.model_dump()
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
        status=created_quote["status"],
        created_at=created_quote["created_at"],
        updated_at=created_quote["updated_at"],
        **quote_data.model_dump()
    )

    # Rename _id to id for QuoteResponse
    created_quote["id"] = created_quote.pop("_id")

    # Send email notification (non-blocking)
    try:
        await send_quote_notification(quote_obj)
    except Exception as e:
        print(f"Email notification failed: {str(e)}")

    return QuoteResponse(**created_quote)


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
    return QuoteResponse(**quote)


@router.get("/", response_model=List[QuoteResponse])
async def list_quotes(
    skip: int = 0,
    limit: int = 50,
    status: Optional[str] = None
):
    """List all quotes with optional filtering"""

    db = get_database()

    query = {}
    if status:
        query["status"] = status

    cursor = db.quotes.find(query).sort("created_at", -1).skip(skip).limit(limit)
    quotes = await cursor.to_list(length=limit)

    quotes = [convert_objectid_to_str(quote) for quote in quotes]
    return [QuoteResponse(**quote) for quote in quotes]
