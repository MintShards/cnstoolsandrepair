from pydantic import BaseModel, Field
from typing import Optional
from datetime import datetime


class GalleryPhotoBase(BaseModel):
    """Base schema for gallery photos"""
    image_url: str = Field(..., description="Filename of uploaded photo")
    display_order: int = Field(default=0, description="Order for displaying photos")
    active: bool = Field(default=True, description="Whether photo is visible")


class GalleryPhotoCreate(GalleryPhotoBase):
    """Schema for creating a new gallery photo"""
    pass


class GalleryPhotoUpdate(BaseModel):
    """Schema for updating gallery photo"""
    display_order: Optional[int] = None
    active: Optional[bool] = None


class GalleryPhoto(GalleryPhotoBase):
    """Full gallery photo document"""
    id: str = Field(alias="_id")
    created_at: datetime = Field(default_factory=datetime.utcnow)

    class Config:
        populate_by_name = True


class GalleryPhotoResponse(BaseModel):
    """API response schema for gallery photo"""
    id: str
    image_url: str
    display_order: int
    active: bool
    created_at: datetime

    class Config:
        populate_by_name = True
