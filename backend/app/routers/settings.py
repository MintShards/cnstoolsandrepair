from fastapi import APIRouter, HTTPException, Depends
from datetime import datetime
from bson import ObjectId
from app.database import get_database
from app.models.settings import (
    BusinessSettingsUpdate,
    BusinessSettings,
    BusinessSettingsResponse,
    SourcingEmailTemplateModel,
    WorkOrderEmailTemplateModel,
)
from app.utils.helpers import convert_objectid_to_str
from app.dependencies.auth import require_admin


router = APIRouter(prefix="/api/settings", tags=["settings"])


DEFAULT_SETTINGS = {
    "contact": {
        "phone": "(778) 488-0777",
        "phoneLink": "7784880777",
        "email": "service@cnstoolrepair.com",
        "address": {
            "street": "Unit 65 13335 115 Ave",
            "city": "Surrey",
            "province": "BC",
            "postalCode": "V3R 0R8",
            "country": "Canada"
        }
    },
    "hours": {
        "weekdays": "Monday - Friday: 9:00 AM - 4:00 PM",
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
            "description": "Complete diagnostics and repair services for industrial pneumatic tools including impact wrenches, grinders, drills, and air ratchets.",
            "icon": "build"
        },
        {
            "title": "Hydraulic Repair",
            "description": "Diagnostics and repair for hydraulic jacks, two-stage jacks, rams, pumps, and bottle jacks used in automotive and industrial operations.",
            "icon": "compress"
        },
        {
            "title": "Lifting Equipment",
            "description": "Inspection, safety testing, and repair for chain hoists, lever hoists, and other lifting equipment used in industrial workplaces.",
            "icon": "engineering"
        },
        {
            "title": "Electric Tool Repair",
            "description": "Professional repair services for heavy-duty electric tools used in automotive, construction, and manufacturing environments.",
            "icon": "power"
        },
        {
            "title": "Tool Maintenance",
            "description": "Preventative maintenance and servicing to extend the life and performance of your pneumatic and electric tools.",
            "icon": "settings"
        },
        {
            "title": "New/Used Tool Sales",
            "description": "Quality new and used industrial tools available for automotive, manufacturing, and construction applications.",
            "icon": "inventory_2"
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
    },
    "staleDays": 3,
    "defaultMarkupPercentage": 30.0,
    "sourcingEmailTemplate": {
        "defaultSubject": "Parts Pricing Request - CNS Tool Repair",
        "greeting": "Hi",
        "bodyText": "We would like to request pricing and availability for the parts listed below. When you have a moment, please reply with your best price and estimated lead time for any items you are able to supply. We truly appreciate your time and assistance.",
        "closingText": "Thank you for your time. We look forward to hearing from you.",
        "footerTagline": "Industrial Pneumatic Tool Repair & Maintenance",
        "footerEmail": "purchasing@cnstoolrepair.com",
        "footerPhone": "778-488-0777",
        "footerWebsite": "cnstoolrepair.com",
        "footerLabel": "Supplier & Parts Inquiries",
        "cc": "",
        "bcc": "",
        "fromEmail": "",
        "fromName": "",
    },
    "workOrderEmailTemplate": {
        "fromEmail": "service@cnstoolrepair.com",
        "fromName": "CNS Tool Repair",
        "defaultSubject": "Your Work Order {work_order_number} - CNS Tool Repair",
        "greeting": "Hi {customer_name},",
        "bodyText": "Thank you for bringing your tool(s) in for service. Please find your work order attached. We will be in touch once our technician has had a chance to assess your equipment.",
        "closingText": "If you have any questions, feel free to reply to this email or give us a call.",
        "footerTagline": "Industrial Pneumatic Tool Repair & Maintenance",
        "footerEmail": "service@cnstoolrepair.com",
        "footerPhone": "(236) 885-9782",
        "footerWebsite": "cnstoolrepair.com",
        "cc": "",
        "bcc": "",
    },
}


@router.get("/", response_model=BusinessSettingsResponse)
async def get_settings():
    """
    Public endpoint to fetch current business settings.
    Returns default settings if none exist in database.
    """
    db = get_database()

    settings = await db.business_settings.find_one({"active": True})

    if not settings:
        return BusinessSettingsResponse(**DEFAULT_SETTINGS)

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

    settings_dict = settings_data.model_dump(by_alias=True)
    settings_dict["active"] = True
    settings_dict["updatedAt"] = datetime.utcnow()

    result = await db.business_settings.update_one(
        {"active": True},
        {
            "$set": settings_dict,
            "$setOnInsert": {"createdAt": datetime.utcnow()}
        },
        upsert=True
    )

    updated_settings = await db.business_settings.find_one({"active": True})

    if not updated_settings:
        raise HTTPException(status_code=500, detail="Failed to update settings")

    updated_settings = convert_objectid_to_str(updated_settings)

    return BusinessSettingsResponse(**updated_settings)


@router.get("/health")
async def settings_health():
    """Health check for settings service"""
    db = get_database()

    settings_count = await db.business_settings.count_documents({"active": True})

    return {
        "status": "healthy",
        "settings_exist": settings_count > 0,
        "active_settings_count": settings_count
    }
