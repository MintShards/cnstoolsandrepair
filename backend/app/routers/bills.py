"""Bills — supplier bills and counter receipts. Admin only.

The buying side of the shop: parts for jobs, consumables, equipment. Zoho
Books stays the accounting system (the optional zoho_bill_number is a
cross-reference, not a gate); this is the operational record — what came
in, what is still unpaid, what is overdue, which work order it belonged to,
with the paper attached.

Rules that keep the record honest:
- Overdue is derived from due_date at read time, never stored.
- Status moves ONLY through the status route, so every change lands in
  status_history with who did it (same shape as repair tools).
- Edits, attachment changes and deletions go to the activity log; the
  logged/paid events are derived from the bill itself by routers/activity.py.
- Attachments upload PRIVATE ("bills" folder) and are viewed through the
  bill-scoped redirect below, so only admins can fetch a receipt.
"""
import logging
import re
from datetime import date, datetime, timedelta
from typing import List, Optional

from bson import ObjectId
from fastapi import APIRouter, Depends, File, HTTPException, Query, Response, UploadFile, status

from app.database import get_database, get_next_bill_number
from app.dependencies.auth import require_admin
from app.models.auth import User
from app.models.bill import (
    ALLOWED_BILL_TRANSITIONS,
    BILL_STATUS_LABELS,
    PAYMENT_FIELDS,
    BillCreate,
    BillLine,
    BillResponse,
    BillStatusUpdate,
    BillUpdate,
    validate_bill_transition,
)
from app.routers.photos import stored_file_redirect
from app.routers.tasks import _pacific_today_ymd, _resolve_repair
from app.services.activity_service import actor_ref, diff_bill, record_activity
from app.services.file_service import delete_file, save_upload_file
from app.utils.helpers import convert_objectid_to_str

router = APIRouter(prefix="/api/bills", tags=["bills"])
logger = logging.getLogger(__name__)

BILL_SORT_FIELDS = {
    "due_date": "due_date",
    "bill_date": "bill_date",
    "total": "total",
    "created_at": "created_at",
    "supplier_name": "supplier_name",
    "status": "status",
}
MAX_ATTACHMENTS = 10
DUE_SOON_DAYS = 7
_NOT_VOID = {"$ne": "void"}
_SEARCH_FIELDS = (
    "bill_number", "vendor_invoice_number", "supplier_name", "zoho_bill_number",
    "notes", "lines.description", "lines.part_number",
)


def _build_bill_response(doc: dict) -> BillResponse:
    doc = convert_objectid_to_str(doc)
    doc["id"] = doc.pop("_id")
    return BillResponse(**doc)


def _oid(bill_id: str) -> ObjectId:
    if not ObjectId.is_valid(bill_id):
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Bill not found")
    return ObjectId(bill_id)


async def _get_bill(db, oid: ObjectId) -> dict:
    doc = await db.bills.find_one({"_id": oid})
    if not doc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Bill not found")
    return doc


def _month_bounds(ym: str) -> tuple:
    """[first day, first day of the next month) as YYYY-MM-DD strings — a
    plain string range works because the dates are zero-padded."""
    year, month = int(ym[:4]), int(ym[5:7])
    nxt = date(year + 1, 1, 1) if month == 12 else date(year, month + 1, 1)
    return f"{year:04d}-{month:02d}-01", nxt.strftime("%Y-%m-%d")


def _add_days(ymd: str, days: int) -> str:
    return (date.fromisoformat(ymd) + timedelta(days=days)).strftime("%Y-%m-%d")


def _attachment_name(filename: Optional[str]) -> Optional[str]:
    """Display name only — the stored file is a UUID. Never keep path bits."""
    if not filename:
        return None
    name = filename.replace("\\", "/").rsplit("/", 1)[-1].strip()
    return name[:200] or None


