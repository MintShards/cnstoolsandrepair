from pydantic import BaseModel, Field
from typing import Optional


class BrandCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=100)
    logo_url: str = Field(default="placeholder-logo.png")
    display_order: int = Field(default=0, ge=0)
    active: bool = True


class BrandUpdate(BaseModel):
    name: Optional[str] = Field(None, min_length=1, max_length=100)
    logo_url: Optional[str] = None
    display_order: Optional[int] = Field(None, ge=0)
    active: Optional[bool] = None


class Brand(BrandCreate):
    id: str = Field(alias="_id")

    class Config:
        populate_by_name = True
        json_schema_extra = {
            "example": {
                "_id": "507f1f77bcf86cd799439011",
                "name": "Ingersoll Rand",
                "logo_url": "ingersoll-rand-logo.png",
                "display_order": 1,
                "active": True,
            }
        }


class BrandResponse(BaseModel):
    id: str
    name: str
    logo_url: str
    display_order: int
    active: bool
