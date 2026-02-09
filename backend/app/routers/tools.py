from fastapi import APIRouter, HTTPException
from typing import List
from bson import ObjectId
from app.database import get_database
from app.models.tool import ToolCreate, ToolUpdate, ToolResponse
from app.utils.helpers import convert_objectid_to_str

router = APIRouter(prefix="/api/tools", tags=["tools"])


@router.post("/", response_model=ToolResponse, status_code=201)
async def create_tool(tool: ToolCreate):
    """Create a new tool in catalog"""

    db = get_database()

    tool_dict = tool.model_dump()
    result = await db.tools_catalog.insert_one(tool_dict)

    created_tool = await db.tools_catalog.find_one({"_id": result.inserted_id})
    created_tool = convert_objectid_to_str(created_tool)

    return ToolResponse(**created_tool)


@router.get("/", response_model=List[ToolResponse])
async def list_tools(active_only: bool = True):
    """List all tools in catalog"""

    db = get_database()

    query = {"active": True} if active_only else {}
    cursor = db.tools_catalog.find(query).sort("category", 1)
    tools = await cursor.to_list(length=None)

    tools = [convert_objectid_to_str(tool) for tool in tools]
    return [ToolResponse(**tool) for tool in tools]


@router.get("/{tool_id}", response_model=ToolResponse)
async def get_tool(tool_id: str):
    """Get a tool by ID"""

    db = get_database()

    try:
        tool = await db.tools_catalog.find_one({"_id": ObjectId(tool_id)})
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid tool ID format")

    if not tool:
        raise HTTPException(status_code=404, detail="Tool not found")

    tool = convert_objectid_to_str(tool)
    return ToolResponse(**tool)


@router.put("/{tool_id}", response_model=ToolResponse)
async def update_tool(tool_id: str, tool: ToolUpdate):
    """Update a tool"""

    db = get_database()

    # Get only fields that were set
    update_data = tool.model_dump(exclude_unset=True)
    if not update_data:
        raise HTTPException(status_code=400, detail="No update data provided")

    try:
        result = await db.tools_catalog.update_one(
            {"_id": ObjectId(tool_id)},
            {"$set": update_data}
        )
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid tool ID format")

    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Tool not found")

    updated_tool = await db.tools_catalog.find_one({"_id": ObjectId(tool_id)})
    updated_tool = convert_objectid_to_str(updated_tool)

    return ToolResponse(**updated_tool)


@router.delete("/{tool_id}", status_code=204)
async def delete_tool(tool_id: str):
    """Delete a tool (soft delete by setting active=False)"""

    db = get_database()

    try:
        result = await db.tools_catalog.update_one(
            {"_id": ObjectId(tool_id)},
            {"$set": {"active": False}}
        )
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid tool ID format")

    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Tool not found")

    return None
