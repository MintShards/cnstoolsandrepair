import logging
import re
import uuid
from fastapi import APIRouter, HTTPException, UploadFile, File, Form, Depends, Query
from typing import List, Optional
from bson import ObjectId
from datetime import datetime

from app.database import get_database, get_next_work_order_number
from app.models.repair import (
    RepairJobCreate, RepairJobUpdate, RepairJobResponse,
    ToolItemCreate, ToolItemUpdate, ToolStatusUpdate,
    ToolItem, ToolItemResponse, RepairStatus, RepairSource,
    StatusHistoryEntry
)
from app.models.auth import User
from app.dependencies.auth import require_admin
from app.services.file_service import save_upload_file, delete_file
from app.utils.helpers import convert_objectid_to_str

router = APIRouter(prefix="/api/repairs", tags=["repairs"])
logger = logging.getLogger(__name__)


def _migrate_tool_parts(tool: dict) -> dict:
    """Migrate old parts_needed string to parts list for backward compat"""
    if "parts_needed" in tool and "parts" not in tool:
        old = tool.pop("parts_needed", None)
        if old and isinstance(old, str) and old.strip():
            tool["parts"] = [{"name": old.strip(), "quantity": 1, "unit_cost": None, "status": "pending"}]
        else:
            tool["parts"] = []
    elif "parts" not in tool:
        tool["parts"] = []
    # Remove legacy field if still present alongside new field
    tool.pop("parts_needed", None)
    return tool


def _build_tool_response(tool: dict) -> ToolItemResponse:
    """Convert a tool dict from DB into a ToolItemResponse"""
    return ToolItemResponse(**_migrate_tool_parts(tool))


def _build_job_response(job: dict) -> RepairJobResponse:
    """Convert a repair job dict from DB into a RepairJobResponse"""
    job["id"] = job.pop("_id")
    tools = [ToolItemResponse(**_migrate_tool_parts(t)) for t in job.get("tools", [])]
    job["tools"] = tools
    return RepairJobResponse(**job)


# ──────────────────────────────────────────────
# LIST
# ──────────────────────────────────────────────

@router.get("/", response_model=List[RepairJobResponse])
async def list_repair_jobs(
    skip: int = Query(default=0, ge=0),
    limit: int = Query(default=50, ge=1, le=200),
    status: Optional[str] = None,
    priority: Optional[str] = None,
    search: Optional[str] = None,
    customer_id: Optional[str] = None,
    current_user: User = Depends(require_admin)
):
    """List all repair jobs with optional filtering and search"""
    db = get_database()

    query = {}

    if customer_id:
        query["customer_id"] = customer_id

    if status:
        query["tools.status"] = status

    if priority:
        query["tools.priority"] = priority

    if search:
        escaped = re.escape(search)
        query["$or"] = [
            {"company_name": {"$regex": escaped, "$options": "i"}},
            {"contact_person": {"$regex": escaped, "$options": "i"}},
            {"email": {"$regex": escaped, "$options": "i"}},
            {"request_number": {"$regex": escaped, "$options": "i"}},
        ]

    cursor = db.repairs.find(query).sort("created_at", -1).skip(skip).limit(limit)
    jobs = await cursor.to_list(length=limit)
    jobs = [convert_objectid_to_str(j) for j in jobs]

    return [_build_job_response(j) for j in jobs]


# ──────────────────────────────────────────────
# CREATE (manual)
# ──────────────────────────────────────────────

