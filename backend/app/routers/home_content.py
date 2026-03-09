from fastapi import APIRouter, HTTPException
from app.database import get_database
from app.models.page_content import (
    HomePageContentUpdate,
    HomePageContentResponse,
)
from app.utils import convert_objectid_to_str
from datetime import datetime

router = APIRouter(
    prefix="/api/home-content",
    tags=["home-content"],
)

# Default home page content (fallback when no DB document exists)
DEFAULT_HOME_CONTENT = {
    "seo": {
        "title": "Industrial Pneumatic Tool Repair in Surrey BC | CNS Tools",
        "description": "Industrial pneumatic tool repair in Surrey, BC. B2B service with professional diagnostics, OEM-compatible parts, and in-shop industrial repairs for automotive, fleet, manufacturing, construction, oil & gas, aerospace, marine, mining, and MRO sectors.",
        "keywords": "pneumatic tool repair Surrey, industrial tool repair BC, air tool repair Vancouver, fleet maintenance tools, automotive tool repair, construction pneumatic tools, oil gas tool service",
    },
    "hero": {
        "headline": "Industrial Pneumatic Tool Repair & Maintenance in Surrey, BC",
        "subheadline": "CNS Tools and Repair provides industrial pneumatic tool repair, maintenance, and calibration services for mid to large businesses across Metro Vancouver. Professional on-site service for automotive, fleet, manufacturing, construction, oil & gas, aerospace, marine, mining, and MRO operations.",
        "industriesBadge": "Automotive • Fleet • Manufacturing • Construction",
        "locationText": "Surrey, BC - On-Site Industrial Service",
        "primaryButtonText": "Request a Free Quote",
        "secondaryButtonText": "Call Us Today",
    },
    "quickFacts": {
        "trustBadges": [
            {
                "icon": "verified",
                "label": "OEM Certified",
                "color": "text-green-400",
                "display_order": 1,
            },
            {
                "icon": "workspace_premium",
                "label": "15+ Years",
                "color": "text-blue-400",
                "display_order": 2,
            },
            {
                "icon": "security",
                "label": "Licensed",
                "color": "text-purple-400",
                "display_order": 3,
            },
            {
                "icon": "thumb_up",
                "label": "BBB Rated",
                "color": "text-yellow-400",
                "display_order": 4,
            },
        ],
    },
    "repairProcessIntro": {
        "label": "Our Process",
        "heading": "How Our Repair Process Works",
        "description": "All pneumatic tools are evaluated through a structured inspection process. Repair recommendations, parts requirements, and service details are provided after assessment to ensure accurate diagnostics and quality workmanship.",
    },
    "whyChooseUs": {
        "label": "Why Choose CNS",
        "heading": "Professional Repair Standards for Industrial Operations",
        "subheading": "Our repair process prioritizes accuracy, safety, and long-term tool performance for industrial use.",
        "features": [
            {
                "icon": "query_stats",
                "title": "Professional Diagnostics",
                "description": "Structured inspection process identifies root causes and ensures accurate repair recommendations.",
                "display_order": 1,
            },
            {
                "icon": "inventory_2",
                "title": "OEM-Compatible Parts",
                "description": "Quality components from authorized suppliers ensure reliable, long-lasting repairs.",
                "display_order": 2,
            },
            {
                "icon": "precision_manufacturing",
                "title": "Precision Calibration",
                "description": "Calibration services for industrial air tools to maintain performance standards.",
                "display_order": 3,
            },
            {
                "icon": "location_on",
                "title": "In-Shop Service",
                "description": "Surrey, BC workshop—local on-site service eliminates shipping delays and damage risk.",
                "display_order": 4,
            },
        ],
    },
    "howItWorks": {
        "label": "Our Workflow",
        "heading": "Repair Request Workflow",
        "steps": [
            {
                "number": 1,
                "title": "Request an Assessment",
                "description": "Submit tool details online to begin the professional diagnostic process.",
                "display_order": 1,
            },
            {
                "number": 2,
                "title": "Bring Tools to Surrey",
                "description": "Drop off at our workshop—no shipping delays or damage risk. Local, on-site service only.",
                "display_order": 2,
            },
            {
                "number": 3,
                "title": "Diagnosis & Approval",
                "description": "Expert technicians identify root causes and provide transparent pricing before work starts.",
                "display_order": 3,
            },
            {
                "number": 4,
                "title": "Repair & Testing",
                "description": "OEM-compatible parts installation and rigorous quality testing—tools returned ready for production.",
                "display_order": 4,
            },
        ],
        "note": "Note: Final turnaround times are determined by the complexity of the diagnosis and specific parts availability.",
    },
    "industrialUseCases": {
        "label": "Use Cases",
        "heading": "Industrial Use Cases We Support",
        "subtitle": "These applications describe how pneumatic tools are used within industrial environments, regardless of industry classification.",
        "description": "Our services support pneumatic tools used in automotive repair & body shops, truck & fleet maintenance, manufacturing & assembly, metal fabrication & welding, construction & concrete trades, aerospace & aviation, marine & shipbuilding, oil & gas operations, mining & aggregates, and MRO (Maintenance, Repair & Operations) environments.",
    },
    "serviceArea": {
        "highlightedCities": ["Surrey", "Delta", "Burnaby", "New Westminster", "Coquitlam", "Langley", "Richmond", "Vancouver"],
    },
    "finalCta": {
        "heading": "Request Professional Pneumatic Tool Repair Services",
        "description": "Start the CNS diagnostic process today. Our specialists provide detailed repair assessments for industrial pneumatic tools.",
        "primaryButtonText": "Request a Repair Assessment",
        "secondaryButtonText": "Call Support",
    },
    "testimonials": [
        {
            "company": "Fraser Valley Auto Group",
            "person": "Marcus Chen",
            "title": "Fleet Maintenance Director",
            "industry": "directions_car",
            "industryName": "automotive",
            "quote": "CNS saved us over 40 hours of production downtime. Their diagnostic process identified the exact failure point in our impact wrenches, and the repair quality has been flawless for 8 months running.",
            "location": "Surrey, BC",
            "display_order": 0,
        },
        {
            "company": "Metro Fleet Services",
            "person": "Sarah Rodriguez",
            "title": "Maintenance Supervisor",
            "industry": "local_shipping",
            "industryName": "fleet",
            "quote": "We depend on CNS for pneumatic tool repairs across our truck and trailer maintenance operations. Their professional diagnostics and quality workmanship keep our fleet running reliably.",
            "location": "Delta, BC",
            "display_order": 1,
        },
        {
            "company": "Titan Construction Ltd",
            "person": "David Park",
            "title": "Equipment Supervisor",
            "industry": "construction",
            "industryName": "construction",
            "quote": "The team at CNS understands industrial requirements. They source genuine OEM parts and their repair work comes with confidence. Our tools perform like new after every service.",
            "location": "Burnaby, BC",
            "display_order": 2,
        },
    ],
    "active": True,
}


