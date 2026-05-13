import logging
import re
from fastapi import APIRouter, HTTPException, UploadFile, File, Form, Depends, Query
from typing import List, Optional
from bson import ObjectId
from datetime import datetime

from app.database import get_database
from app.models.parts_library import (
    LibraryBrandCreate, LibraryBrandUpdate, LibraryBrandResponse,
    LibraryModelCreate, LibraryModelUpdate, LibraryModelResponse,
    LibraryPartCreate, LibraryPartUpdate, LibraryPartResponse,
    CompatGroupCreate, CompatGroupUpdate, CompatGroupResponse,
    CompatiblePartsResponse, CompatiblePartsGroup,
)
from app.models.auth import User
from app.dependencies.auth import require_admin
from app.services.file_service import save_upload_file, delete_file
from app.utils.helpers import convert_objectid_to_str

router = APIRouter(prefix="/api/parts-library", tags=["parts-library"])
logger = logging.getLogger(__name__)


# ─── Helpers ─────────────────────────────────────────────────────────────────

def _to_object_id(id_str: str) -> ObjectId:
    try:
        return ObjectId(id_str)
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid ID format")


def _doc_to_brand(doc: dict, model_count: Optional[int] = None) -> LibraryBrandResponse:
    doc = convert_objectid_to_str(doc)
    doc["id"] = doc.pop("_id")
    if model_count is not None:
        doc["model_count"] = model_count
    return LibraryBrandResponse(**doc)


def _doc_to_model(doc: dict, brand_name: Optional[str] = None, part_count: Optional[int] = None) -> LibraryModelResponse:
    doc = convert_objectid_to_str(doc)
    doc["id"] = doc.pop("_id")
    if brand_name is not None:
        doc["brand_name"] = brand_name
    if part_count is not None:
        doc["part_count"] = part_count
    return LibraryModelResponse(**doc)


def _doc_to_part(doc: dict, brand_name: str = "", model_names: Optional[List[str]] = None,
                  group_names: Optional[List[str]] = None) -> LibraryPartResponse:
    doc = convert_objectid_to_str(doc)
    doc["id"] = doc.pop("_id")
    doc["brand_name"] = brand_name
    doc["model_names"] = model_names or []
    doc["compatibility_group_names"] = group_names or []
    return LibraryPartResponse(**doc)


def _doc_to_compat_group(doc: dict, part_count: Optional[int] = None) -> CompatGroupResponse:
    doc = convert_objectid_to_str(doc)
    doc["id"] = doc.pop("_id")
    if part_count is not None:
        doc["part_count"] = part_count
    return CompatGroupResponse(**doc)


async def _enrich_part(db, doc: dict) -> LibraryPartResponse:
    """Populate brand_name, model_names, and compat group names for a single part doc."""
    brand_name = ""
    if doc.get("brand_id"):
        try:
            brand = await db.parts_library_brands.find_one({"_id": _to_object_id(doc["brand_id"])})
            if brand:
                brand_name = brand.get("name", "")
        except Exception as e:
            logger.warning("Failed to fetch brand %s for part enrichment: %s", doc.get("brand_id"), e)

    model_names = []
    for mid in doc.get("model_ids", []):
        try:
            m = await db.parts_library_models.find_one({"_id": _to_object_id(mid)})
            if m:
                model_names.append(m.get("name", ""))
        except Exception as e:
            logger.warning("Failed to fetch model %s for part enrichment: %s", mid, e)

    group_names = []
    for gid in doc.get("compatibility_group_ids", []):
        try:
            g = await db.parts_library_compat_groups.find_one({"_id": _to_object_id(gid)})
            if g:
                group_names.append(g.get("name", ""))
        except Exception as e:
            logger.warning("Failed to fetch compat group %s for part enrichment: %s", gid, e)

    return _doc_to_part(doc, brand_name=brand_name, model_names=model_names, group_names=group_names)


