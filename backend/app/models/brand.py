from pydantic import BaseModel, Field
from typing import Optional


class BrandCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=100)
    logo_url: str = Field(default="placeholder-logo.png")
    active: bool = True
    authorized: bool = False
    order: int = Field(default=0)


class BrandUpdate(BaseModel):
    name: Optional[str] = Field(None, min_length=1, max_length=100)
    logo_url: Optional[str] = None
    active: Optional[bool] = None
    authorized: Optional[bool] = None
    order: Optional[int] = None


class Brand(BrandCreate):
    id: str = Field(alias="_id")

    class Config:
        populate_by_name = True
        json_schema_extra = {
            "example": {
                "_id": "507f1f77bcf86cd799439011",
                "name": "Ingersoll Rand",
                "logo_url": "ingersoll-rand-logo.png",
                "active": True,
                "authorized": False,
                "order": 0,
            }
        }


class BrandResponse(BaseModel):
    id: str
    name: str
    logo_url: Optional[str] = None
    active: bool
    authorized: bool = False
    order: int = 0
