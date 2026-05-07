import logging
import re
from fastapi import APIRouter, HTTPException, Depends
from typing import List
from bson import ObjectId
from datetime import datetime

from app.database import get_database
from app.models.technician import TechnicianCreate, TechnicianResponse
from app.models.auth import User
from app.dependencies.auth import require_admin
from app.utils.helpers import convert_objectid_to_str

router = APIRouter(prefix="/api/technicians", tags=["technicians"])
logger = logging.getLogger(__name__)


def _build_technician_response(doc: dict) -> TechnicianResponse:
    doc["id"] = doc.pop("_id")
    return TechnicianResponse(**doc)


@router.get("/", response_model=List[TechnicianResponse])
async def list_technicians(
    current_user: User = Depends(require_admin)
):
    """List all active technicians sorted alphabetically."""
    db = get_database()
    cursor = db.technicians.find({"active": True}, sort=[("name", 1)])
    docs = await cursor.to_list(length=500)
    result = []
    for doc in docs:
        doc = convert_objectid_to_str(doc)
        result.append(_build_technician_response(doc))
    return result


@router.post("/", response_model=TechnicianResponse, status_code=201)
async def create_technician(
    data: TechnicianCreate,
    current_user: User = Depends(require_admin)
):
    """Create a new technician. Rejects duplicate names (case-insensitive)."""
    db = get_database()

    existing = await db.technicians.find_one({
        "name": {"$regex": f"^{re.escape(data.name)}$", "$options": "i"},
        "active": True
    })
    if existing:
        raise HTTPException(status_code=409, detail=f"Technician '{data.name}' already exists.")

    doc = {
        "name": data.name,
        "active": True,
        "created_at": datetime.utcnow(),
    }
    result = await db.technicians.insert_one(doc)
    created = await db.technicians.find_one({"_id": result.inserted_id})
    created = convert_objectid_to_str(created)
    return _build_technician_response(created)


@router.delete("/{technician_id}", status_code=204)
async def delete_technician(
    technician_id: str,
    current_user: User = Depends(require_admin)
):
    """Soft-delete a technician (sets active=False)."""
    db = get_database()
    if not ObjectId.is_valid(technician_id):
        raise HTTPException(status_code=404, detail="Technician not found.")

    result = await db.technicians.update_one(
        {"_id": ObjectId(technician_id), "active": True},
        {"$set": {"active": False}}
    )
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Technician not found.")