async def _enrich_parts_batch(db, docs: list) -> List[LibraryPartResponse]:
    """Batch-enrich a list of part docs: 3 $in queries instead of N*M individual queries."""
    if not docs:
        return []

    # Collect all unique IDs across all docs
    all_brand_ids = set()
    all_model_ids = set()
    all_group_ids = set()
    for doc in docs:
        if doc.get("brand_id"):
            all_brand_ids.add(doc["brand_id"])
        for mid in doc.get("model_ids", []):
            all_model_ids.add(mid)
        for gid in doc.get("compatibility_group_ids", []):
            all_group_ids.add(gid)

    # Batch fetch brands
    brand_map: dict = {}
    if all_brand_ids:
        try:
            brand_oids = [_to_object_id(bid) for bid in all_brand_ids]
            cursor = db.parts_library_brands.find({"_id": {"$in": brand_oids}})
            async for b in cursor:
                brand_map[str(b["_id"])] = b.get("name", "")
        except Exception as e:
            logger.warning("Failed to batch-fetch brands for part enrichment: %s", e)

    # Batch fetch models
    model_map: dict = {}
    if all_model_ids:
        try:
            model_oids = [_to_object_id(mid) for mid in all_model_ids]
            cursor = db.parts_library_models.find({"_id": {"$in": model_oids}})
            async for m in cursor:
                model_map[str(m["_id"])] = m.get("name", "")
        except Exception as e:
            logger.warning("Failed to batch-fetch models for part enrichment: %s", e)

    # Batch fetch compat groups
    group_map: dict = {}
    if all_group_ids:
        try:
            group_oids = [_to_object_id(gid) for gid in all_group_ids]
            cursor = db.parts_library_compat_groups.find({"_id": {"$in": group_oids}})
            async for g in cursor:
                group_map[str(g["_id"])] = g.get("name", "")
        except Exception as e:
            logger.warning("Failed to batch-fetch compat groups for part enrichment: %s", e)

    # Build enriched responses
    results = []
    for doc in docs:
        brand_name = brand_map.get(doc.get("brand_id", ""), "")
        model_names = [model_map[mid] for mid in doc.get("model_ids", []) if mid in model_map]
        group_names = [group_map[gid] for gid in doc.get("compatibility_group_ids", []) if gid in group_map]
        results.append(_doc_to_part(doc, brand_name=brand_name, model_names=model_names, group_names=group_names))

    return results


# ─── Brands ──────────────────────────────────────────────────────────────────

@router.get("/brands", response_model=List[LibraryBrandResponse])
async def list_library_brands(
    active_only: bool = Query(True),
    current_user: User = Depends(require_admin),
):
    db = get_database()
    query = {"active": True} if active_only else {}
    cursor = db.parts_library_brands.find(query).sort("name", 1)
    docs = await cursor.to_list(length=None)

    results = []
    for doc in docs:
        brand_id = str(doc["_id"])
        count = await db.parts_library_models.count_documents({"brand_id": brand_id, "active": True})
        results.append(_doc_to_brand(doc, model_count=count))
    return results


@router.post("/brands", response_model=LibraryBrandResponse)
async def create_library_brand(
    name: str = Form(...),
    short_code: Optional[str] = Form(None),
    website: Optional[str] = Form(None),
    notes: Optional[str] = Form(None),
    logo: Optional[UploadFile] = File(None),
    current_user: User = Depends(require_admin),
):
    db = get_database()
    data = LibraryBrandCreate(name=name, short_code=short_code, website=website, notes=notes)

    existing = await db.parts_library_brands.find_one(
        {"name": {"$regex": f"^{re.escape(data.name)}$", "$options": "i"}}
    )
    if existing:
        raise HTTPException(status_code=400, detail=f"Brand '{data.name}' already exists")

    logo_url = None
    if logo and logo.filename:
        logo_url = await save_upload_file(logo, folder="parts_library/brands")

    now = datetime.utcnow()
    doc = {**data.model_dump(), "logo_url": logo_url, "active": True, "created_at": now, "updated_at": now}
    result = await db.parts_library_brands.insert_one(doc)
    created = await db.parts_library_brands.find_one({"_id": result.inserted_id})
    return _doc_to_brand(created, model_count=0)


@router.get("/brands/{brand_id}", response_model=LibraryBrandResponse)
async def get_library_brand(
    brand_id: str,
    current_user: User = Depends(require_admin),
):
    db = get_database()
    doc = await db.parts_library_brands.find_one({"_id": _to_object_id(brand_id)})
    if not doc:
        raise HTTPException(status_code=404, detail="Brand not found")
    count = await db.parts_library_models.count_documents({"brand_id": brand_id, "active": True})
    return _doc_to_brand(doc, model_count=count)


