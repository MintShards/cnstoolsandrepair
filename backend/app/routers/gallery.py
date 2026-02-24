from fastapi import APIRouter, HTTPException, UploadFile, File
from typing import List
from bson import ObjectId
from datetime import datetime
from app.database import get_database
from app.models.gallery import GalleryPhotoCreate, GalleryPhotoResponse, GalleryPhotoUpdate
from app.services.file_service import save_upload_file
from app.utils.helpers import convert_objectid_to_str

router = APIRouter(prefix="/api/gallery", tags=["gallery"])


@router.get("/", response_model=List[GalleryPhotoResponse])
async def list_gallery_photos(active_only: bool = True):
    """Get all gallery photos, optionally filtered by active status"""
    db = get_database()

    query = {"active": True} if active_only else {}
    cursor = db.gallery_photos.find(query).sort("display_order", 1)

    photos = []
    async for photo in cursor:
        photo = convert_objectid_to_str(photo)
        photo["id"] = photo.pop("_id")
        photos.append(GalleryPhotoResponse(**photo))

    return photos


@router.post("/", response_model=GalleryPhotoResponse, status_code=201)
async def upload_gallery_photo(
    photo: UploadFile = File(...),
    display_order: int = 0
):
    """Upload a new gallery photo (admin endpoint)"""
    db = get_database()

    if not photo.filename:
        raise HTTPException(status_code=400, detail="No photo provided")

    # Save uploaded photo
    filename = await save_upload_file(photo)

    # Create gallery photo document
    photo_data = GalleryPhotoCreate(
        image_url=filename,
        display_order=display_order,
        active=True
    )

    # Insert into database
    photo_dict = photo_data.model_dump()
    photo_dict["created_at"] = datetime.utcnow()

    result = await db.gallery_photos.insert_one(photo_dict)

    # Fetch created photo
    created_photo = await db.gallery_photos.find_one({"_id": result.inserted_id})
    created_photo = convert_objectid_to_str(created_photo)
    created_photo["id"] = created_photo.pop("_id")

    return GalleryPhotoResponse(**created_photo)


@router.patch("/{photo_id}", response_model=GalleryPhotoResponse)
async def update_gallery_photo(photo_id: str, photo_update: GalleryPhotoUpdate):
    """Update gallery photo metadata (admin endpoint)"""
    db = get_database()

    if not ObjectId.is_valid(photo_id):
        raise HTTPException(status_code=400, detail="Invalid photo ID")

    # Update only provided fields
    update_data = photo_update.model_dump(exclude_unset=True)

    if not update_data:
        raise HTTPException(status_code=400, detail="No fields to update")

    result = await db.gallery_photos.update_one(
        {"_id": ObjectId(photo_id)},
        {"$set": update_data}
    )

    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Photo not found")

    # Fetch updated photo
    updated_photo = await db.gallery_photos.find_one({"_id": ObjectId(photo_id)})
    updated_photo = convert_objectid_to_str(updated_photo)
    updated_photo["id"] = updated_photo.pop("_id")

    return GalleryPhotoResponse(**updated_photo)


@router.delete("/{photo_id}", status_code=204)
async def delete_gallery_photo(photo_id: str):
    """Delete gallery photo (admin endpoint) - soft delete by setting active=False"""
    db = get_database()

    if not ObjectId.is_valid(photo_id):
        raise HTTPException(status_code=400, detail="Invalid photo ID")

    result = await db.gallery_photos.update_one(
        {"_id": ObjectId(photo_id)},
        {"$set": {"active": False}}
    )

    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Photo not found")

    return None