async def _resolve_customer(db, job_data_dict: dict) -> dict:
    """
    Given job creation data, resolve/create a customer and return the customer fields
    to denormalize onto the job. Returns a dict with customer_id + flat customer fields.
    """
    customer_id = job_data_dict.get("customer_id")

    if customer_id:
        # Look up existing customer
        try:
            customer = await db.customers.find_one({"_id": ObjectId(customer_id)})
        except Exception:
            raise HTTPException(status_code=400, detail="Invalid customer ID format")
        if not customer:
            raise HTTPException(status_code=404, detail="Customer not found")
        return {
            "customer_id": customer_id,
            "company_name": customer.get("company_name"),
            "contact_person": customer.get("contact_person"),
            "email": customer.get("email"),
            "phone": customer.get("phone"),
            "address": customer.get("address"),
            "customer_notes": job_data_dict.get("customer_notes") or customer.get("customer_notes"),
        }
    else:
        # Inline customer fields — find or create
        email = str(job_data_dict.get("email", "")).lower().strip()
        if not email or not job_data_dict.get("contact_person") or not job_data_dict.get("phone"):
            raise HTTPException(
                status_code=422,
                detail="Either customer_id or contact_person + email + phone are required"
            )
        existing = await db.customers.find_one({"email": email})
        if existing:
            cid = str(existing["_id"])
        else:
            now = datetime.utcnow()
            new_customer = {
                "company_name": job_data_dict.get("company_name"),
                "contact_person": job_data_dict.get("contact_person"),
                "email": email,
                "phone": job_data_dict.get("phone"),
                "address": job_data_dict.get("address"),
                "customer_notes": job_data_dict.get("customer_notes"),
                "created_at": now,
                "updated_at": now,
            }
            result = await db.customers.insert_one(new_customer)
            cid = str(result.inserted_id)
        return {
            "customer_id": cid,
            "company_name": job_data_dict.get("company_name"),
            "contact_person": job_data_dict.get("contact_person"),
            "email": email,
            "phone": job_data_dict.get("phone"),
            "address": job_data_dict.get("address"),
            "customer_notes": job_data_dict.get("customer_notes"),
        }


@router.post("/", response_model=RepairJobResponse, status_code=201)
async def create_repair_job(
    job_data: RepairJobCreate,
    current_user: User = Depends(require_admin)
):
    """Create a new repair job manually"""
    db = get_database()

    request_number = await get_next_work_order_number()

    # Resolve/create customer and get denormalized fields
    job_data_dict = job_data.model_dump(exclude={"tools"})
    customer_fields = await _resolve_customer(db, job_data_dict)

    # Build tool items with generated tool_ids and initial status_history
    tools = []
    for tool_in in job_data.tools:
        tool = ToolItem(**tool_in.model_dump())
        tool_dict = tool.model_dump()
        # Add initial status history entry
        tool_dict["status_history"] = [{
            "status": RepairStatus.RECEIVED.value,
            "timestamp": datetime.utcnow(),
            "notes": "Job created"
        }]
        tools.append(tool_dict)

    job_dict = {
        "request_number": request_number,
        "source": job_data.source.value,
        "source_quote_id": job_data.source_quote_id,
        "tools": tools,
        "created_at": datetime.utcnow(),
        "updated_at": datetime.utcnow(),
    }
    job_dict.update(customer_fields)

    result = await db.repairs.insert_one(job_dict)

    created_job = await db.repairs.find_one({"_id": result.inserted_id})
    created_job = convert_objectid_to_str(created_job)

    return _build_job_response(created_job)


# ──────────────────────────────────────────────
# CONVERT FROM ONLINE REPAIR REQUEST
# ──────────────────────────────────────────────