@router.put("/brands/{brand_id}", response_model=LibraryBrandResponse)
async def update_library_brand(
    brand_id: str,
    name: Optional[str] = Form(None),
    short_code: Optional[str] = Form(None),
    website: Optional[str] = Form(None),
    notes: Optional[str] = Form(None),
    logo: Optional[UploadFile] = File(None),
    current_user: User = Depends(require_admin),
):
    db = get_database()
    doc = await db.parts_library_brands.find_one({"_id": _to_object_id(brand_id)})
    if not doc:
        raise HTTPException(status_code=404, detail="Brand not found")

    data = LibraryBrandUpdate(name=name, short_code=short_code, website=website, notes=notes)
    updates = {k: v for k, v in data.model_dump(exclude_unset=True).items() if v is not None}

    if name and name.strip():
        existing = await db.parts_library_brands.find_one({
            "name": {"$regex": f"^{re.escape(data.name)}$", "$options": "i"},
            "_id": {"$ne": _to_object_id(brand_id)}
        })
        if existing:
            raise HTTPException(status_code=400, detail=f"Brand '{data.name}' already exists")

    if logo and logo.filename:
        if doc.get("logo_url"):
            await delete_file(doc["logo_url"])
        updates["logo_url"] = await save_upload_file(logo, folder="parts_library/brands")

    updates["updated_at"] = datetime.utcnow()
    await db.parts_library_brands.update_one({"_id": _to_object_id(brand_id)}, {"$set": updates})
    updated = await db.parts_library_brands.find_one({"_id": _to_object_id(brand_id)})
    count = await db.parts_library_models.count_documents({"brand_id": brand_id, "active": True})
    return _doc_to_brand(updated, model_count=count)


@router.delete("/brands/{brand_id}")
async def delete_library_brand(
    brand_id: str,
    current_user: User = Depends(require_admin),
):
    db = get_database()
    doc = await db.parts_library_brands.find_one({"_id": _to_object_id(brand_id)})
    if not doc:
        raise HTTPException(status_code=404, detail="Brand not found")
    await db.parts_library_brands.update_one(
        {"_id": _to_object_id(brand_id)},
        {"$set": {"active": False, "updated_at": datetime.utcnow()}}
    )
    return {"message": "Brand deactivated"}


# ─── Models ──────────────────────────────────────────────────────────────────

@router.get("/brands/{brand_id}/models", response_model=List[LibraryModelResponse])
async def list_library_models(
    brand_id: str,
    active_only: bool = Query(True),
    current_user: User = Depends(require_admin),
):
    db = get_database()
    brand = await db.parts_library_brands.find_one({"_id": _to_object_id(brand_id)})
    if not brand:
        raise HTTPException(status_code=404, detail="Brand not found")

    query = {"brand_id": brand_id}
    if active_only:
        query["active"] = True
    cursor = db.parts_library_models.find(query).sort("name", 1)
    docs = await cursor.to_list(length=None)

    brand_name = brand.get("name", "")
    results = []
    for doc in docs:
        model_id = str(doc["_id"])
        part_count = await db.parts_library_parts.count_documents({"model_ids": model_id, "active": True})
        results.append(_doc_to_model(doc, brand_name=brand_name, part_count=part_count))
    return results


@router.post("/brands/{brand_id}/models", response_model=LibraryModelResponse)
async def create_library_model(
    brand_id: str,
    body: LibraryModelCreate,
    current_user: User = Depends(require_admin),
):
    db = get_database()
    brand = await db.parts_library_brands.find_one({"_id": _to_object_id(brand_id)})
    if not brand:
        raise HTTPException(status_code=404, detail="Brand not found")

    existing = await db.parts_library_models.find_one({
        "brand_id": brand_id,
        "name": {"$regex": f"^{re.escape(body.name)}$", "$options": "i"}
    })
    if existing:
        raise HTTPException(status_code=400, detail=f"Model '{body.name}' already exists for this brand")

    now = datetime.utcnow()
    doc = {**body.model_dump(), "brand_id": brand_id, "diagram_urls": [], "active": True,
           "created_at": now, "updated_at": now}
    result = await db.parts_library_models.insert_one(doc)
    created = await db.parts_library_models.find_one({"_id": result.inserted_id})
    return _doc_to_model(created, brand_name=brand.get("name", ""), part_count=0)


