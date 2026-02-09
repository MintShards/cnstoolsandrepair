from pydantic import BaseModel, Field
from typing import Optional


class ToolCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=200)
    category: str = Field(..., min_length=1, max_length=100)
    description: str = Field(..., min_length=1, max_length=1000)
    image_url: str = Field(default="placeholder-tool.jpg")
    active: bool = True


class ToolUpdate(BaseModel):
    name: Optional[str] = Field(None, min_length=1, max_length=200)
    category: Optional[str] = Field(None, min_length=1, max_length=100)
    description: Optional[str] = Field(None, min_length=1, max_length=1000)
    image_url: Optional[str] = None
    active: Optional[bool] = None


class Tool(ToolCreate):
    id: str = Field(alias="_id")

    class Config:
        populate_by_name = True
        json_schema_extra = {
            "example": {
                "_id": "507f1f77bcf86cd799439011",
                "name": "Impact Wrenches",
                "category": "impact_tools",
                "description": "High-torque pneumatic impact wrenches for heavy-duty applications",
                "image_url": "impact-wrench.jpg",
                "active": True,
            }
        }


class ToolResponse(BaseModel):
    id: str
    name: str
    category: str
    description: str
    image_url: str
    active: bool
