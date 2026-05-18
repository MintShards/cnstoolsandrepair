import logging
import re
from fastapi import APIRouter, HTTPException, Depends
from typing import List
from bson import ObjectId
from datetime import datetime

from app.database import get_database
from app.models.supplier import SupplierCreate, SupplierUpdate, SupplierResponse
from app.models.auth import User
from app.dependencies.auth import require_admin
from app.utils.helpers import convert_objectid_to_str

router = APIRouter(prefix="/api/suppliers", tags=["suppliers"])
logger = logging.getLogger(__name__)


def _build_supplier_response(doc: dict) -> SupplierResponse:
    doc["id"] = doc.pop("_id")
    return SupplierResponse(**doc)


@router.get("/", response_model=List[SupplierResponse])
async def list_suppliers(
    current_user: User = Depends(require_admin)
):
    """List all active suppliers sorted alphabetically."""
    db = get_database()
    cursor = db.suppliers.find({"active": True}, sort=[("name", 1)])
    docs = await cursor.to_list(length=500)
    result = []
    for doc in docs:
        doc = convert_objectid_to_str(doc)
        result.append(_build_supplier_response(doc))
    return result


@router.post("/", response_model=SupplierResponse, status_code=201)
async def create_supplier(
    data: SupplierCreate,
    current_user: User = Depends(require_admin)
):
    """Create a new supplier. Rejects duplicate names (case-insensitive)."""
    db = get_database()

    existing = await db.suppliers.find_one({
        "name": {"$regex": f"^{re.escape(data.name)}$", "$options": "i"},
        "active": True
    })
    if existing:
        raise HTTPException(status_code=409, detail=f"Supplier '{data.name}' already exists.")

    doc = {
        "name": data.name,
        "email": data.email,
        "phone": data.phone,
        "contact_name": data.contact_name,
        "website": data.website,
        "active": True,
        "created_at": datetime.utcnow(),
    }
    result = await db.suppliers.insert_one(doc)
    created = await db.suppliers.find_one({"_id": result.inserted_id})
    created = convert_objectid_to_str(created)
    return _build_supplier_response(created)


@router.put("/{supplier_id}", response_model=SupplierResponse)
async def update_supplier(
    supplier_id: str,
    data: SupplierUpdate,
    current_user: User = Depends(require_admin)
):
    """Update supplier details (name, email, phone, contact_name, website)."""
    db = get_database()
    if not ObjectId.is_valid(supplier_id):
        raise HTTPException(status_code=404, detail="Supplier not found.")

    update_fields = {k: v for k, v in data.model_dump(exclude_unset=True).items() if v is not None}
    if not update_fields:
        raise HTTPException(status_code=400, detail="No fields provided to update.")

    # Check for duplicate name if name is being changed
    if "name" in update_fields:
        existing = await db.suppliers.find_one({
            "name": {"$regex": f"^{re.escape(update_fields['name'])}$", "$options": "i"},
            "active": True,
            "_id": {"$ne": ObjectId(supplier_id)}
        })
        if existing:
            raise HTTPException(status_code=409, detail=f"Supplier '{update_fields['name']}' already exists.")

    result = await db.suppliers.update_one(
        {"_id": ObjectId(supplier_id), "active": True},
        {"$set": update_fields}
    )
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Supplier not found.")

    updated = await db.suppliers.find_one({"_id": ObjectId(supplier_id)})
    updated = convert_objectid_to_str(updated)
    return _build_supplier_response(updated)


@router.delete("/{supplier_id}", status_code=204)
async def delete_supplier(
    supplier_id: str,
    current_user: User = Depends(require_admin)
):
    """Soft-delete a supplier (sets active=False)."""
    db = get_database()
    if not ObjectId.is_valid(supplier_id):
        raise HTTPException(status_code=404, detail="Supplier not found.")

    result = await db.suppliers.update_one(
        {"_id": ObjectId(supplier_id), "active": True},
        {"$set": {"active": False}}
    )
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Supplier not found.")