@router.get("/models/{model_id}", response_model=LibraryModelResponse)
async def get_library_model(
    model_id: str,
    current_user: User = Depends(require_admin),
):
    db = get_database()
    doc = await db.parts_library_models.find_one({"_id": _to_object_id(model_id)})
    if not doc:
        raise HTTPException(status_code=404, detail="Model not found")

    brand = await db.parts_library_brands.find_one({"_id": _to_object_id(doc["brand_id"])})
    brand_name = brand.get("name", "") if brand else ""
    part_count = await db.parts_library_parts.count_documents({"model_ids": model_id, "active": True})
    return _doc_to_model(doc, brand_name=brand_name, part_count=part_count)


@router.put("/models/{model_id}", response_model=LibraryModelResponse)
async def update_library_model(
    model_id: str,
    body: LibraryModelUpdate,
    current_user: User = Depends(require_admin),
):
    db = get_database()
    doc = await db.parts_library_models.find_one({"_id": _to_object_id(model_id)})
    if not doc:
        raise HTTPException(status_code=404, detail="Model not found")

    updates = body.model_dump(exclude_unset=True)

    if "name" in updates and updates["name"]:
        existing = await db.parts_library_models.find_one({
            "brand_id": doc["brand_id"],
            "name": {"$regex": f"^{re.escape(updates['name'])}$", "$options": "i"},
            "_id": {"$ne": _to_object_id(model_id)}
        })
        if existing:
            raise HTTPException(status_code=400, detail=f"Model '{updates['name']}' already exists for this brand")

    updates["updated_at"] = datetime.utcnow()
    await db.parts_library_models.update_one({"_id": _to_object_id(model_id)}, {"$set": updates})

    updated = await db.parts_library_models.find_one({"_id": _to_object_id(model_id)})
    brand = await db.parts_library_brands.find_one({"_id": _to_object_id(updated["brand_id"])})
    brand_name = brand.get("name", "") if brand else ""
    part_count = await db.parts_library_parts.count_documents({"model_ids": model_id, "active": True})
    return _doc_to_model(updated, brand_name=brand_name, part_count=part_count)


@router.delete("/models/{model_id}")
async def delete_library_model(
    model_id: str,
    current_user: User = Depends(require_admin),
):
    db = get_database()
    doc = await db.parts_library_models.find_one({"_id": _to_object_id(model_id)})
    if not doc:
        raise HTTPException(status_code=404, detail="Model not found")
    await db.parts_library_models.update_one(
        {"_id": _to_object_id(model_id)},
        {"$set": {"active": False, "updated_at": datetime.utcnow()}}
    )
    return {"message": "Model deactivated"}


@router.post("/models/{model_id}/diagrams", response_model=LibraryModelResponse)
async def upload_model_diagram(
    model_id: str,
    diagram: UploadFile = File(...),
    current_user: User = Depends(require_admin),
):
    db = get_database()
    doc = await db.parts_library_models.find_one({"_id": _to_object_id(model_id)})
    if not doc:
        raise HTTPException(status_code=404, detail="Model not found")

    url = await save_upload_file(diagram, folder="parts_library/diagrams")
    await db.parts_library_models.update_one(
        {"_id": _to_object_id(model_id)},
        {"$push": {"diagram_urls": url}, "$set": {"updated_at": datetime.utcnow()}}
    )
    updated = await db.parts_library_models.find_one({"_id": _to_object_id(model_id)})
    brand = await db.parts_library_brands.find_one({"_id": _to_object_id(updated["brand_id"])})
    brand_name = brand.get("name", "") if brand else ""
    part_count = await db.parts_library_parts.count_documents({"model_ids": model_id, "active": True})
    return _doc_to_model(updated, brand_name=brand_name, part_count=part_count)


@router.delete("/models/{model_id}/diagrams")
async def delete_model_diagram(
    model_id: str,
    url: str = Query(...),
    current_user: User = Depends(require_admin),
):
    db = get_database()
    doc = await db.parts_library_models.find_one({"_id": _to_object_id(model_id)})
    if not doc:
        raise HTTPException(status_code=404, detail="Model not found")

    if url not in doc.get("diagram_urls", []):
        raise HTTPException(status_code=404, detail="Diagram URL not found on this model")

    await delete_file(url)
    await db.parts_library_models.update_one(
        {"_id": _to_object_id(model_id)},
        {"$pull": {"diagram_urls": url}, "$set": {"updated_at": datetime.utcnow()}}
    )
    return {"message": "Diagram removed"}


