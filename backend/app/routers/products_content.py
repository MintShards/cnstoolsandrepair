from fastapi import APIRouter, Depends
from app.database import get_database
from app.models.page_content import (
    ProductsPageContentUpdate,
    ProductsPageContentResponse,
)
from app.utils import convert_objectid_to_str
from app.dependencies.auth import require_admin
from datetime import datetime

router = APIRouter(
    prefix="/api/products-content",
    tags=["products-content"],
)

# Fallback when no document exists yet. The frontend uses the same wording as
# its own defaults, so an un-seeded install looks identical to a seeded one.
DEFAULT_PRODUCTS_CONTENT = {
    "hero": {
        "label": "Tools & Equipment",
        "heading": "Tools for Sale",
        "shortHeading": "Products",
        "description": (
            "We supply the same JET air tools, Strongarm jacks and lifting equipment we "
            "service every day — so the shop that sells you the tool is the shop that can "
            "repair it. Tell us what you need and we'll send pricing, including volume "
            "rates for fleets."
        ),
        "availabilityNote": "Available to order — typically 2–5 business days",
    },
    # key must match ProductCategory in models/product.py
    "categories": [
        {"key": "air_tools", "label": "Air Tools", "heading": "Air Tools"},
        {"key": "hydraulic", "label": "Hydraulic", "heading": "Hydraulic"},
        {"key": "lifting", "label": "Lifting", "heading": "Lifting & Material Handling"},
    ],
    "allLabel": "All Tools",
    "sectionNote": "in stock or available to order",
    "quotePanel": {
        "title": "Request a Quote",
        "footnote": "We reply with pricing and lead time — usually the same business day.",
        "successHeading": "Request Sent",
        "successNote": "We'll get back to you with pricing and lead time, usually the same business day.",
    },
    "footerCta": {
        "text": "Don't see what you need? We can order most JET, Strongarm and Hathorn products —",
        "phoneLabel": "call 778-488-0777",
        "phoneNumber": "7784880777",
        "messageLabel": "send us a message",
    },
    "seo": {
        "title": "Tools & Equipment for Sale | CNS Tool Repair Surrey BC",
        "description": (
            "Buy JET air tools, Strongarm jacks, hoists and shop equipment in Surrey, BC. "
            "Authorized dealer and warranty repair centre serving the Lower Mainland. "
            "Request a quote."
        ),
        "keywords": (
            "buy JET tools Surrey BC, Strongarm jacks BC, air tools for sale Surrey, "
            "shop equipment Lower Mainland, industrial tool supplier Surrey"
        ),
    },
}


@router.get("/", response_model=ProductsPageContentResponse)
async def get_products_content():
    """Get Tools for Sale page content (singleton document)"""
    db = get_database()

    content = await db.products_page_content.find_one({})

    if not content:
        return ProductsPageContentResponse(**DEFAULT_PRODUCTS_CONTENT)

    content = convert_objectid_to_str(content)
    return ProductsPageContentResponse(**content)


@router.put("/", response_model=ProductsPageContentResponse, dependencies=[Depends(require_admin)])
async def update_products_content(content: ProductsPageContentUpdate):
    """Update Tools for Sale page content (singleton document)"""
    db = get_database()

    update_data = content.model_dump(by_alias=True)
    update_data["updatedAt"] = datetime.utcnow()

    existing = await db.products_page_content.find_one({})

    if existing:
        await db.products_page_content.update_one(
            {"_id": existing["_id"]},
            {"$set": update_data},
        )
        result = await db.products_page_content.find_one({"_id": existing["_id"]})
    else:
        inserted = await db.products_page_content.insert_one(update_data)
        result = await db.products_page_content.find_one({"_id": inserted.inserted_id})

    result = convert_objectid_to_str(result)
    return ProductsPageContentResponse(**result)