async def _resolve_supplier(db, supplier_id: Optional[str], supplier_name: Optional[str]):
    """(supplier_id, snapshot name). An id must point at an ACTIVE supplier;
    without one the typed name stands on its own (one-off vendor)."""
    if supplier_id:
        if not ObjectId.is_valid(supplier_id):
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Supplier not found")
        doc = await db.suppliers.find_one({"_id": ObjectId(supplier_id), "active": True}, {"name": 1})
        if not doc:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Supplier not found")
        return supplier_id, doc["name"]
    name = (supplier_name or "").strip()
    if not name:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Supplier is required")
    return None, name


async def _prepare_lines(db, lines: List[BillLine]) -> list:
    """Snapshot request numbers for linked work orders and compute line totals
    server-side — neither is ever trusted from the client."""
    out = []
    resolved: dict = {}
    for line in lines:
        d = line.model_dump()
        rid = d.get("repair_id")
        if rid:
            if rid not in resolved:
                resolved[rid] = await _resolve_repair(db, rid)
            d["repair_id"], d["request_number"] = resolved[rid]
        else:
            d["repair_id"] = None
            d["request_number"] = None
        unit = d.get("unit_price")
        d["line_total"] = round((d.get("quantity") or 1) * unit, 2) if unit is not None else None
        out.append(d)
    return out


async def _totals_by_currency(db, match: dict) -> dict:
    """{'CAD': 1234.5, 'USD': 80.0} — money is never summed across currencies."""
    totals: dict = {}
    async for row in db.bills.aggregate([
        {"$match": match},
        {"$group": {"_id": "$currency", "total": {"$sum": "$total"}}},
    ]):
        totals[row["_id"] or "CAD"] = round(float(row["total"] or 0), 2)
    return totals


# /summary MUST be defined before /{bill_id}
@router.get("/summary")
async def get_bills_summary(current_user: User = Depends(require_admin)):
    """Sidebar badge + the three tiles at the top of the Bills section.
    Void bills never count; "this month" is by bill date (shop-local)."""
    db = get_database()
    today = _pacific_today_ymd()
    month_start, month_end = _month_bounds(today[:7])
    unpaid = {"status": "unpaid"}
    month_match = {"status": _NOT_VOID, "bill_date": {"$gte": month_start, "$lt": month_end}}

    unpaid_count = await db.bills.count_documents(unpaid)
    overdue_count = await db.bills.count_documents({**unpaid, "due_date": {"$lt": today}})
    due_soon_count = await db.bills.count_documents(
        {**unpaid, "due_date": {"$gte": today, "$lte": _add_days(today, DUE_SOON_DAYS)}})
    month_count = await db.bills.count_documents(month_match)

    return {
        "unpaid_count": unpaid_count,
        "overdue_count": overdue_count,
        "due_soon_count": due_soon_count,
        "month": today[:7],
        "month_count": month_count,
        "unpaid_total": await _totals_by_currency(db, unpaid),
        "month_total": await _totals_by_currency(db, month_match),
    }