# ─── Compatibility Groups ─────────────────────────────────────────────────────

@router.get("/compat-groups", response_model=List[CompatGroupResponse])
async def list_compat_groups(
    active_only: bool = Query(True),
    current_user: User = Depends(require_admin),
):
    db = get_database()
    query = {"active": True} if active_only else {}
    cursor = db.parts_library_compat_groups.find(query).sort("name", 1)
    docs = await cursor.to_list(length=None)

    results = []
    for doc in docs:
        group_id = str(doc["_id"])
        count = await db.parts_library_parts.count_documents(
            {"compatibility_group_ids": group_id, "active": True}
        )
        results.append(_doc_to_compat_group(doc, part_count=count))
    return results


@router.post("/compat-groups", response_model=CompatGroupResponse)
async def create_compat_group(
    body: CompatGroupCreate,
    current_user: User = Depends(require_admin),
):
    db = get_database()
    existing = await db.parts_library_compat_groups.find_one(
        {"name": {"$regex": f"^{re.escape(body.name)}$", "$options": "i"}}
    )
    if existing:
        raise HTTPException(status_code=400, detail=f"Compatibility group '{body.name}' already exists")

    now = datetime.utcnow()
    doc = {**body.model_dump(), "active": True, "created_at": now, "updated_at": now}
    result = await db.parts_library_compat_groups.insert_one(doc)
    created = await db.parts_library_compat_groups.find_one({"_id": result.inserted_id})
    return _doc_to_compat_group(created, part_count=0)


@router.put("/compat-groups/{group_id}", response_model=CompatGroupResponse)
async def update_compat_group(
    group_id: str,
    body: CompatGroupUpdate,
    current_user: User = Depends(require_admin),
):
    db = get_database()
    doc = await db.parts_library_compat_groups.find_one({"_id": _to_object_id(group_id)})
    if not doc:
        raise HTTPException(status_code=404, detail="Compatibility group not found")

    updates = body.model_dump(exclude_unset=True)

    if "name" in updates and updates["name"]:
        existing = await db.parts_library_compat_groups.find_one({
            "name": {"$regex": f"^{re.escape(updates['name'])}$", "$options": "i"},
            "_id": {"$ne": _to_object_id(group_id)}
        })
        if existing:
            raise HTTPException(status_code=400, detail=f"Compatibility group '{updates['name']}' already exists")

    updates["updated_at"] = datetime.utcnow()
    await db.parts_library_compat_groups.update_one({"_id": _to_object_id(group_id)}, {"$set": updates})
    updated = await db.parts_library_compat_groups.find_one({"_id": _to_object_id(group_id)})
    count = await db.parts_library_parts.count_documents(
        {"compatibility_group_ids": group_id, "active": True}
    )
    return _doc_to_compat_group(updated, part_count=count)


@router.delete("/compat-groups/{group_id}")
async def delete_compat_group(
    group_id: str,
    current_user: User = Depends(require_admin),
):
    db = get_database()
    doc = await db.parts_library_compat_groups.find_one({"_id": _to_object_id(group_id)})
    if not doc:
        raise HTTPException(status_code=404, detail="Compatibility group not found")
    await db.parts_library_compat_groups.update_one(
        {"_id": _to_object_id(group_id)},
        {"$set": {"active": False, "updated_at": datetime.utcnow()}}
    )
    return {"message": "Compatibility group deactivated"}


@router.get("/compat-groups/{group_id}/parts", response_model=List[LibraryPartResponse])
async def list_compat_group_parts(
    group_id: str,
    current_user: User = Depends(require_admin),
):
    db = get_database()
    doc = await db.parts_library_compat_groups.find_one({"_id": _to_object_id(group_id)})
    if not doc:
        raise HTTPException(status_code=404, detail="Compatibility group not found")

    cursor = db.parts_library_parts.find({"compatibility_group_ids": group_id, "active": True}).sort("part_number", 1)
    docs = await cursor.to_list(length=None)
    return await _enrich_parts_batch(db, docs)


# ─── Parts ────────────────────────────────────────────────────────────────────

