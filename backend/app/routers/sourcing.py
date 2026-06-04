import logging
from datetime import datetime
from typing import List

from bson import ObjectId
from fastapi import APIRouter, Depends, HTTPException, Query
from slowapi import Limiter
from slowapi.util import get_remote_address

from app.database import get_database
from app.dependencies.auth import require_admin
from app.models.auth import User
from app.models.sourcing_request import SourcingRequest, SourcingQueueItem, SourcingLogEntry
from app.services.sourcing_email_service import send_bulk_sourcing_emails
from app.utils.helpers import convert_objectid_to_str

router = APIRouter(prefix="/api/parts-sourcing", tags=["parts-sourcing"])
logger = logging.getLogger(__name__)
limiter = Limiter(key_func=get_remote_address)

DEFAULT_SUBJECT = "Parts Pricing Request - CNS Tool Repair"


@router.get("/queue", response_model=List[SourcingQueueItem])
async def get_sourcing_queue(
    current_user: User = Depends(require_admin)
):
    """
    Return all parts flagged with needs_sourcing=True across all repair jobs and tools.
    """
    db = get_database()

    # Aggregate across repairs → tools → parts
    pipeline = [
        {"$match": {"tools": {"$exists": True}}},
        {"$project": {
            "request_number": 1,
            "tools": 1,
        }},
    ]

    queue = []
    async for job in db.repairs.aggregate(pipeline):
        job = convert_objectid_to_str(job)
        repair_id = job["id"] if "id" in job else job.get("_id", "")
        request_number = job.get("request_number", "")

        for tool_idx, tool in enumerate(job.get("tools", [])):
            tool_id = tool.get("tool_id", str(tool_idx))
            tool_type = tool.get("tool_type", "Unknown")
            tool_brand = tool.get("brand", None)
            tool_model = tool.get("model_number", None)

            for part_idx, part in enumerate(tool.get("parts", [])):
                if part.get("needs_sourcing", False):
                    queue.append(SourcingQueueItem(
                        repair_id=repair_id,
                        request_number=request_number,
                        tool_index=tool_idx,
                        tool_id=str(tool_id),
                        tool_type=tool_type,
                        tool_brand=tool_brand,
                        tool_model=tool_model,
                        part_index=part_idx,
                        part={
                            "name": part.get("name", ""),
                            "part_number": part.get("part_number"),
                            "quantity": part.get("sourcing_quantity") or part.get("quantity", 1),
                            "supplier": part.get("supplier"),
                            "status": part.get("status", "pending"),
                            "sourcing_emailed": part.get("sourcing_emailed", False),
                        }
                    ))

    return queue


@router.patch("/queue/{repair_id}/{tool_id}/{part_index}/quantity")
async def update_sourcing_quantity(
    repair_id: str,
    tool_id: str,
    part_index: int,
    quantity: int = Query(..., gt=0),
    current_user: User = Depends(require_admin),
):
    """Update the sourcing_quantity for a specific part without affecting the repair part quantity."""
    db = get_database()
    try:
        oid = ObjectId(repair_id)
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid repair ID")

    job = await db.repairs.find_one({"_id": oid})
    if not job:
        raise HTTPException(status_code=404, detail="Repair job not found")

    tools = job.get("tools", [])
    tool_idx = next((i for i, t in enumerate(tools) if t.get("tool_id") == tool_id), None)
    if tool_idx is None:
        raise HTTPException(status_code=404, detail="Tool not found")

    parts = tools[tool_idx].get("parts", [])
    if part_index < 0 or part_index >= len(parts):
        raise HTTPException(status_code=404, detail="Part not found")

    await db.repairs.update_one(
        {"_id": oid},
        {"$set": {
            f"tools.{tool_idx}.parts.{part_index}.sourcing_quantity": quantity,
            "updated_at": datetime.utcnow(),
        }}
    )
    return {"message": "Sourcing quantity updated"}


