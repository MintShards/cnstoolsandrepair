from fastapi import APIRouter, HTTPException
from typing import List
from bson import ObjectId
from app.database import get_database
from app.models.brand import BrandCreate, BrandUpdate, BrandResponse
from app.utils.helpers import convert_objectid_to_str

router = APIRouter(prefix="/api/brands", tags=["brands"])


@router.post("/", response_model=BrandResponse, status_code=201)
async def create_brand(brand: BrandCreate):
    """Create a new brand"""

    db = get_database()

    brand_dict = brand.model_dump()
    result = await db.brands.insert_one(brand_dict)

    created_brand = await db.brands.find_one({"_id": result.inserted_id})
    created_brand = convert_objectid_to_str(created_brand)

    return BrandResponse(**created_brand)


@router.get("/", response_model=List[BrandResponse])
async def list_brands(active_only: bool = True):
    """List all brands"""

    db = get_database()

    query = {"active": True} if active_only else {}
    cursor = db.brands.find(query).sort("display_order", 1)
    brands = await cursor.to_list(length=None)

    brands = [convert_objectid_to_str(brand) for brand in brands]
    return [BrandResponse(**brand) for brand in brands]


@router.get("/{brand_id}", response_model=BrandResponse)
async def get_brand(brand_id: str):
    """Get a brand by ID"""

    db = get_database()

    try:
        brand = await db.brands.find_one({"_id": ObjectId(brand_id)})
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid brand ID format")

    if not brand:
        raise HTTPException(status_code=404, detail="Brand not found")

    brand = convert_objectid_to_str(brand)
    return BrandResponse(**brand)


@router.put("/{brand_id}", response_model=BrandResponse)
async def update_brand(brand_id: str, brand: BrandUpdate):
    """Update a brand"""

    db = get_database()

    update_data = brand.model_dump(exclude_unset=True)
    if not update_data:
        raise HTTPException(status_code=400, detail="No update data provided")

    try:
        result = await db.brands.update_one(
            {"_id": ObjectId(brand_id)},
            {"$set": update_data}
        )
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid brand ID format")

    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Brand not found")

    updated_brand = await db.brands.find_one({"_id": ObjectId(brand_id)})
    updated_brand = convert_objectid_to_str(updated_brand)

    return BrandResponse(**updated_brand)


@router.delete("/{brand_id}", status_code=204)
async def delete_brand(brand_id: str):
    """Delete a brand (soft delete)"""

    db = get_database()

    try:
        result = await db.brands.update_one(
            {"_id": ObjectId(brand_id)},
            {"$set": {"active": False}}
        )
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid brand ID format")

    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Brand not found")

    return None