@router.get("/parts", response_model=dict)
async def list_library_parts(
    q: Optional[str] = Query(None),
    brand_id: Optional[str] = Query(None),
    model_id: Optional[str] = Query(None),
    compat_group_id: Optional[str] = Query(None),
    page: int = Query(1, ge=1),
    limit: int = Query(50, ge=1, le=200),
    current_user: User = Depends(require_admin),
):
    db = get_database()
    query: dict = {"active": True}

    if brand_id:
        query["brand_id"] = brand_id
    if model_id:
        query["model_ids"] = model_id
    if compat_group_id:
        query["compatibility_group_ids"] = compat_group_id

    if q and q.strip():
        term = re.escape(q.strip())
        query["$or"] = [
            {"part_number": {"$regex": term, "$options": "i"}},
            {"name": {"$regex": term, "$options": "i"}},
            {"description": {"$regex": term, "$options": "i"}},
            {"category": {"$regex": term, "$options": "i"}},
        ]

    total = await db.parts_library_parts.count_documents(query)
    skip = (page - 1) * limit
    cursor = db.parts_library_parts.find(query).sort([("brand_id", 1), ("part_number", 1)]).skip(skip).limit(limit)
    docs = await cursor.to_list(length=limit)

    parts = await _enrich_parts_batch(db, docs)
    return {
        "items": [p.model_dump() for p in parts],
        "total": total,
        "page": page,
        "limit": limit,
        "pages": (total + limit - 1) // limit,
    }


@router.post("/parts", response_model=LibraryPartResponse)
async def create_library_part(
    body: LibraryPartCreate,
    current_user: User = Depends(require_admin),
):
    db = get_database()
    brand = await db.parts_library_brands.find_one({"_id": _to_object_id(body.brand_id)})
    if not brand:
        raise HTTPException(status_code=404, detail="Brand not found")

    existing = await db.parts_library_parts.find_one({
        "brand_id": body.brand_id,
        "part_number": {"$regex": f"^{re.escape(body.part_number)}$", "$options": "i"}
    })
    if existing:
        raise HTTPException(status_code=400, detail=f"Part number '{body.part_number}' already exists for this brand")

    now = datetime.utcnow()
    doc = {**body.model_dump(), "diagram_urls": [], "active": True, "created_at": now, "updated_at": now}
    result = await db.parts_library_parts.insert_one(doc)
    created = await db.parts_library_parts.find_one({"_id": result.inserted_id})
    return await _enrich_part(db, created)


@router.get("/parts/{part_id}", response_model=LibraryPartResponse)
async def get_library_part(
    part_id: str,
    current_user: User = Depends(require_admin),
):
    db = get_database()
    doc = await db.parts_library_parts.find_one({"_id": _to_object_id(part_id)})
    if not doc:
        raise HTTPException(status_code=404, detail="Part not found")
    return await _enrich_part(db, doc)


@router.put("/parts/{part_id}", response_model=LibraryPartResponse)
async def update_library_part(
    part_id: str,
    body: LibraryPartUpdate,
    current_user: User = Depends(require_admin),
):
    db = get_database()
    doc = await db.parts_library_parts.find_one({"_id": _to_object_id(part_id)})
    if not doc:
        raise HTTPException(status_code=404, detail="Part not found")

    updates = body.model_dump(exclude_unset=True)

    if "brand_id" in updates and updates["brand_id"]:
        brand = await db.parts_library_brands.find_one({"_id": _to_object_id(updates["brand_id"])})
        if not brand:
            raise HTTPException(status_code=404, detail="Brand not found")

    if "part_number" in updates and updates["part_number"]:
        effective_brand_id = updates.get("brand_id") or doc["brand_id"]
        existing = await db.parts_library_parts.find_one({
            "brand_id": effective_brand_id,
            "part_number": {"$regex": f"^{re.escape(updates['part_number'])}$", "$options": "i"},
            "_id": {"$ne": _to_object_id(part_id)}
        })
        if existing:
            raise HTTPException(status_code=400, detail=f"Part number '{updates['part_number']}' already exists for this brand")

    updates["updated_at"] = datetime.utcnow()
    await db.parts_library_parts.update_one({"_id": _to_object_id(part_id)}, {"$set": updates})
    updated = await db.parts_library_parts.find_one({"_id": _to_object_id(part_id)})
    return await _enrich_part(db, updated)


