from fastapi import APIRouter, HTTPException, Depends
from datetime import datetime
from bson import ObjectId
from app.database import get_database
from app.models.settings import (
    BusinessSettingsUpdate,
    BusinessSettings,
    BusinessSettingsResponse
)
from app.utils.helpers import convert_objectid_to_str
from app.dependencies.auth import require_admin


router = APIRouter(prefix="/api/settings", tags=["settings"])


# Default settings to return if no settings exist in database
DEFAULT_SETTINGS = {
    "contact": {
        "phone": "(604) 555-0123",
        "phoneLink": "6045550123",
        "email": "contact@cnstoolsandrepair.com",
        "address": {
            "street": "Surrey, BC, Canada",
            "city": "Surrey",
            "province": "BC",
            "postalCode": "",
            "country": "Canada"
        }
    },
    "hours": {
        "weekdays": "Monday - Friday: 8:00 AM - 5:00 PM",
        "weekend": "Saturday - Sunday: Closed",
        "timezone": "PST"
    },
    "hero": {
        "headline": "Expert Pneumatic Tool Repair & Maintenance",
        "subheadline": "B2B industrial repair services in Surrey, BC. Minimize downtime with professional diagnostics, OEM parts, and 3-7 day turnaround.",
        "industries": ["Automotive", "Railway", "Construction"]
    },
    "services": [
        {
            "title": "Pneumatic Tool Repair",
            "description": "Complete diagnostic and repair services for all types of pneumatic tools.",
            "icon": "build"
        },
        {
            "title": "Tool Maintenance",
            "description": "Comprehensive maintenance services for specialty pneumatic tools.",
            "icon": "tune"
        },
        {
            "title": "Equipment Rental",
            "description": "Quality pneumatic tools available for rent while your equipment is being repaired.",
            "icon": "handshake"
        },
        {
            "title": "Used Tool Sales",
            "description": "Quality refurbished pneumatic tools available for purchase.",
            "icon": "sell"
        }
    ],
    "announcement": {
        "enabled": False,
        "message": "",
        "type": "info"
    },
    "serviceArea": "Metro Vancouver",
    "map": {
        "embedUrl": "https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d83327.28123825047!2d-122.90733839999999!3d49.1913462!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x5485d9c5644e2a21%3A0x9a1b6a0c0c5e5e5e!2sSurrey%2C%20BC!5e0!3m2!1sen!2sca!4v1234567890",
        "directionsUrl": "https://www.google.com/maps/dir/?api=1&destination=Surrey,BC,Canada"
    },
    "claims": {
        "toolTypesServiced": "20+",
        "qualityStandard": "Quality",
        "responseTime": "Same-day",
        "technicians": "Factory-Trained"
    },
    "social": {
        "facebook": "",
        "linkedin": "",
        "instagram": ""
    }
}


@router.get("/", response_model=BusinessSettingsResponse)
async def get_settings():
    """
    Public endpoint to fetch current business settings.
    Returns default settings if none exist in database.
    """
    db = get_database()

    # Fetch the single active settings document
    settings = await db.business_settings.find_one({"active": True})

    if not settings:
        # Return default settings if none exist
        return BusinessSettingsResponse(**DEFAULT_SETTINGS)

    # Convert ObjectId to string and return
    settings = convert_objectid_to_str(settings)
    return BusinessSettingsResponse(**settings)


@router.put("/", response_model=BusinessSettingsResponse, dependencies=[Depends(require_admin)])
async def update_settings(settings_data: BusinessSettingsUpdate):
    """
    Admin endpoint to update business settings.
    Creates new settings if none exist, updates existing otherwise.
    Ensures only one active settings document exists.

    Requires admin authentication.
    """
    db = get_database()

    # Prepare settings document
    settings_dict = settings_data.model_dump(by_alias=True)
    settings_dict["active"] = True
    settings_dict["updatedAt"] = datetime.utcnow()

    # Upsert: update if exists, create if doesn't
    # Filter by active=True ensures only one document is ever active
    result = await db.business_settings.update_one(
        {"active": True},
        {
            "$set": settings_dict,
            "$setOnInsert": {"createdAt": datetime.utcnow()}
        },
        upsert=True
    )

    # Fetch the updated/created document
    updated_settings = await db.business_settings.find_one({"active": True})

    if not updated_settings:
        raise HTTPException(status_code=500, detail="Failed to update settings")

    # Convert ObjectId to string
    updated_settings = convert_objectid_to_str(updated_settings)

    # TODO: Invalidate cache here if caching is implemented
    # Example: await cache.delete("business_settings")

    return BusinessSettingsResponse(**updated_settings)


@router.get("/health")
async def settings_health():
    """Health check for settings service"""
    db = get_database()

    # Check if settings exist
    settings_count = await db.business_settings.count_documents({"active": True})

    return {
        "status": "healthy",
        "settings_exist": settings_count > 0,
        "active_settings_count": settings_count
    }
