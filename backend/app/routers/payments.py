"""Payments — money IN (customer payments on Zoho invoices), admin only.

The other half of the Cash Flow section: bills are what the shop owes and
paid, payments are what customers actually paid. Entered by hand when the
money lands (received-only — Zoho keeps the receivable), optionally linked
to the work order it settled so income can be matched to jobs later.
Edits and deletions go to the activity log; the "received" event is derived
from the record itself by routers/activity.py.
"""
import logging
import re
from datetime import datetime
from typing import List, Optional

from bson import ObjectId
from fastapi import APIRouter, Depends, HTTPException, Query, Response, status

from app.database import get_database, get_next_payment_number
from app.dependencies.auth import require_admin
from app.models.auth import User
from app.models.payment import PaymentCreate, PaymentResponse, PaymentUpdate
from app.routers.bills import _month_bounds
from app.routers.tasks import _pacific_today_ymd, _resolve_repair
from app.services.activity_service import actor_ref, diff_payment, record_activity
from app.utils.helpers import convert_objectid_to_str

router = APIRouter(prefix="/api/payments", tags=["payments"])
logger = logging.getLogger(__name__)

PAYMENT_SORT_FIELDS = {
    "received_date": "received_date",
    "amount": "amount",
    "created_at": "created_at",
    "customer_name": "customer_name",
}
_SEARCH_FIELDS = (
    "payment_number", "customer_name", "zoho_invoice_number", "request_number",
    "payment_reference", "notes",
)


def _build_payment_response(doc: dict) -> PaymentResponse:
    doc = convert_objectid_to_str(doc)
    doc["id"] = doc.pop("_id")
    return PaymentResponse(**doc)


def _oid(payment_id: str) -> ObjectId:
    if not ObjectId.is_valid(payment_id):
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Payment not found")
    return ObjectId(payment_id)


async def _get_payment(db, oid: ObjectId) -> dict:
    doc = await db.payments.find_one({"_id": oid})
    if not doc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Payment not found")
    return doc


async def _totals_by_currency(db, match: dict) -> dict:
    totals: dict = {}
    async for row in db.payments.aggregate([
        {"$match": match},
        {"$group": {"_id": "$currency", "total": {"$sum": "$amount"}}},
    ]):
        totals[row["_id"] or "CAD"] = round(float(row["total"] or 0), 2)
    return totals


# /summary MUST be defined before /{payment_id}
@router.get("/summary")
async def get_payments_summary(current_user: User = Depends(require_admin)):
    """This month's money in (by received date, shop-local), per currency."""
    db = get_database()
    today = _pacific_today_ymd()
    month_start, month_end = _month_bounds(today[:7])
    month_match = {"received_date": {"$gte": month_start, "$lt": month_end}}
    return {
        "month": today[:7],
        "month_count": await db.payments.count_documents(month_match),
        "month_total": await _totals_by_currency(db, month_match),
    }


@router.get("/", response_model=List[PaymentResponse])
async def list_payments(
    response: Response,
    skip: int = Query(default=0, ge=0),
    limit: int = Query(default=50, ge=1, le=200),
    month: Optional[str] = Query(default=None, pattern=r"^\d{4}-\d{2}$"),
    repair_id: Optional[str] = Query(default=None),
    q: Optional[str] = Query(default=None, max_length=100),
    sort_by: str = Query(default="received_date"),
    sort_dir: str = Query(default="desc", pattern="^(asc|desc)$"),
    current_user: User = Depends(require_admin),
):
    """Paginated, server-sorted payments; `month` filters on the received date."""
    db = get_database()
    query: dict = {}
    if month:
        try:
            month_start, month_end = _month_bounds(month)
        except ValueError:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid month")
        query["received_date"] = {"$gte": month_start, "$lt": month_end}
    if repair_id:
        query["repair_id"] = repair_id
    if q and q.strip():
        pattern = re.escape(q.strip())
        query["$or"] = [{f: {"$regex": pattern, "$options": "i"}} for f in _SEARCH_FIELDS]

    if sort_by not in PAYMENT_SORT_FIELDS:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Cannot sort by '{sort_by}'. Allowed: {', '.join(sorted(PAYMENT_SORT_FIELDS))}",
        )
    direction = 1 if sort_dir == "asc" else -1

    total = await db.payments.count_documents(query)
    response.headers["X-Total-Count"] = str(total)
    response.headers["Access-Control-Expose-Headers"] = "X-Total-Count"

    cursor = (db.payments.find(query)
              .sort([(PAYMENT_SORT_FIELDS[sort_by], direction), ("_id", 1)])
              .skip(skip).limit(limit))
    return [_build_payment_response(doc) async for doc in cursor]