@router.get("/", response_model=HomePageContentResponse)
async def get_home_content():
    """
    Public endpoint to fetch home page content (singleton pattern).
    Returns default content if no document exists in database.
    """
    db = get_database()
    home_content = await db.home_content.find_one({"active": True})

    if not home_content:
        # Return default content if no document exists
        return HomePageContentResponse(**DEFAULT_HOME_CONTENT)

    # Convert ObjectId to string
    home_content = convert_objectid_to_str(home_content)
    return HomePageContentResponse(**home_content)


@router.put("/", response_model=HomePageContentResponse)
async def update_home_content(content_data: HomePageContentUpdate):
    """
    Admin endpoint to update home page content (upsert pattern).
    Creates document if doesn't exist, updates if it does.
    Ensures only one active document exists.
    """
    db = get_database()

    # Prepare update data
    update_data = content_data.model_dump(by_alias=True)
    update_data["updated_at"] = datetime.utcnow()
    update_data["active"] = True

    # Upsert: update if exists, create if doesn't
    result = await db.home_content.find_one_and_update(
        {"active": True},  # Find active document
        {"$set": update_data},  # Update with new data
        upsert=True,  # Create if doesn't exist
        return_document=True,  # Return updated document
    )

    if not result:
        raise HTTPException(status_code=500, detail="Failed to update home page content")

    # Convert ObjectId to string
    result = convert_objectid_to_str(result)
    return HomePageContentResponse(**result)