@router.get("/", response_model=List[BillResponse])
async def list_bills(
    response: Response,
    skip: int = Query(default=0, ge=0),
    limit: int = Query(default=50, ge=1, le=200),
    status_filter: Optional[str] = Query(default=None, alias="status"),
    overdue: bool = Query(default=False),
    supplier_id: Optional[str] = Query(default=None),
    category: Optional[str] = Query(default=None,
                                    pattern="^(parts|consumables|tools_equipment|services|other)$"),
    month: Optional[str] = Query(default=None, pattern=r"^\d{4}-\d{2}$"),
    repair_id: Optional[str] = Query(default=None),
    q: Optional[str] = Query(default=None, max_length=100),
    sort_by: str = Query(default="due_date"),
    sort_dir: str = Query(default="asc", pattern="^(asc|desc)$"),
    current_user: User = Depends(require_admin),
):
    """Paginated, server-sorted bills. `status` is a comma list (`all` lifts
    the default non-void filter); `overdue=true` means unpaid and past due;
    `month` filters on the bill date."""
    db = get_database()
    query: dict = {}

    if status_filter and status_filter != "all":
        wanted = [s.strip() for s in status_filter.split(",") if s.strip()]
        unknown = [s for s in wanted if s not in ALLOWED_BILL_TRANSITIONS]
        if unknown:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST,
                                detail=f"Unknown status: {', '.join(unknown)}")
        query["status"] = wanted[0] if len(wanted) == 1 else {"$in": wanted}
    elif not status_filter:
        query["status"] = _NOT_VOID
    if overdue:
        query["status"] = "unpaid"
        query["due_date"] = {"$lt": _pacific_today_ymd()}
    if supplier_id:
        query["supplier_id"] = supplier_id
    if category:
        query["category"] = category
    if month:
        try:
            month_start, month_end = _month_bounds(month)
        except ValueError:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid month")
        query["bill_date"] = {"$gte": month_start, "$lt": month_end}
    if repair_id:
        query["lines.repair_id"] = repair_id
    if q and q.strip():
        pattern = re.escape(q.strip())
        query["$or"] = [{f: {"$regex": pattern, "$options": "i"}} for f in _SEARCH_FIELDS]

    if sort_by not in BILL_SORT_FIELDS:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Cannot sort by '{sort_by}'. Allowed: {', '.join(sorted(BILL_SORT_FIELDS))}",
        )
    sort_key = BILL_SORT_FIELDS[sort_by]
    direction = 1 if sort_dir == "asc" else -1

    total = await db.bills.count_documents(query)
    response.headers["X-Total-Count"] = str(total)
    response.headers["Access-Control-Expose-Headers"] = "X-Total-Count"

    pipeline: list = [{"$match": query}]
    if sort_key == "due_date":
        # Bills without a due date sort last in either direction.
        sentinel = "9999-12-31" if direction == 1 else ""
        pipeline.append({"$addFields": {"_due_key": {"$ifNull": ["$due_date", sentinel]}}})
        sort_key = "_due_key"
    pipeline += [
        # _id breaks ties so pagination stays stable across pages.
        {"$sort": {sort_key: direction, "_id": 1}},
        {"$skip": skip},
        {"$limit": limit},
    ]

    docs = []
    async for doc in db.bills.aggregate(pipeline):
        doc.pop("_due_key", None)
        docs.append(doc)
    return [_build_bill_response(doc) for doc in docs]


@router.post("/", response_model=BillResponse, status_code=status.HTTP_201_CREATED)
async def create_bill(data: BillCreate, current_user: User = Depends(require_admin)):
    """Log a bill (owed) or a receipt (already paid)."""
    db = get_database()
    now = datetime.utcnow()
    today = _pacific_today_ymd()
    supplier_id, supplier_name = await _resolve_supplier(db, data.supplier_id, data.supplier_name)
    lines = await _prepare_lines(db, data.lines)
    actor = actor_ref(current_user)
    paid = data.status == "paid"

    doc = {
        "bill_number": await get_next_bill_number(),
        "supplier_id": supplier_id,
        "supplier_name": supplier_name,
        "vendor_invoice_number": data.vendor_invoice_number,
        "category": data.category,
        "status": data.status,
        "bill_date": data.bill_date or today,
        "due_date": data.due_date,
        "paid_date": (data.paid_date or today) if paid else None,
        "payment_method": data.payment_method if paid else None,
        "payment_reference": data.payment_reference if paid else None,
        "subtotal": data.subtotal,
        "gst": data.gst,
        "pst": data.pst,
        "total": data.total,
        "currency": data.currency,
        "lines": lines,
        "attachments": [],
        "zoho_bill_number": data.zoho_bill_number,
        "notes": data.notes,
        # The first history entry is the logging event; the activity tracker
        # reads it from here rather than from activity_log.
        "status_history": [{"status": data.status, "timestamp": now, "notes": None, "by": actor}],
        "created_by": actor,
        "created_at": now,
        "updated_at": now,
    }
    result = await db.bills.insert_one(doc)
    created = await db.bills.find_one({"_id": result.inserted_id})
    logger.info(f"Bill {created['bill_number']} logged by {current_user.email} "
                f"({supplier_name}, {data.status})")
    return _build_bill_response(created)


