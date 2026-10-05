"""Accounting views, admin only.

The profit & loss of the repairs completed in a period, and the money
journal — every money event in one chronological list. Both are DERIVED at
read time from the primary records (repairs, bills, payments, activity_log);
nothing here is stored, so the figures can never drift from the tracker.
Zoho Books stays the accounting system; this is the shop's operational
view, pre-tax, in CAD.

The maths lives in the frontend (utils/jobAccounting.js — the same code the
work order dialog uses, so a repair's profit here is the figure on its
card), so these routes only gather the records a period touches.
"""
import logging
from datetime import datetime, timedelta
from zoneinfo import ZoneInfo

from fastapi import APIRouter, Depends, HTTPException, Query

from app.database import get_database
from app.dependencies.auth import require_admin
from app.models.auth import User
from app.routers.bills import _build_bill_response
from app.routers.payments import _build_payment_response
from app.routers.repairs import _build_job_response
from app.utils.helpers import convert_objectid_to_str

router = APIRouter(prefix="/api/accounting", tags=["accounting"])
logger = logging.getLogger(__name__)

_PACIFIC = ZoneInfo("America/Vancouver")
_UTC = ZoneInfo("UTC")
_YMD = "%Y-%m-%d"
_YMD_PATTERN = r"^\d{4}-\d{2}-\d{2}$"
_MAX_RANGE_DAYS = 400
_MAX_JOBS = 2000

# A tool edit touches money when one of these fields changed. The activity
# log keeps every field change; the journal keeps only these lines.
_MONEY_FIELD_PREFIXES = (
    "Invoiced amount", "Extra charges", "Labour hours", "Hourly rate",
    "Labour cost override", "Tax status", "Part added", "Part removed",
)
_MONEY_EDIT_KINDS = ("bill_edited", "bill_deleted", "payment_edited", "payment_deleted")


def _day_start_utc(ymd: str) -> datetime:
    """Naive UTC instant for shop-local midnight at the start of `ymd`."""
    local = datetime.strptime(ymd, _YMD).replace(tzinfo=_PACIFIC)
    return local.astimezone(_UTC).replace(tzinfo=None)


def _period(from_: str, to: str):
    """Shop-local inclusive dates → [start, end) naive-UTC instants."""
    try:
        start = _day_start_utc(from_)
        day_after = (datetime.strptime(to, _YMD) + timedelta(days=1)).strftime(_YMD)
        end = _day_start_utc(day_after)
    except ValueError:
        raise HTTPException(status_code=400, detail="Dates must be YYYY-MM-DD")
    if end <= start:
        raise HTTPException(status_code=400, detail="'to' must be on or after 'from'")
    if (end - start).days > _MAX_RANGE_DAYS:
        raise HTTPException(status_code=400, detail=f"Range too long — at most {_MAX_RANGE_DAYS} days")
    return start, end


@router.get("/pnl")
async def profit_and_loss(
    from_: str = Query(..., alias="from", pattern=_YMD_PATTERN),
    to: str = Query(..., pattern=_YMD_PATTERN),
    current_user: User = Depends(require_admin),
):
    """The repairs completed in the period, with every bill and payment of
    those jobs. A repair counts on the day its tool reached `completed` —
    the shop's call: the work is done and handed over, paid or not; the
    payment shows in Money In when it lands."""
    db = get_database()
    start, end = _period(from_, to)
    jobs = await db.repairs.find(
        {"tools": {"$elemMatch": {"date_completed": {"$gte": start, "$lt": end}}}}
    ).sort("created_at", 1).to_list(length=_MAX_JOBS)
    job_ids = [str(j["_id"]) for j in jobs]
    bills, payments = [], []
    if job_ids:
        bills = await db.bills.find(
            {"lines.repair_id": {"$in": job_ids}, "status": {"$ne": "void"}}
        ).to_list(length=None)
        payments = await db.payments.find({"repair_id": {"$in": job_ids}}).to_list(length=None)
    return {
        "from": from_,
        "to": to,
        "jobs": [_build_job_response(convert_objectid_to_str(j), current_user) for j in jobs],
        "bills": [_build_bill_response(b) for b in bills],
        "payments": [_build_payment_response(p) for p in payments],
    }


@router.get("/journal")
async def money_journal(
    from_: str = Query(..., alias="from", pattern=_YMD_PATTERN),
    to: str = Query(..., pattern=_YMD_PATTERN),
    current_user: User = Depends(require_admin),
):
    """Every record with a money event in the period: jobs whose tools were
    invoiced or completed, bills logged / paid / moved, payments received,
    and the activity-log edits that touched money. The frontend turns them
    into journal entries (amounts from the same charges maths as the card)."""
    db = get_database()
    start, end = _period(from_, to)
    rng = {"$gte": start, "$lt": end}
    ymd_rng = {"$gte": from_, "$lte": to}

    jobs = await db.repairs.find({
        "tools.status_history": {"$elemMatch": {
            "status": {"$in": ["invoiced", "completed"]}, "timestamp": rng,
        }},
    }).sort("created_at", 1).to_list(length=_MAX_JOBS)
    bills = await db.bills.find({"$or": [
        {"bill_date": ymd_rng},
        {"paid_date": ymd_rng},
        {"status_history.timestamp": rng},
    ]}).to_list(length=None)
    payments = await db.payments.find({"$or": [
        {"received_date": ymd_rng},
        {"created_at": rng},
    ]}).to_list(length=None)

    edits = []
    cursor = db.activity_log.find(
        {"ts": rng, "kind": {"$in": ["tool_edited", *_MONEY_EDIT_KINDS]}}
    ).sort("ts", 1)
    async for row in cursor:
        details = [d for d in (row.get("details") or []) if isinstance(d, str)]
        if row.get("kind") == "tool_edited":
            details = [d for d in details if d.startswith(_MONEY_FIELD_PREFIXES)]
            if not details:
                continue
        # A receipt photo added or removed changes no figure.
        if row.get("kind") == "bill_edited" and details and all(d.startswith("Attachment") for d in details):
            continue
        ts = row.get("ts")
        edits.append({
            "id": str(row["_id"]),
            "kind": row.get("kind"),
            "ts": ts.isoformat() if isinstance(ts, datetime) else None,
            "summary": row.get("summary"),
            "details": details,
            "actor": row.get("actor"),
            "job_id": row.get("job_id"),
            "request_number": row.get("request_number"),
            "tool_id": row.get("tool_id"),
            "tool_label": row.get("tool_label"),
            "bill_id": row.get("bill_id"),
            "bill_number": row.get("bill_number"),
            "payment_id": row.get("payment_id"),
            "payment_number": row.get("payment_number"),
        })

    return {
        "from": from_,
        "to": to,
        "jobs": [_build_job_response(convert_objectid_to_str(j), current_user) for j in jobs],
        "bills": [_build_bill_response(b) for b in bills],
        "payments": [_build_payment_response(p) for p in payments],
        "edits": edits,
    }
