from pydantic import BaseModel, Field
from typing import Optional


class IndustryCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=100)
    description: str = Field(..., min_length=1, max_length=500)
    icon: str = Field(default="business")
    active: bool = True


class IndustryUpdate(BaseModel):
    name: Optional[str] = Field(None, min_length=1, max_length=100)
    description: Optional[str] = Field(None, min_length=1, max_length=500)
    icon: Optional[str] = None
    active: Optional[bool] = None


class Industry(IndustryCreate):
    id: str = Field(alias="_id")

    class Config:
        populate_by_name = True
        json_schema_extra = {
            "example": {
                "_id": "507f1f77bcf86cd799439011",
                "name": "Automotive",
                "description": "Pneumatic tools for auto repair shops and manufacturing",
                "icon": "directions_car",
                "active": True,
            }
        }


class IndustryResponse(BaseModel):
    id: str
    name: str
    description: str
    icon: str
    active: bool