@router.post("/from-request/{quote_id}", response_model=RepairJobResponse, status_code=201)
async def convert_from_request(
    quote_id: str,
    current_user: User = Depends(require_admin)
):
    """Convert an existing online repair request into a tracked repair job"""
    db = get_database()

    try:
        object_id = ObjectId(quote_id)
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid quote ID format")

    quote = await db.quotes.find_one({"_id": object_id})
    if not quote:
        raise HTTPException(status_code=404, detail="Repair request not found")

    # Check if already converted
    existing = await db.repairs.find_one({"source_quote_id": quote_id})
    if existing:
        raise HTTPException(
            status_code=409,
            detail="This repair request has already been converted to a repair job"
        )

    request_number = await get_next_work_order_number()

    # Map quote tools to repair tool items
    tools = []
    for qt in quote.get("tools", []):
        tool = {
            "tool_id": str(uuid.uuid4()),
            "tool_type": qt.get("tool_type", ""),
            "brand": qt.get("tool_brand", ""),
            "model_number": qt.get("tool_model", ""),
            "serial_number": None,
            "quantity": qt.get("quantity", 1),
            "remarks": qt.get("problem_description", ""),
            "parts": [],
            "labour_hours": None,
            "hourly_rate": None,
            "priority": "standard",
            "warranty": False,
            "zoho_quote_ref": None,
            "assigned_technician": None,
            "photos": [],
            "status": RepairStatus.RECEIVED.value,
            "date_received": datetime.utcnow(),
            "estimated_completion": None,
            "date_completed": None,
            "status_history": [{
                "status": RepairStatus.RECEIVED.value,
                "timestamp": datetime.utcnow(),
                "notes": f"Converted from online repair request {quote.get('request_number', quote_id)}"
            }]
        }
        tools.append(tool)

    # Find or create customer from quote data
    email = str(quote.get("email", "")).lower().strip()
    existing_customer = await db.customers.find_one({"email": email}) if email else None
    if existing_customer:
        customer_id = str(existing_customer["_id"])
    else:
        # Only create a customer record if quote has the required fields in valid format
        contact_person = quote.get("contact_person", "").strip()
        phone = quote.get("phone", "").strip()
        phone_pattern = r'^\d{3}-\d{3}-\d{4}$'
        if email and contact_person and re.match(phone_pattern, phone):
            now = datetime.utcnow()
            new_customer = {
                "company_name": quote.get("company_name") or None,
                "contact_person": contact_person,
                "email": email,
                "phone": phone,
                "address": None,
                "customer_notes": None,
                "created_at": now,
                "updated_at": now,
            }
            cust_result = await db.customers.insert_one(new_customer)
            customer_id = str(cust_result.inserted_id)
        else:
            customer_id = None

    job_dict = {
        "request_number": request_number,
        "customer_id": customer_id,
        "company_name": quote.get("company_name"),
        "contact_person": quote.get("contact_person", ""),
        "email": email,
        "phone": quote.get("phone", ""),
        "address": None,
        "customer_notes": None,
        "source": RepairSource.ONLINE_REQUEST.value,
        "source_quote_id": quote_id,
        "tools": tools,
        "created_at": datetime.utcnow(),
        "updated_at": datetime.utcnow(),
    }

    result = await db.repairs.insert_one(job_dict)

    # Mark the original request as converted
    await db.quotes.update_one(
        {"_id": object_id},
        {"$set": {"status": "converted", "updated_at": datetime.utcnow()}}
    )

    created_job = await db.repairs.find_one({"_id": result.inserted_id})
    created_job = convert_objectid_to_str(created_job)

    return _build_job_response(created_job)


# ──────────────────────────────────────────────
# GET ONE
# ──────────────────────────────────────────────

@router.get("/{job_id}", response_model=RepairJobResponse)
async def get_repair_job(
    job_id: str,
    current_user: User = Depends(require_admin)
):
    """Get a repair job by ID"""
    db = get_database()

    try:
        job = await db.repairs.find_one({"_id": ObjectId(job_id)})
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid job ID format")

    if not job:
        raise HTTPException(status_code=404, detail="Repair job not found")

    job = convert_objectid_to_str(job)
    return _build_job_response(job)


# ──────────────────────────────────────────────
# UPDATE JOB (customer/job-level fields)
# ──────────────────────────────────────────────

@router.put("/{job_id}", response_model=RepairJobResponse)
async def update_repair_job(
    job_id: str,
    job_update: RepairJobUpdate,
    current_user: User = Depends(require_admin)
):
    """Update repair job customer/company info"""
    db = get_database()

    try:
        object_id = ObjectId(job_id)
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid job ID format")

    existing = await db.repairs.find_one({"_id": object_id})
    if not existing:
        raise HTTPException(status_code=404, detail="Repair job not found")

    update_data = job_update.model_dump(exclude_unset=True)
    update_data["updated_at"] = datetime.utcnow()

    await db.repairs.update_one({"_id": object_id}, {"$set": update_data})

    updated_job = await db.repairs.find_one({"_id": object_id})
    updated_job = convert_objectid_to_str(updated_job)
    return _build_job_response(updated_job)


