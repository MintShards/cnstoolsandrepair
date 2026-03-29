import logging
from fastapi import APIRouter, HTTPException, UploadFile, File, Form, Depends
from typing import List, Optional
from bson import ObjectId
from pydantic import BaseModel
from app.database import get_database
from app.models.brand import BrandResponse
from app.utils.helpers import convert_objectid_to_str
from app.services.file_service import save_upload_file, delete_file
from app.dependencies.auth import require_admin

router = APIRouter(prefix="/api/brands", tags=["brands"])
logger = logging.getLogger(__name__)


class BrandOrderUpdate(BaseModel):
    id: str
    order: int


@router.post("/", response_model=BrandResponse, status_code=201, dependencies=[Depends(require_admin)])
async def create_brand(
    name: str = Form(...),
    active: bool = Form(True),
    authorized: bool = Form(False),
    logo: Optional[UploadFile] = File(None)
):
    """Create a new brand with optional logo upload"""

    db = get_database()

    # Handle logo upload if provided
    logo_url = None
    if logo:
        logo_url = await save_upload_file(logo, folder="brands")

    # Get the highest current order value and increment
    max_order_brand = await db.brands.find_one(sort=[("order", -1)])
    next_order = (max_order_brand.get("order", 0) + 1) if max_order_brand else 0

    brand_dict = {
        "name": name,
        "logo_url": logo_url,
        "active": active,
        "authorized": authorized,
        "order": next_order
    }

    result = await db.brands.insert_one(brand_dict)

    created_brand = await db.brands.find_one({"_id": result.inserted_id})
    created_brand = convert_objectid_to_str(created_brand)

    # Rename _id to id for BrandResponse
    created_brand["id"] = created_brand.pop("_id")

    return BrandResponse(**created_brand)


@router.get("/", response_model=List[BrandResponse])
async def list_brands(active_only: bool = True):
    """List all brands (sorted by custom order for carousel display)"""

    db = get_database()

    query = {"active": True} if active_only else {}
    cursor = db.brands.find(query).sort("order", 1)  # Sort by custom order field
    brands = await cursor.to_list(length=None)

    brands = [convert_objectid_to_str(brand) for brand in brands]

    # Rename _id to id for BrandResponse
    for brand in brands:
        brand["id"] = brand.pop("_id")

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

    # Rename _id to id for BrandResponse
    brand["id"] = brand.pop("_id")

    return BrandResponse(**brand)


@router.put("/reorder", status_code=200, dependencies=[Depends(require_admin)])
async def reorder_brands(brands: List[BrandOrderUpdate]):
    """Update the order of multiple brands for carousel display"""

    db = get_database()

    if not brands:
        raise HTTPException(status_code=400, detail="No brands provided")

    # Update each brand's order
    updated_count = 0
    for brand_update in brands:
        try:
            result = await db.brands.update_one(
                {"_id": ObjectId(brand_update.id)},
                {"$set": {"order": brand_update.order}}
            )
            if result.matched_count > 0:
                updated_count += 1
        except Exception as e:
            logger.warning(f"Error updating brand {brand_update.id}: {str(e)}")
            continue

    return {
        "success": True,
        "updated_count": updated_count,
        "message": f"Successfully updated order for {updated_count} brands"
    }


@router.put("/{brand_id}", response_model=BrandResponse, dependencies=[Depends(require_admin)])
async def update_brand(
    brand_id: str,
    name: Optional[str] = Form(None),
    active: Optional[bool] = Form(None),
    authorized: Optional[bool] = Form(None),
    logo: Optional[UploadFile] = File(None)
):
    """Update a brand with optional logo upload"""

    db = get_database()

    # Build update data
    update_data = {}
    if name is not None:
        update_data["name"] = name
    if active is not None:
        update_data["active"] = active
    if authorized is not None:
        update_data["authorized"] = authorized

    # Handle logo upload if provided
    if logo:
        # Get current brand to retrieve old logo URL for deletion
        try:
            current_brand = await db.brands.find_one({"_id": ObjectId(brand_id)})
            if current_brand and current_brand.get("logo_url"):
                # Delete old logo from Spaces before uploading new one
                old_logo_url = current_brand["logo_url"]
                deleted = await delete_file(old_logo_url)
                if not deleted:
                    logger.warning(f"Could not delete old logo: {old_logo_url}")
        except Exception as e:
            logger.error(f"Error deleting old logo: {str(e)}")

        # Upload new logo
        logo_url = await save_upload_file(logo, folder="brands")
        update_data["logo_url"] = logo_url

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

    # Rename _id to id for BrandResponse
    updated_brand["id"] = updated_brand.pop("_id")

    return BrandResponse(**updated_brand)


@router.delete("/{brand_id}", status_code=204, dependencies=[Depends(require_admin)])
async def delete_brand(brand_id: str):
    """Delete a brand permanently and remove logo from storage"""

    db = get_database()

    try:
        # Get brand to retrieve logo URL before deletion
        brand = await db.brands.find_one({"_id": ObjectId(brand_id)})

        if not brand:
            raise HTTPException(status_code=404, detail="Brand not found")

        # Delete logo from storage if it exists
        if brand.get("logo_url"):
            try:
                deleted = await delete_file(brand["logo_url"])
                if not deleted:
                    logger.warning(f"Could not delete logo: {brand['logo_url']}")
            except Exception as e:
                logger.error(f"Error deleting logo: {str(e)}")

        # Delete brand from database (hard delete)
        result = await db.brands.delete_one({"_id": ObjectId(brand_id)})

        if result.deleted_count == 0:
            raise HTTPException(status_code=500, detail="Failed to delete brand")

        return None

    except HTTPException:
        raise
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid brand ID format")
