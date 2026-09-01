import logging
from fastapi import APIRouter, HTTPException, Depends, Request
from typing import List, Optional
from bson import ObjectId
from datetime import datetime
from pydantic import BaseModel
from slowapi import Limiter
from slowapi.util import get_remote_address
from app.database import get_database, get_next_product_quote_number
from app.models.product import ProductQuoteCreate, ProductQuoteResponse
from app.services.product_quote_email_service import send_product_quote_notification
from app.utils.helpers import convert_objectid_to_str
from app.dependencies.auth import require_staff_or_admin

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/product-quotes", tags=["product-quotes"])

# Same abuse protection as the repair-request form.
limiter = Limiter(key_func=get_remote_address)


class ProductQuoteStatusUpdate(BaseModel):
    status: str


@router.post("/", response_model=ProductQuoteResponse, status_code=201)
@limiter.limit("5/hour")
async def create_product_quote(quote: ProductQuoteCreate, request: Request):
    """Public endpoint — a customer requests pricing on tools from /products."""

    db = get_database()

    quote_number = await get_next_product_quote_number()
    now = datetime.utcnow()

    quote_dict = quote.model_dump()
    quote_dict.update({
        "quote_number": quote_number,
        "status": "new",
        "created_at": now,
        "updated_at": now,
    })

    result = await db.product_quotes.insert_one(quote_dict)
    created = await db.product_quotes.find_one({"_id": result.inserted_id})

    # The request is already saved — a mail failure must never lose the lead.
    email_sent = await send_product_quote_notification(created)
    if not email_sent:
        logger.warning(f"Product quote {quote_number} stored but notification email failed")

    created = convert_objectid_to_str(created)
    created["id"] = created.pop("_id")

    return ProductQuoteResponse(**created, email_sent=email_sent)


@router.get("/", response_model=List[ProductQuoteResponse], dependencies=[Depends(require_staff_or_admin)])
async def list_product_quotes(status: Optional[str] = None, limit: int = 100):
    """List tool-sale quote requests, newest first (staff/admin)."""

    db = get_database()

    query = {"status": status} if status else {}
    cursor = db.product_quotes.find(query).sort("created_at", -1).limit(limit)
    quotes = await cursor.to_list(length=None)

    results = []
    for q in quotes:
        q = convert_objectid_to_str(q)
        q["id"] = q.pop("_id")
        results.append(ProductQuoteResponse(**q))

    return results


@router.patch("/{quote_id}", response_model=ProductQuoteResponse, dependencies=[Depends(require_staff_or_admin)])
async def update_product_quote_status(quote_id: str, update: ProductQuoteStatusUpdate):
    """Mark a quote request as quoted/closed (staff/admin)."""

    db = get_database()

    if not ObjectId.is_valid(quote_id):
        raise HTTPException(status_code=400, detail="Invalid quote ID format")

    result = await db.product_quotes.update_one(
        {"_id": ObjectId(quote_id)},
        {"$set": {"status": update.status, "updated_at": datetime.utcnow()}},
    )

    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Quote request not found")

    updated = await db.product_quotes.find_one({"_id": ObjectId(quote_id)})
    updated = convert_objectid_to_str(updated)
    updated["id"] = updated.pop("_id")

    return ProductQuoteResponse(**updated)
