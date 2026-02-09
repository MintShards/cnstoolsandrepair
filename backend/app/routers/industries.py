from fastapi import APIRouter, HTTPException
from typing import List
from bson import ObjectId
from app.database import get_database
from app.models.industry import IndustryCreate, IndustryUpdate, IndustryResponse
from app.utils.helpers import convert_objectid_to_str

router = APIRouter(prefix="/api/industries", tags=["industries"])


@router.post("/", response_model=IndustryResponse, status_code=201)
async def create_industry(industry: IndustryCreate):
    """Create a new industry"""

    db = get_database()

    industry_dict = industry.model_dump()
    result = await db.industries.insert_one(industry_dict)

    created_industry = await db.industries.find_one({"_id": result.inserted_id})
    created_industry = convert_objectid_to_str(created_industry)

    return IndustryResponse(**created_industry)


@router.get("/", response_model=List[IndustryResponse])
async def list_industries(active_only: bool = True):
    """List all industries"""

    db = get_database()

    query = {"active": True} if active_only else {}
    cursor = db.industries.find(query).sort("name", 1)
    industries = await cursor.to_list(length=None)

    industries = [convert_objectid_to_str(industry) for industry in industries]
    return [IndustryResponse(**industry) for industry in industries]


@router.get("/{industry_id}", response_model=IndustryResponse)
async def get_industry(industry_id: str):
    """Get an industry by ID"""

    db = get_database()

    try:
        industry = await db.industries.find_one({"_id": ObjectId(industry_id)})
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid industry ID format")

    if not industry:
        raise HTTPException(status_code=404, detail="Industry not found")

    industry = convert_objectid_to_str(industry)
    return IndustryResponse(**industry)


@router.put("/{industry_id}", response_model=IndustryResponse)
async def update_industry(industry_id: str, industry: IndustryUpdate):
    """Update an industry"""

    db = get_database()

    update_data = industry.model_dump(exclude_unset=True)
    if not update_data:
        raise HTTPException(status_code=400, detail="No update data provided")

    try:
        result = await db.industries.update_one(
            {"_id": ObjectId(industry_id)},
            {"$set": update_data}
        )
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid industry ID format")

    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Industry not found")

    updated_industry = await db.industries.find_one({"_id": ObjectId(industry_id)})
    updated_industry = convert_objectid_to_str(updated_industry)

    return IndustryResponse(**updated_industry)


@router.delete("/{industry_id}", status_code=204)
async def delete_industry(industry_id: str):
    """Delete an industry (soft delete)"""

    db = get_database()

    try:
        result = await db.industries.update_one(
            {"_id": ObjectId(industry_id)},
            {"$set": {"active": False}}
        )
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid industry ID format")

    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Industry not found")

    return None