@router.get("/{bill_id}", response_model=BillResponse)
async def get_bill(bill_id: str, current_user: User = Depends(require_admin)):
    db = get_database()
    return _build_bill_response(await _get_bill(db, _oid(bill_id)))


@router.put("/{bill_id}", response_model=BillResponse)
async def update_bill(bill_id: str, data: BillUpdate, current_user: User = Depends(require_admin)):
    """Partial update of the bill's facts. Status has its own route."""
    db = get_database()
    oid = _oid(bill_id)
    existing = await _get_bill(db, oid)

    updates = data.model_dump(exclude_unset=True)
    if not updates:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="No fields provided to update.")
    if existing.get("status") != "paid" and any(updates.get(f) is not None for f in PAYMENT_FIELDS):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST,
                            detail="Mark the bill paid to set payment details.")

    if "supplier_id" in updates or "supplier_name" in updates:
        new_id = updates.get("supplier_id", existing.get("supplier_id"))
        new_name = updates.get("supplier_name", existing.get("supplier_name"))
        if new_id and new_id == existing.get("supplier_id"):
            # Same supplier as before: keep the snapshot even if that supplier
            # has since been deactivated.
            updates["supplier_id"], updates["supplier_name"] = new_id, existing.get("supplier_name")
        else:
            updates["supplier_id"], updates["supplier_name"] = await _resolve_supplier(db, new_id, new_name)
    if "lines" in updates:
        updates["lines"] = await _prepare_lines(db, data.lines or [])

    changes = diff_bill(existing, updates)
    updates["updated_at"] = datetime.utcnow()
    await db.bills.update_one({"_id": oid}, {"$set": updates})
    updated = await _get_bill(db, oid)

    if changes:
        await record_activity(
            db, kind="bill_edited", actor=actor_ref(current_user),
            summary=f"Bill {updated['bill_number']} edited — {updated.get('supplier_name')}",
            details=changes, bill=updated,
        )
    return _build_bill_response(updated)


@router.delete("/{bill_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_bill(bill_id: str, current_user: User = Depends(require_admin)):
    """Hard delete, attachments included. The deletion itself is logged."""
    db = get_database()
    oid = _oid(bill_id)
    existing = await _get_bill(db, oid)

    for attachment in existing.get("attachments") or []:
        try:
            await delete_file(attachment["url"])
        except Exception as exc:  # noqa: BLE001 - a stray file must not block the delete
            logger.warning(f"Failed to delete bill attachment {attachment.get('url')}: {exc}")

    await db.bills.delete_one({"_id": oid})
    await record_activity(
        db, kind="bill_deleted", actor=actor_ref(current_user),
        summary=f"Bill {existing.get('bill_number')} deleted — {existing.get('supplier_name')}",
        details=[f"Status: {BILL_STATUS_LABELS.get(existing.get('status'), existing.get('status'))}",
                 f"Bill date: {existing.get('bill_date') or '—'}"],
        bill=existing,
    )
    logger.info(f"Bill {existing.get('bill_number')} deleted by {current_user.email}")


@router.patch("/{bill_id}/status", response_model=BillResponse)
async def set_bill_status(bill_id: str, body: BillStatusUpdate,
                          current_user: User = Depends(require_admin)):
    """The only way a bill changes status. Marking paid stores the payment
    details; undoing a payment clears them and records what was cleared."""
    db = get_database()
    oid = _oid(bill_id)
    existing = await _get_bill(db, oid)
    current = existing.get("status", "unpaid")
    try:
        validate_bill_transition(current, body.status)
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc))

    now = datetime.utcnow()
    set_data = {"status": body.status, "updated_at": now}
    notes = body.notes
    if body.status == "paid":
        set_data.update({
            "paid_date": body.paid_date or _pacific_today_ymd(),
            "payment_method": body.payment_method,
            "payment_reference": body.payment_reference,
        })
    elif current == "paid":
        was = " · ".join(str(v) for v in (existing.get("paid_date"), existing.get("payment_method"),
                                          existing.get("payment_reference")) if v)
        undo = f"Undo: was paid {was}" if was else "Undo: was paid"
        notes = f"{notes} · {undo}" if notes else undo
        set_data.update({"paid_date": None, "payment_method": None, "payment_reference": None})

    entry = {"status": body.status, "timestamp": now, "notes": notes, "by": actor_ref(current_user)}
    await db.bills.update_one({"_id": oid}, {"$set": set_data, "$push": {"status_history": entry}})
    updated = await _get_bill(db, oid)
    logger.info(f"Bill {updated['bill_number']}: {current} → {body.status} by {current_user.email}")
    return _build_bill_response(updated)