@router.post("/send")
async def send_sourcing_emails(
    request: SourcingRequest,
    current_user: User = Depends(require_admin)
):
    """
    Send bulk sourcing emails to all recipients — one email per recipient
    listing all selected parts. Rate limited to 20 emails per 5 minutes.
    """
    if len(request.recipients) > 20:
        raise HTTPException(
            status_code=429,
            detail="Maximum 20 recipients per send. Please split into smaller batches."
        )

    parts_data = [p.model_dump() for p in request.parts]

    # Fetch email template settings from business_settings
    db = get_database()
    biz_settings = await db.business_settings.find_one({"active": True})
    template = None
    default_subject = DEFAULT_SUBJECT
    if biz_settings and biz_settings.get("sourcingEmailTemplate"):
        raw = biz_settings["sourcingEmailTemplate"]
        default_subject = raw.get("defaultSubject") or DEFAULT_SUBJECT
        template = {
            "greeting": raw.get("greeting"),
            "body_text": raw.get("bodyText"),
            "closing_text": raw.get("closingText"),
            "footer_tagline": raw.get("footerTagline"),
            "footer_email": raw.get("footerEmail"),
            "footer_phone": raw.get("footerPhone"),
            "footer_website": raw.get("footerWebsite"),
            "footer_label": raw.get("footerLabel"),
            "cc": raw.get("cc"),
            "bcc": raw.get("bcc"),
            "from_email": raw.get("fromEmail"),
            "from_name": raw.get("fromName"),
        }

    subject = (request.subject or default_subject).strip()

    result = await send_bulk_sourcing_emails(
        recipients=[r.model_dump() for r in request.recipients],
        parts=parts_data,
        subject=subject,
        message=request.message,
        template=template,
    )

    sent_count = len(result["sent"])
    failed_count = len(result["failed"])
    status = (
        "sent" if failed_count == 0
        else "failed" if sent_count == 0
        else "partial_failure"
    )

    # Mark sourced parts as emailed in repair documents
    if sent_count > 0:
        for part in request.parts:
            if (
                part.repair_id
                and part.tool_index is not None
                and part.part_index is not None
            ):
                try:
                    await db.repairs.update_one(
                        {"_id": ObjectId(part.repair_id)},
                        {"$set": {
                            f"tools.{part.tool_index}.parts.{part.part_index}.sourcing_emailed": True
                        }}
                    )
                except Exception:
                    logger.warning(f"Could not mark part as emailed: repair={part.repair_id} tool={part.tool_index} part={part.part_index}")

    # Log to sourcing_logs collection
    log_entry = {
        "sent_at": datetime.utcnow(),
        "recipients": [r.model_dump() for r in request.recipients],
        "parts": parts_data,
        "subject": subject,
        "message": request.message,
        "status": status,
        "sent_count": sent_count,
        "failed_count": failed_count,
        "errors": result["failed"],
        "sent_by": current_user.email,
    }
    await db.sourcing_logs.insert_one(log_entry)

    logger.info(f"Sourcing emails: {sent_count} sent, {failed_count} failed")

    return {
        "status": status,
        "sent_count": sent_count,
        "failed_count": failed_count,
        "sent": result["sent"],
        "failed": result["failed"],
    }


@router.get("/history")
async def get_sourcing_history(
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=20, ge=1, le=100),
    current_user: User = Depends(require_admin)
):
    """Return paginated history of sent sourcing emails."""
    db = get_database()
    skip = (page - 1) * page_size

    total = await db.sourcing_logs.count_documents({})
    cursor = db.sourcing_logs.find(
        {},
        sort=[("sent_at", -1)],
        skip=skip,
        limit=page_size
    )
    docs = await cursor.to_list(length=page_size)

    entries = []
    for doc in docs:
        doc = convert_objectid_to_str(doc)
        doc["id"] = doc.pop("_id", doc.get("id", ""))
        entries.append(doc)

    return {
        "total": total,
        "page": page,
        "page_size": page_size,
        "items": entries,
    }
