from pydantic import BaseModel, Field
from typing import Optional


class ToolCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=200)
    category: str = Field(..., min_length=1, max_length=100)
    description: str = Field(..., min_length=1, max_length=1000)
    icon: str = Field(default="build", min_length=1, max_length=50)
    image_url: str = Field(default="placeholder-tool.jpg")
    display_order: int = Field(default=0, ge=0)
    active: bool = True


class ToolUpdate(BaseModel):
    name: Optional[str] = Field(None, min_length=1, max_length=200)
    category: Optional[str] = Field(None, min_length=1, max_length=100)
    description: Optional[str] = Field(None, min_length=1, max_length=1000)
    icon: Optional[str] = Field(None, min_length=1, max_length=50)
    image_url: Optional[str] = None
    display_order: Optional[int] = Field(None, ge=0)
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
                "icon": "construction",
                "image_url": "impact-wrench.jpg",
                "display_order": 1,
                "active": True,
            }
        }


class ToolResponse(BaseModel):
    id: str
    name: str
    category: str
    description: str
    icon: str
    image_url: str
    display_order: int
    active: bool