@router.post("/{bill_id}/attachments", response_model=BillResponse)
async def add_bill_attachment(bill_id: str, file: UploadFile = File(...),
                              current_user: User = Depends(require_admin)):
    """Attach a photo or PDF of the bill. Uploads private; capped per bill."""
    db = get_database()
    oid = _oid(bill_id)
    bill = await _get_bill(db, oid)
    if len(bill.get("attachments") or []) >= MAX_ATTACHMENTS:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST,
                            detail=f"Bills hold up to {MAX_ATTACHMENTS} attachments")
    if not file.filename:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="No file provided")

    url = await save_upload_file(file, folder="bills")
    ext = url.rsplit(".", 1)[-1].lower()
    now = datetime.utcnow()
    attachment = {
        "url": url,
        "kind": "pdf" if ext == "pdf" else "image",
        "filename": _attachment_name(file.filename),
        "uploaded_at": now,
        "by": actor_ref(current_user),
    }
    # Atomic cap: the push only lands while slot MAX-1 is still empty, so two
    # uploads racing for the last slot can't both get in.
    result = await db.bills.update_one(
        {"_id": oid, f"attachments.{MAX_ATTACHMENTS - 1}": {"$exists": False}},
        {"$push": {"attachments": attachment}, "$set": {"updated_at": now}},
    )
    if result.matched_count == 0:
        try:
            await delete_file(url)
        except Exception:  # noqa: BLE001
            pass
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST,
                            detail=f"Bills hold up to {MAX_ATTACHMENTS} attachments")

    updated = await _get_bill(db, oid)
    await record_activity(
        db, kind="bill_edited", actor=actor_ref(current_user),
        summary=f"Bill {updated['bill_number']} — attachment added",
        details=[f"Attachment added: {attachment['filename'] or ext}"], bill=updated,
    )
    return _build_bill_response(updated)


@router.delete("/{bill_id}/attachments", response_model=BillResponse)
async def remove_bill_attachment(bill_id: str, url: str = Query(..., max_length=1000),
                                 current_user: User = Depends(require_admin)):
    db = get_database()
    oid = _oid(bill_id)
    bill = await _get_bill(db, oid)
    match = next((a for a in bill.get("attachments") or [] if a.get("url") == url), None)
    if not match:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Attachment not found on this bill")

    try:
        await delete_file(url)
    except Exception as exc:  # noqa: BLE001
        logger.warning(f"Failed to delete bill attachment {url}: {exc}")

    await db.bills.update_one(
        {"_id": oid},
        {"$pull": {"attachments": {"url": url}}, "$set": {"updated_at": datetime.utcnow()}},
    )
    updated = await _get_bill(db, oid)
    await record_activity(
        db, kind="bill_edited", actor=actor_ref(current_user),
        summary=f"Bill {updated['bill_number']} — attachment removed",
        details=[f"Attachment removed: {match.get('filename') or match.get('kind')}"], bill=updated,
    )
    return _build_bill_response(updated)


@router.get("/{bill_id}/attachments/view")
async def view_bill_attachment(bill_id: str, url: str = Query(..., max_length=1000),
                               current_user: User = Depends(require_admin)):
    """Admin-only viewer. /api/photos/view is staff-wide, so a receipt URL is
    only ever served from here, and only when it belongs to this bill."""
    db = get_database()
    bill = await _get_bill(db, _oid(bill_id))
    if not any(a.get("url") == url for a in bill.get("attachments") or []):
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Attachment not found on this bill")
    return stored_file_redirect(url)
