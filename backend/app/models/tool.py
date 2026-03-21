from pydantic import BaseModel, Field
from typing import Optional
from enum import Enum


class ToolCategory(str, Enum):
    AIR_TOOLS = "air_tools"
    ELECTRIC_TOOLS = "electric_tools"
    LIFTING_EQUIPMENT = "lifting_equipment"


class ToolCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=200)
    icon: Optional[str] = Field(default="build", min_length=1, max_length=50)
    description: str = Field(..., min_length=1, max_length=1000)
    category: ToolCategory = Field(..., description="Tool category: air_tools, electric_tools, or lifting_equipment")
    active: bool = True


class ToolUpdate(BaseModel):
    name: Optional[str] = Field(None, min_length=1, max_length=200)
    icon: Optional[str] = Field(None, min_length=1, max_length=50)
    description: Optional[str] = Field(None, min_length=1, max_length=1000)
    category: Optional[ToolCategory] = None
    active: Optional[bool] = None


class Tool(ToolCreate):
    id: str = Field(alias="_id")

    class Config:
        populate_by_name = True
        json_schema_extra = {
            "example": {
                "_id": "507f1f77bcf86cd799439011",
                "name": "Impact Wrenches",
                "icon": "build",
                "description": "High-torque pneumatic impact wrenches for heavy-duty applications",
                "category": "air_tools",
                "active": True,
            }
        }


class ToolResponse(BaseModel):
    id: str
    name: str
    icon: str = "build"
    description: str
    category: str
    active: bool
