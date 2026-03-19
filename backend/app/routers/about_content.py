from datetime import datetime

from fastapi import APIRouter, HTTPException, Depends

from app.database import get_database
from app.models.page_content import AboutContentResponse, AboutContentUpdate
from app.utils.helpers import convert_objectid_to_str
from app.dependencies.auth import require_admin


router = APIRouter(prefix="/api/about-content", tags=["about-content"])


# Default about content to return if none exists in database
DEFAULT_ABOUT_CONTENT = {
    "page_heading": "Industrial pneumatic tool repair and maintenance services in Surrey, BC",
    "company_story": "Industrial pneumatic tool repair services based in Surrey, British Columbia. We provide comprehensive repair, maintenance, rental, and sales services for businesses across automotive, fleet maintenance, manufacturing, metal fabrication, construction, oil & gas, aerospace, marine, mining, and MRO sectors. Our technicians bring years of hands-on experience servicing pneumatic tools used in demanding industrial environments.",
    "mission_statement": "Our mission is to minimize equipment downtime for industrial businesses through professional diagnostics, quality repairs, and reliable service.",
    "team_description": "Our on-site facility is equipped with state-of-the-art diagnostic tools and staffed by certified technicians with years of hands-on experience repairing pneumatic tools from all major brands.",
    "updated_at": datetime.utcnow()
}


@router.get("/", response_model=AboutContentResponse)
async def get_about_content():
    """
    Public endpoint to fetch about page content.
    Returns default content if none exists in database.
    This is a singleton document (only one about_content document).
    """
    db = get_database()

    # Fetch the single about content document
    about_content = await db.about_content.find_one({"active": True})

    if not about_content:
        # Return default content if none exists
        return AboutContentResponse(**DEFAULT_ABOUT_CONTENT)

    # Convert ObjectId to string and return
    about_content = convert_objectid_to_str(about_content)
    return AboutContentResponse(**about_content)


@router.put("/", response_model=AboutContentResponse, dependencies=[Depends(require_admin)])
async def update_about_content(content_data: AboutContentUpdate):
    """
    Admin endpoint to update about page content.
    Creates new content if none exists, updates existing otherwise.
    Ensures only one active about_content document exists.

    Requires admin authentication.
    """
    db = get_database()

    # Prepare content document
    content_dict = content_data.model_dump(by_alias=True)
    content_dict["active"] = True
    content_dict["updated_at"] = datetime.utcnow()

    # Upsert: update if exists, create if doesn't
    # Filter by active=True ensures only one document is ever active
    result = await db.about_content.update_one(
        {"active": True},
        {
            "$set": content_dict,
            "$setOnInsert": {"createdAt": datetime.utcnow()}
        },
        upsert=True
    )

    # Fetch the updated/created document
    updated_content = await db.about_content.find_one({"active": True})

    if not updated_content:
        raise HTTPException(status_code=500, detail="Failed to update about content")

    # Convert ObjectId to string
    updated_content = convert_objectid_to_str(updated_content)

    return AboutContentResponse(**updated_content)


@router.get("/health")
async def about_content_health():
    """Health check for about content service"""
    db = get_database()

    # Check if content exists
    content_count = await db.about_content.count_documents({"active": True})

    return {
        "status": "healthy",
        "content_exists": content_count > 0,
        "active_content_count": content_count
    }