# ──────────────────────────────────────────────
# DELETE JOB
# ──────────────────────────────────────────────

@router.delete("/{job_id}", status_code=204)
async def delete_repair_job(
    job_id: str,
    current_user: User = Depends(require_admin)
):
    """Delete a repair job and all associated tool photos"""
    db = get_database()

    try:
        object_id = ObjectId(job_id)
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid job ID format")

    job = await db.repairs.find_one({"_id": object_id})
    if not job:
        raise HTTPException(status_code=404, detail="Repair job not found")

    # Delete all photos across all tools
    for tool in job.get("tools", []):
        for photo in tool.get("photos", []):
            try:
                await delete_file(photo)
            except Exception as e:
                logger.warning(f"Failed to delete photo {photo}: {str(e)}")

    result = await db.repairs.delete_one({"_id": object_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=500, detail="Failed to delete repair job")

    return None


# ──────────────────────────────────────────────
# ADD TOOL TO JOB
# ──────────────────────────────────────────────

@router.post("/{job_id}/tools", response_model=RepairJobResponse, status_code=201)
async def add_tool(
    job_id: str,
    tool_data: ToolItemCreate,
    current_user: User = Depends(require_admin)
):
    """Add a tool item to an existing repair job"""
    db = get_database()

    try:
        object_id = ObjectId(job_id)
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid job ID format")

    existing = await db.repairs.find_one({"_id": object_id})
    if not existing:
        raise HTTPException(status_code=404, detail="Repair job not found")

    tool = ToolItem(**tool_data.model_dump())
    tool_dict = tool.model_dump()
    tool_dict["status_history"] = [{
        "status": RepairStatus.RECEIVED.value,
        "timestamp": datetime.utcnow(),
        "notes": "Tool added to job"
    }]

    await db.repairs.update_one(
        {"_id": object_id},
        {
            "$push": {"tools": tool_dict},
            "$set": {"updated_at": datetime.utcnow()}
        }
    )

    updated_job = await db.repairs.find_one({"_id": object_id})
    updated_job = convert_objectid_to_str(updated_job)
    return _build_job_response(updated_job)


# ──────────────────────────────────────────────
# UPDATE TOOL FIELDS
# ──────────────────────────────────────────────

@router.put("/{job_id}/tools/{tool_id}", response_model=RepairJobResponse)
async def update_tool(
    job_id: str,
    tool_id: str,
    tool_update: ToolItemUpdate,
    current_user: User = Depends(require_admin)
):
    """Update a tool item's fields within a repair job"""
    db = get_database()

    try:
        object_id = ObjectId(job_id)
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid job ID format")

    job = await db.repairs.find_one({"_id": object_id})
    if not job:
        raise HTTPException(status_code=404, detail="Repair job not found")

    # Find the tool
    tools = job.get("tools", [])
    tool_index = next((i for i, t in enumerate(tools) if t.get("tool_id") == tool_id), None)
    if tool_index is None:
        raise HTTPException(status_code=404, detail="Tool not found in this repair job")

    # Build update with only provided fields
    update_fields = tool_update.model_dump(exclude_unset=True)
    set_data = {f"tools.{tool_index}.{k}": v for k, v in update_fields.items()}
    set_data["updated_at"] = datetime.utcnow()

    await db.repairs.update_one({"_id": object_id}, {"$set": set_data})

    updated_job = await db.repairs.find_one({"_id": object_id})
    updated_job = convert_objectid_to_str(updated_job)
    return _build_job_response(updated_job)


# ──────────────────────────────────────────────
# UPDATE TOOL STATUS
# ──────────────────────────────────────────────

@router.put("/{job_id}/tools/{tool_id}/status", response_model=RepairJobResponse)
async def update_tool_status(
    job_id: str,
    tool_id: str,
    status_update: ToolStatusUpdate,
    current_user: User = Depends(require_admin)
):
    """Update a tool's repair status and append to status history"""
    db = get_database()

    try:
        object_id = ObjectId(job_id)
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid job ID format")

    job = await db.repairs.find_one({"_id": object_id})
    if not job:
        raise HTTPException(status_code=404, detail="Repair job not found")

    tools = job.get("tools", [])
    tool_index = next((i for i, t in enumerate(tools) if t.get("tool_id") == tool_id), None)
    if tool_index is None:
        raise HTTPException(status_code=404, detail="Tool not found in this repair job")

    now = datetime.utcnow()
    history_entry = {
        "status": status_update.status.value,
        "timestamp": now,
        "notes": status_update.notes
    }

    set_data = {
        f"tools.{tool_index}.status": status_update.status.value,
        "updated_at": now
    }

    # Set date_completed if reaching completed status
    if status_update.status == RepairStatus.COMPLETED:
        set_data[f"tools.{tool_index}.date_completed"] = now

    # Update estimated_completion if provided
    if status_update.estimated_completion:
        set_data[f"tools.{tool_index}.estimated_completion"] = status_update.estimated_completion

    await db.repairs.update_one(
        {"_id": object_id},
        {
            "$set": set_data,
            "$push": {f"tools.{tool_index}.status_history": history_entry}
        }
    )

    updated_job = await db.repairs.find_one({"_id": object_id})
    updated_job = convert_objectid_to_str(updated_job)
    return _build_job_response(updated_job)


# ──────────────────────────────────────────────
# UPLOAD PHOTO TO TOOL
# ──────────────────────────────────────────────

@router.post("/{job_id}/tools/{tool_id}/photos", response_model=RepairJobResponse)
async def upload_tool_photo(
    job_id: str,
    tool_id: str,
    photo: UploadFile = File(...),
    current_user: User = Depends(require_admin)
):
    """Upload a photo for a specific tool in a repair job"""
    db = get_database()

    try:
        object_id = ObjectId(job_id)
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid job ID format")

    job = await db.repairs.find_one({"_id": object_id})
    if not job:
        raise HTTPException(status_code=404, detail="Repair job not found")

    tools = job.get("tools", [])
    tool_index = next((i for i, t in enumerate(tools) if t.get("tool_id") == tool_id), None)
    if tool_index is None:
        raise HTTPException(status_code=404, detail="Tool not found in this repair job")

    if not photo.filename:
        raise HTTPException(status_code=400, detail="No file provided")

    filename = await save_upload_file(photo, folder="repairs")

    await db.repairs.update_one(
        {"_id": object_id},
        {
            "$push": {f"tools.{tool_index}.photos": filename},
            "$set": {"updated_at": datetime.utcnow()}
        }
    )

    updated_job = await db.repairs.find_one({"_id": object_id})
    updated_job = convert_objectid_to_str(updated_job)
    return _build_job_response(updated_job)


# ──────────────────────────────────────────────
# REMOVE TOOL FROM JOB
# ──────────────────────────────────────────────

@router.delete("/{job_id}/tools/{tool_id}", response_model=RepairJobResponse)
async def remove_tool(
    job_id: str,
    tool_id: str,
    current_user: User = Depends(require_admin)
):
    """Remove a tool item from a repair job"""
    db = get_database()

    try:
        object_id = ObjectId(job_id)
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid job ID format")

    job = await db.repairs.find_one({"_id": object_id})
    if not job:
        raise HTTPException(status_code=404, detail="Repair job not found")

    tools = job.get("tools", [])
    tool = next((t for t in tools if t.get("tool_id") == tool_id), None)
    if tool is None:
        raise HTTPException(status_code=404, detail="Tool not found in this repair job")

    # Delete associated photos
    for photo in tool.get("photos", []):
        try:
            await delete_file(photo)
        except Exception as e:
            logger.warning(f"Failed to delete tool photo {photo}: {str(e)}")

    await db.repairs.update_one(
        {"_id": object_id},
        {
            "$pull": {"tools": {"tool_id": tool_id}},
            "$set": {"updated_at": datetime.utcnow()}
        }
    )

    updated_job = await db.repairs.find_one({"_id": object_id})
    updated_job = convert_objectid_to_str(updated_job)
    return _build_job_response(updated_job)
