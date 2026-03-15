from fastapi import APIRouter, HTTPException
from datetime import datetime
from app.database import get_database
from app.models.contact_content import (
    ContactContentUpdate,
    ContactContentResponse
)
from app.utils.helpers import convert_objectid_to_str


router = APIRouter(prefix="/api/contact-content", tags=["contact-content"])


# Default contact page content
DEFAULT_CONTACT_CONTENT = {
    "hero": {
        "label": "Get In Touch",
        "heading": "Contact CNS Tools and Repair",
        "description": "Have questions about pneumatic tool repair or maintenance? Contact our Surrey workshop or request a repair assessment below."
    }
}


@router.get("/", response_model=ContactContentResponse)
async def get_contact_content():
    """
    Public endpoint to fetch contact page content.
    Returns default content if none exists in database.
    """
    db = get_database()

    # Fetch the single active contact content document
    content = await db.contact_page_content.find_one({"active": True})

    if not content:
        # Return default content if none exists
        return ContactContentResponse(**DEFAULT_CONTACT_CONTENT)

    # Convert ObjectId to string and return
    content = convert_objectid_to_str(content)
    return ContactContentResponse(**content)


@router.put("/", response_model=ContactContentResponse)
async def update_contact_content(content_data: ContactContentUpdate):
    """
    Admin endpoint to update contact page content.
    Creates new content if none exist, updates existing otherwise.
    Ensures only one active content document exists.

    TODO: Add authentication middleware to protect this endpoint
    Example: @router.put("/", dependencies=[Depends(verify_admin)])
    """
    db = get_database()

    # Prepare content document
    content_dict = content_data.model_dump(by_alias=True, exclude_unset=True)
    content_dict["active"] = True
    content_dict["updatedAt"] = datetime.utcnow()

    # Upsert: update if exists, create if doesn't
    # Filter by active=True ensures only one document is ever active
    result = await db.contact_page_content.update_one(
        {"active": True},
        {
            "$set": content_dict,
            "$setOnInsert": {
                "createdAt": datetime.utcnow(),
                **{k: v for k, v in DEFAULT_CONTACT_CONTENT.items() if k not in content_dict}
            }
        },
        upsert=True
    )

    # Fetch the updated/created document
    updated_content = await db.contact_page_content.find_one({"active": True})

    if not updated_content:
        raise HTTPException(status_code=500, detail="Failed to update contact content")

    # Convert ObjectId to string
    updated_content = convert_objectid_to_str(updated_content)

    return ContactContentResponse(**updated_content)


@router.get("/health")
async def contact_content_health():
    """Health check for contact content service"""
    db = get_database()

    # Check if content exists
    content_count = await db.contact_page_content.count_documents({"active": True})

    return {
        "status": "healthy",
        "content_exists": content_count > 0,
        "active_content_count": content_count
    }