@router.post("/", response_model=PaymentResponse, status_code=status.HTTP_201_CREATED)
async def create_payment(data: PaymentCreate, current_user: User = Depends(require_admin)):
    db = get_database()
    now = datetime.utcnow()
    repair_id, request_number = await _resolve_repair(db, data.repair_id)
    doc = {
        "payment_number": await get_next_payment_number(),
        "customer_name": data.customer_name,
        "repair_id": repair_id,
        "request_number": request_number,
        "zoho_invoice_number": data.zoho_invoice_number,
        "amount": data.amount,
        "currency": data.currency,
        "received_date": data.received_date or _pacific_today_ymd(),
        "payment_method": data.payment_method,
        "payment_reference": data.payment_reference,
        "notes": data.notes,
        "created_by": actor_ref(current_user),
        "created_at": now,
        "updated_at": now,
    }
    result = await db.payments.insert_one(doc)
    created = await db.payments.find_one({"_id": result.inserted_id})
    logger.info(f"Payment {created['payment_number']} logged by {current_user.email} ({data.customer_name})")
    return _build_payment_response(created)


@router.get("/{payment_id}", response_model=PaymentResponse)
async def get_payment(payment_id: str, current_user: User = Depends(require_admin)):
    db = get_database()
    return _build_payment_response(await _get_payment(db, _oid(payment_id)))


@router.put("/{payment_id}", response_model=PaymentResponse)
async def update_payment(payment_id: str, data: PaymentUpdate,
                         current_user: User = Depends(require_admin)):
    db = get_database()
    oid = _oid(payment_id)
    existing = await _get_payment(db, oid)
    updates = data.model_dump(exclude_unset=True)
    if not updates:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="No fields provided to update.")
    if "repair_id" in updates:
        updates["repair_id"], updates["request_number"] = await _resolve_repair(db, updates["repair_id"])

    changes = diff_payment(existing, updates)
    updates["updated_at"] = datetime.utcnow()
    await db.payments.update_one({"_id": oid}, {"$set": updates})
    updated = await _get_payment(db, oid)
    if changes:
        await record_activity(
            db, kind="payment_edited", actor=actor_ref(current_user),
            summary=f"Payment {updated['payment_number']} edited — {updated.get('customer_name')}",
            details=changes, payment=updated,
        )
    return _build_payment_response(updated)


@router.delete("/{payment_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_payment(payment_id: str, current_user: User = Depends(require_admin)):
    db = get_database()
    oid = _oid(payment_id)
    existing = await _get_payment(db, oid)
    await db.payments.delete_one({"_id": oid})
    await record_activity(
        db, kind="payment_deleted", actor=actor_ref(current_user),
        summary=f"Payment {existing.get('payment_number')} deleted — {existing.get('customer_name')}",
        details=[f"Received: {existing.get('received_date') or '—'}"]
                + ([f"Zoho invoice {existing['zoho_invoice_number']}"] if existing.get("zoho_invoice_number") else []),
        payment=existing,
    )
    logger.info(f"Payment {existing.get('payment_number')} deleted by {current_user.email}")
