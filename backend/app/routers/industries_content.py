from fastapi import APIRouter, HTTPException
from app.database import get_database
from app.models.page_content import (
    IndustriesPageContentUpdate,
    IndustriesPageContentResponse,
)
from app.utils import convert_objectid_to_str
from datetime import datetime

router = APIRouter(
    prefix="/api/industries-content",
    tags=["industries-content"],
)

# Default industries page content (fallback when no DB document exists)
DEFAULT_INDUSTRIES_CONTENT = {
    "hero": {
        "label": "Who We Serve",
        "heading": "Industries We Support",
        "description": "Trusted pneumatic tool repair partner for major industrial sectors across Surrey, BC.",
    },
    "industries": [
        {
            "name": "Automotive Repair & Body Shops",
            "description": "Professional pneumatic tool repair for automotive repair facilities, body shops, and vehicle service centers.",
            "icon": "directions_car",
            "toolBadges": ["Impact Wrenches", "Air Ratchets", "Grinders", "Sanders"],
            "display_order": 1,
        },
        {
            "name": "Fleet Maintenance & Transportation",
            "description": "Industrial tool service for fleet maintenance operations, transportation companies, and logistics centers.",
            "icon": "local_shipping",
            "toolBadges": ["Impact Tools", "Air Hammers", "Tire Service Tools"],
            "display_order": 2,
        },
        {
            "name": "Manufacturing & Production",
            "description": "Pneumatic tool maintenance for manufacturing plants, production lines, and assembly operations.",
            "icon": "precision_manufacturing",
            "toolBadges": ["Assembly Tools", "Drills", "Grinders", "Impact Drivers"],
            "display_order": 3,
        },
        {
            "name": "Metal Fabrication & Welding",
            "description": "Tool repair services for metal fabrication shops, welding operations, and custom manufacturing facilities.",
            "icon": "construction",
            "toolBadges": ["Grinders", "Cut-Off Tools", "Chipping Hammers", "Sanders"],
            "display_order": 4,
        },
        {
            "name": "Construction & Heavy Equipment",
            "description": "Industrial pneumatic tool service for construction companies, contractors, and heavy equipment operations.",
            "icon": "foundation",
            "toolBadges": ["Jackhammers", "Impact Wrenches", "Nail Guns", "Hoists"],
            "display_order": 5,
        },
        {
            "name": "Oil & Gas Services",
            "description": "Specialized tool repair for oil and gas operations, refineries, and energy sector maintenance facilities.",
            "icon": "oil_barrel",
            "toolBadges": ["Torque Wrenches", "Impact Tools", "Specialty Tools"],
            "display_order": 6,
        },
        {
            "name": "Aerospace & Aviation",
            "description": "Precision tool maintenance for aerospace manufacturing, aircraft maintenance, and aviation service centers.",
            "icon": "flight",
            "toolBadges": ["Precision Drills", "Riveters", "Impact Tools", "Torque Tools"],
            "display_order": 7,
        },
        {
            "name": "Marine & Shipyard",
            "description": "Industrial tool service for marine facilities, shipyards, and waterfront maintenance operations.",
            "icon": "sailing",
            "toolBadges": ["Impact Wrenches", "Grinders", "Chipping Hammers", "Sanders"],
            "display_order": 8,
        },
        {
            "name": "Mining & Resource Extraction",
            "description": "Heavy-duty tool repair for mining operations, resource extraction facilities, and industrial sites.",
            "icon": "volcano",
            "toolBadges": ["Heavy Impact Tools", "Rock Drills", "Chipping Hammers"],
            "display_order": 9,
        },
        {
            "name": "MRO (Maintenance, Repair, Operations)",
            "description": "Comprehensive tool service for maintenance facilities, repair shops, and general industrial operations.",
            "icon": "handyman",
            "toolBadges": ["All Tool Types", "General Maintenance Tools"],
            "display_order": 10,
        },
    ],
}


@router.get("/", response_model=IndustriesPageContentResponse)
async def get_industries_content():
    """Get industries page content (singleton document)"""
    db = get_database()

    # Find the singleton document
    content = await db.industries_page_content.find_one({})

    if not content:
        # Return default content if no document exists
        return IndustriesPageContentResponse(**DEFAULT_INDUSTRIES_CONTENT)

    # Convert ObjectId to string
    content = convert_objectid_to_str(content)
    return IndustriesPageContentResponse(**content)


@router.put("/", response_model=IndustriesPageContentResponse)
async def update_industries_content(content: IndustriesPageContentUpdate):
    """Update industries page content (singleton document)"""
    db = get_database()

    # Prepare update data
    update_data = content.model_dump(by_alias=True)
    update_data["updatedAt"] = datetime.utcnow()

    # Find existing document
    existing = await db.industries_page_content.find_one({})

    if existing:
        # Update existing document
        await db.industries_page_content.update_one(
            {"_id": existing["_id"]},
            {"$set": update_data}
        )
        result = await db.industries_page_content.find_one({"_id": existing["_id"]})
    else:
        # Create new document
        result = await db.industries_page_content.insert_one(update_data)
        result = await db.industries_page_content.find_one({"_id": result.inserted_id})

    # Convert ObjectId to string
    result = convert_objectid_to_str(result)
    return IndustriesPageContentResponse(**result)