@router.delete("/parts/{part_id}")
async def delete_library_part(
    part_id: str,
    current_user: User = Depends(require_admin),
):
    db = get_database()
    doc = await db.parts_library_parts.find_one({"_id": _to_object_id(part_id)})
    if not doc:
        raise HTTPException(status_code=404, detail="Part not found")
    await db.parts_library_parts.update_one(
        {"_id": _to_object_id(part_id)},
        {"$set": {"active": False, "updated_at": datetime.utcnow()}}
    )
    return {"message": "Part deactivated"}


@router.get("/parts/{part_id}/compatible", response_model=CompatiblePartsResponse)
async def get_compatible_parts(
    part_id: str,
    current_user: User = Depends(require_admin),
):
    db = get_database()
    doc = await db.parts_library_parts.find_one({"_id": _to_object_id(part_id)})
    if not doc:
        raise HTTPException(status_code=404, detail="Part not found")

    part_response = await _enrich_part(db, doc)
    group_ids = doc.get("compatibility_group_ids", [])

    compatibility_groups = []
    for gid in group_ids:
        group_doc = await db.parts_library_compat_groups.find_one({"_id": _to_object_id(gid)})
        if not group_doc or not group_doc.get("active", True):
            continue

        # Find all OTHER active parts in this group
        cursor = db.parts_library_parts.find({
            "compatibility_group_ids": gid,
            "active": True,
            "_id": {"$ne": _to_object_id(part_id)}
        }).sort("part_number", 1)
        group_parts_docs = await cursor.to_list(length=None)
        group_parts = await _enrich_parts_batch(db, group_parts_docs)

        count = await db.parts_library_parts.count_documents(
            {"compatibility_group_ids": gid, "active": True}
        )
        group_response = _doc_to_compat_group(group_doc, part_count=count)
        compatibility_groups.append(CompatiblePartsGroup(group=group_response, parts=group_parts))

    return CompatiblePartsResponse(part=part_response, compatibility_groups=compatibility_groups)


@router.post("/parts/{part_id}/diagrams", response_model=LibraryPartResponse)
async def upload_part_diagram(
    part_id: str,
    diagram: UploadFile = File(...),
    current_user: User = Depends(require_admin),
):
    db = get_database()
    doc = await db.parts_library_parts.find_one({"_id": _to_object_id(part_id)})
    if not doc:
        raise HTTPException(status_code=404, detail="Part not found")

    url = await save_upload_file(diagram, folder="parts_library/diagrams")
    await db.parts_library_parts.update_one(
        {"_id": _to_object_id(part_id)},
        {"$push": {"diagram_urls": url}, "$set": {"updated_at": datetime.utcnow()}}
    )
    updated = await db.parts_library_parts.find_one({"_id": _to_object_id(part_id)})
    return await _enrich_part(db, updated)


@router.delete("/parts/{part_id}/diagrams")
async def delete_part_diagram(
    part_id: str,
    url: str = Query(...),
    current_user: User = Depends(require_admin),
):
    db = get_database()
    doc = await db.parts_library_parts.find_one({"_id": _to_object_id(part_id)})
    if not doc:
        raise HTTPException(status_code=404, detail="Part not found")

    if url not in doc.get("diagram_urls", []):
        raise HTTPException(status_code=404, detail="Diagram URL not found on this part")

    await delete_file(url)
    await db.parts_library_parts.update_one(
        {"_id": _to_object_id(part_id)},
        {"$pull": {"diagram_urls": url}, "$set": {"updated_at": datetime.utcnow()}}
    )
    return {"message": "Diagram removed"}


# ─── Global Search ────────────────────────────────────────────────────────────

@router.get("/search", response_model=List[LibraryPartResponse])
async def search_parts(
    q: str = Query(..., min_length=1),
    limit: int = Query(30, ge=1, le=100),
    current_user: User = Depends(require_admin),
):
    db = get_database()
    term = re.escape(q.strip())
    query = {
        "active": True,
        "$or": [
            {"part_number": {"$regex": term, "$options": "i"}},
            {"name": {"$regex": term, "$options": "i"}},
            {"description": {"$regex": term, "$options": "i"}},
            {"category": {"$regex": term, "$options": "i"}},
            {"ref_number": {"$regex": term, "$options": "i"}},
        ]
    }
    cursor = db.parts_library_parts.find(query).sort("part_number", 1).limit(limit)
    docs = await cursor.to_list(length=limit)
    return await _enrich_parts_batch(db, docs)
