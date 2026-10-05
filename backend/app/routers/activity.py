"""GET /api/activity — the shop's day-by-day happenings for the Workspace
calendar and the printable activity report.

Merges events that live in their own collections (job creation, tool
arrivals, status changes, tasks, customers, online requests, work-order
emails) with the activity_log (edits, deletions, photos). Nothing is stored
by this router; days are shop-local (America/Vancouver) so "today" means
the same thing on every screen and on paper.
"""
import logging
from collections import Counter, defaultdict
from datetime import datetime, timedelta
from typing import Optional
from zoneinfo import ZoneInfo

from bson import ObjectId
from fastapi import APIRouter, Depends, HTTPException, Query

from app.database import get_database
from app.dependencies.auth import require_staff_or_admin
from app.models.auth import User
from app.models.bill import BILL_CATEGORY_LABELS, BILL_STATUS_LABELS
from app.services.activity_service import customer_display, tool_label

router = APIRouter(prefix="/api/activity", tags=["activity"])
logger = logging.getLogger(__name__)

_PACIFIC = ZoneInfo("America/Vancouver")
_UTC = ZoneInfo("UTC")
_YMD = "%Y-%m-%d"
_MAX_RANGE_DAYS = 400

ACTIVE_STATUSES = ["received", "diagnosed", "quoted", "approved",
                   "parts_pending", "in_repair", "ready", "invoiced"]
STATUS_LABELS = {
    "received": "Received", "diagnosed": "Diagnosed", "quoted": "Quoted",
    "approved": "Approved", "parts_pending": "Parts Pending", "in_repair": "In Repair",
    "ready": "Ready for Pickup", "invoiced": "Invoiced", "completed": "Completed",
    "declined": "Declined", "beyond_economical_repair": "Beyond Economical Repair",
    "abandoned": "Abandoned", "closed": "Closed",
}


def _day_start_utc(ymd: str) -> datetime:
    """Naive UTC instant for shop-local midnight at the start of `ymd`."""
    local = datetime.strptime(ymd, _YMD).replace(tzinfo=_PACIFIC)
    return local.astimezone(_UTC).replace(tzinfo=None)


def _local(ts: datetime) -> datetime:
    return ts.replace(tzinfo=_UTC).astimezone(_PACIFIC)


def _actor(value) -> dict | None:
    """Normalise the stored actor: {user_id, name} dicts pass through, bare
    strings (older email logs store an address) become a name-only ref."""
    if isinstance(value, dict) and value.get("name"):
        return {"user_id": value.get("user_id"), "name": value["name"]}
    if isinstance(value, str) and value.strip():
        return {"user_id": None, "name": value.strip()}
    return None


def _event(kind: str, ts: datetime, summary: str, *, actor=None, request_number=None,
           job_id=None, tool=None, details=None, status=None, task_id=None,
           bill_id=None, bill_number=None, payment_id=None, payment_number=None) -> dict:
    local = _local(ts)
    return {
        "kind": kind,
        "ts": ts.isoformat(),
        "day": local.strftime(_YMD),
        "time": local.strftime("%I:%M %p").lstrip("0"),
        "summary": summary,
        "details": [d for d in (details or []) if d],
        "actor": _actor(actor),
        "request_number": request_number,
        "job_id": job_id,
        "tool": tool,
        "status": status,
        "task_id": task_id,
        "bill_id": bill_id,
        "bill_number": bill_number,
        "payment_id": payment_id,
        "payment_number": payment_number,
    }


def _ts_in(ts, start: datetime, end: datetime) -> bool:
    return isinstance(ts, datetime) and start <= ts < end


# Kinds only admins may see: money, business settings, accounts. The API
# drops them for everyone else, so the calendar, the report and the person
# view never leak them.
_ADMIN_ONLY_PREFIXES = ("bill_", "payment_", "settings_", "account_", "password_")
_EDIT_KINDS = ("tool_edited", "job_edited", "customer_edited", "bill_edited", "payment_edited")
_DELETE_KINDS = ("job_deleted", "tool_removed", "customer_deleted", "bill_deleted", "payment_deleted")
_LIBRARY_PREFIXES = ("part_", "model_", "brand_", "stock_")
_ADMIN_KIND_PREFIXES = ("settings_", "account_", "password_", "code_")
_PERSON_COUNT_KEYS = ("total", "jobs_created", "tools_received", "status_changes", "ready", "completed",
                      "tasks_created", "tasks_completed", "edits", "library", "money", "admin")


def _parse_range(from_: str, to: str):
    try:
        start = _day_start_utc(from_)
        end = _day_start_utc(to) + timedelta(days=1)
    except ValueError:
        raise HTTPException(status_code=400, detail="Dates must be real YYYY-MM-DD values")
    if end <= start:
        raise HTTPException(status_code=400, detail="'to' must not be before 'from'")
    if (end - start).days > _MAX_RANGE_DAYS:
        raise HTTPException(status_code=400, detail=f"Range is capped at {_MAX_RANGE_DAYS} days")
    return start, end


async def _collect_events(db, start: datetime, end: datetime, is_admin: bool) -> dict:
    """Every recorded happening in [start, end), oldest first, gathered from
    the primary records and the activity log. Admin-only kinds (money,
    settings, accounts) are left out for everyone else."""
    rng = {"$gte": start, "$lt": end}
    events: list[dict] = []
    transitions: Counter = Counter()
    tools_received = 0
    turnaround_days: list[int] = []
    bills_paid = 0

    # ── Repairs: job creation, tool arrivals, status changes, emails ──
    projection = {
        "request_number": 1, "company_name": 1, "first_name": 1, "last_name": 1,
        "created_at": 1, "created_by": 1, "work_order_emails_sent": 1,
        "tools.tool_id": 1, "tools.brand": 1, "tools.model_number": 1, "tools.tool_type": 1,
        "tools.controller_model": 1, "tools.reel_model": 1, "tools.camera_head_model": 1,
        "tools.status_history": 1,
    }
    repairs_query = {"$or": [
        {"created_at": rng},
        {"tools.status_history.timestamp": rng},
        {"work_order_emails_sent.sent_at": rng},
    ]}
    async for job in db.repairs.find(repairs_query, projection):
        rn = job.get("request_number")
        job_id = str(job["_id"])
        customer = customer_display(job)
        created_at = job.get("created_at")
        tools = job.get("tools") or []

        if _ts_in(created_at, start, end):
            labels = [tool_label(t) for t in tools]
            tools_received += len(tools)
            events.append(_event(
                "job_created", created_at,
                f"New work order {rn} for {customer} — {len(tools)} tool{'s' if len(tools) != 1 else ''} received",
                actor=job.get("created_by"), request_number=rn, job_id=job_id,
                details=labels,
            ))

        for tool in tools:
            label = tool_label(tool)
            hist = sorted((tool.get("status_history") or []),
                          key=lambda e: e.get("timestamp") or datetime.min)
            for i, entry in enumerate(hist):
                ts = entry.get("timestamp")
                if not _ts_in(ts, start, end):
                    continue
                new_status = entry.get("status")
                if i == 0:
                    # The first entry is the tool arriving. When it landed with
                    # the job itself, the job_created line already lists it.
                    if isinstance(created_at, datetime) and abs((ts - created_at).total_seconds()) < 5:
                        continue
                    tools_received += 1
                    events.append(_event(
                        "tool_received", ts, f"{label} received on {rn} ({customer})",
                        actor=entry.get("by"), request_number=rn, job_id=job_id, tool=label,
                        details=[entry.get("notes")] if entry.get("notes") else None,
                        status=new_status,
                    ))
                    continue
                prev_status = hist[i - 1].get("status")
                transitions[new_status] += 1
                if new_status == "ready" and isinstance(hist[0].get("timestamp"), datetime):
                    turnaround_days.append(max(0, (ts - hist[0]["timestamp"]).days))
                events.append(_event(
                    "status_changed", ts,
                    f"{label} on {rn}: {STATUS_LABELS.get(prev_status, prev_status)} → {STATUS_LABELS.get(new_status, new_status)}",
                    actor=entry.get("by"), request_number=rn, job_id=job_id, tool=label,
                    details=[entry.get("notes")] if entry.get("notes") else None,
                    status=new_status,
                ))

        for sent in job.get("work_order_emails_sent") or []:
            ts = sent.get("sent_at")
            if not _ts_in(ts, start, end):
                continue
            recipient = sent.get("sent_to") or customer
            events.append(_event(
                "wo_email_sent", ts, f"Work order {rn} emailed to {recipient}",
                actor=sent.get("sent_by"), request_number=rn, job_id=job_id,
            ))

    # ── Tasks: created / completed (both carry who) ──
    async for task in db.tasks.find({"$or": [{"created_at": rng}, {"completed_at": rng}]},
                                    {"title": 1, "created_at": 1, "created_by": 1,
                                     "completed_at": 1, "completed_by": 1, "status": 1,
                                     "request_number": 1, "repair_id": 1, "assignee_name": 1}):
        rn = task.get("request_number")
        suffix = f" ({rn})" if rn else ""
        if _ts_in(task.get("created_at"), start, end):
            events.append(_event(
                "task_created", task["created_at"], f"Task created: {task.get('title')}{suffix}",
                actor=task.get("created_by"), request_number=rn, job_id=task.get("repair_id"),
                task_id=str(task["_id"]),
                details=[f"Assigned to {task['assignee_name']}"] if task.get("assignee_name") else None,
            ))
        if task.get("status") == "done" and _ts_in(task.get("completed_at"), start, end):
            events.append(_event(
                "task_completed", task["completed_at"], f"Task completed: {task.get('title')}{suffix}",
                actor=task.get("completed_by"), request_number=rn, job_id=task.get("repair_id"),
                task_id=str(task["_id"]),
            ))

    # ── Bills: logged / paid / other status moves (admin only). Derived from
    # the bill's own actor-stamped history — never written to activity_log,
    # so undo and re-pay can't drift, and a deleted bill's events go with it. ──
    if is_admin:
        async for bill in db.bills.find(
            {"$or": [{"created_at": rng}, {"status_history.timestamp": rng}]},
            {"bill_number": 1, "supplier_name": 1, "category": 1, "created_by": 1,
             "status_history": 1, "lines.request_number": 1, "lines.repair_id": 1},
        ):
            bn = bill.get("bill_number")
            bill_id = str(bill["_id"])
            supplier = bill.get("supplier_name") or "—"
            category = BILL_CATEGORY_LABELS.get(bill.get("category"), bill.get("category") or "")
            lines = bill.get("lines") or []
            wo_numbers = sorted({ln.get("request_number") for ln in lines if ln.get("request_number")})
            wo_ids = {ln.get("repair_id") for ln in lines if ln.get("repair_id")}
            # The event's work-order slot is singular: only fill it when the
            # bill links exactly one job.
            single_rn = wo_numbers[0] if len(wo_numbers) == 1 else None
            single_id = next(iter(wo_ids)) if len(wo_ids) == 1 else None
            logged_details = []
            if lines:
                logged_details.append(f"{len(lines)} line{'s' if len(lines) != 1 else ''}")
            if wo_numbers:
                logged_details.append(
                    f"Work order{'s' if len(wo_numbers) != 1 else ''}: {', '.join(wo_numbers)}")

            hist = sorted((bill.get("status_history") or []),
                          key=lambda e: e.get("timestamp") or datetime.min)
            for i, entry in enumerate(hist):
                ts = entry.get("timestamp")
                if not _ts_in(ts, start, end):
                    continue
                new_status = entry.get("status")
                note_details = [entry.get("notes")] if entry.get("notes") else None
                if i == 0:
                    on_the_spot = new_status == "paid"
                    if on_the_spot:
                        bills_paid += 1
                    events.append(_event(
                        "bill_logged", ts,
                        f"Bill {bn} logged{' (paid on the spot)' if on_the_spot else ''} — {supplier} · {category}",
                        actor=entry.get("by") or bill.get("created_by"),
                        request_number=single_rn, job_id=single_id, details=logged_details,
                        status=new_status, bill_id=bill_id, bill_number=bn,
                    ))
                    continue
                prev_status = hist[i - 1].get("status")
                if new_status == "paid":
                    bills_paid += 1
                    events.append(_event(
                        "bill_paid", ts, f"Bill {bn} paid — {supplier}",
                        actor=entry.get("by"), request_number=single_rn, job_id=single_id,
                        details=note_details, status=new_status, bill_id=bill_id, bill_number=bn,
                    ))
                else:
                    events.append(_event(
                        "bill_status_changed", ts,
                        f"Bill {bn} ({supplier}): {BILL_STATUS_LABELS.get(prev_status, prev_status)} → {BILL_STATUS_LABELS.get(new_status, new_status)}",
                        actor=entry.get("by"), request_number=single_rn, job_id=single_id,
                        details=note_details, status=new_status, bill_id=bill_id, bill_number=bn,
                    ))

    # ── Payments received (money in, admin only). The record IS the event. ──
    if is_admin:
        async for pay in db.payments.find(
            {"created_at": rng},
            {"payment_number": 1, "customer_name": 1, "request_number": 1, "repair_id": 1,
             "zoho_invoice_number": 1, "received_date": 1, "created_at": 1, "created_by": 1},
        ):
            pn = pay.get("payment_number")
            rn = pay.get("request_number")
            pay_details = [f"Received {pay.get('received_date')}"] if pay.get("received_date") else []
            if pay.get("zoho_invoice_number"):
                pay_details.append(f"Zoho invoice {pay['zoho_invoice_number']}")
            events.append(_event(
                "payment_received", pay["created_at"],
                f"Payment {pn} received — {pay.get('customer_name') or '—'}{f' · {rn}' if rn else ''}",
                actor=pay.get("created_by"), request_number=rn, job_id=pay.get("repair_id"),
                details=pay_details, payment_id=str(pay["_id"]), payment_number=pn,
            ))

    # ── Customers created ──
    async for cust in db.customers.find({"created_at": rng},
                                        {"company_name": 1, "first_name": 1, "last_name": 1,
                                         "created_at": 1, "created_by": 1}):
        events.append(_event(
            "customer_created", cust["created_at"], f"New customer: {customer_display(cust)}",
            actor=cust.get("created_by"),
        ))

    # ── Online repair requests received (the customer is the actor) ──
    async for req in db.quotes.find({"created_at": rng},
                                    {"request_number": 1, "company_name": 1, "first_name": 1,
                                     "last_name": 1, "tools": 1, "created_at": 1}):
        n = len(req.get("tools") or [])
        events.append(_event(
            "request_received", req["created_at"],
            f"Online repair request {req.get('request_number')} from {customer_display(req)} — {n} tool{'s' if n != 1 else ''}",
            request_number=req.get("request_number"),
        ))

    # ── Activity log: edits, deletions, photos ──
    async for row in db.activity_log.find({"ts": rng}).sort("ts", 1):
        kind = row.get("kind", "other")
        if kind.startswith(_ADMIN_ONLY_PREFIXES) and not is_admin:
            continue
        events.append(_event(
            kind, row["ts"], row.get("summary", ""),
            actor=row.get("actor"), request_number=row.get("request_number"),
            job_id=row.get("job_id"), tool=row.get("tool_label"), details=row.get("details"),
            bill_id=row.get("bill_id"), bill_number=row.get("bill_number"),
            payment_id=row.get("payment_id"), payment_number=row.get("payment_number"),
        ))

    events.sort(key=lambda e: e["ts"])
    return {
        "events": events,
        "transitions": transitions,
        "tools_received": tools_received,
        "turnaround_days": turnaround_days,
        "bills_paid": bills_paid,
    }


async def _resolve_person(db, user_id: str) -> dict | None:
    """{user_id, name} for an account, the name built the way actor_ref
    stamps it, so older name-only entries can still be matched."""
    if not ObjectId.is_valid(user_id):
        return None
    u = await db.users.find_one({"_id": ObjectId(user_id)}, {"first_name": 1, "last_name": 1, "email": 1})
    if not u:
        return None
    name = f"{u.get('first_name') or ''} {u.get('last_name') or ''}".strip() or u.get("email") or ""
    return {"user_id": user_id, "name": name}


def _event_is_by(e: dict, person: dict) -> bool:
    a = e.get("actor")
    if not a:
        return False
    if a.get("user_id"):
        return a["user_id"] == person["user_id"]
    return (a.get("name") or "").strip().lower() == person["name"].lower()


@router.get("")
@router.get("/")
async def list_activity(
    from_: str = Query(..., alias="from", pattern=r"^\d{4}-\d{2}-\d{2}$"),
    to: str = Query(..., pattern=r"^\d{4}-\d{2}-\d{2}$"),
    actor: Optional[str] = Query(None, description="Only this account's happenings"),
    current_user: User = Depends(require_staff_or_admin),
):
    """Every recorded happening between two shop-local dates (inclusive),
    oldest first, plus a summary the report prints at the top. With `actor`
    the list is one person's: an admin may ask for anyone, everyone else
    only for themselves."""
    start, end = _parse_range(from_, to)
    db = get_database()
    # Bills (suppliers, amounts) are admin-only everywhere, the timeline included.
    is_admin = current_user.role == "admin"
    person = None
    if actor:
        if not is_admin and actor != current_user.id:
            raise HTTPException(status_code=403, detail="You can only view your own activity")
        person = await _resolve_person(db, actor)
        if not person:
            raise HTTPException(status_code=404, detail="Account not found")

    collected = await _collect_events(db, start, end, is_admin)
    events = collected["events"]
    transitions = collected["transitions"]
    tools_received = collected["tools_received"]
    turnaround_days = collected["turnaround_days"]
    bills_paid = collected["bills_paid"]
    if person:
        events = [e for e in events if _event_is_by(e, person)]
        # The counts describe the one person's list; the open-work snapshot
        # below stays shop-wide, and turnaround is a shop figure, not a person's.
        transitions = Counter(e["status"] for e in events if e["kind"] == "status_changed" and e.get("status"))
        tools_received = sum(
            len(e.get("details") or []) if e["kind"] == "job_created" else 1
            for e in events if e["kind"] in ("job_created", "tool_received")
        )
        turnaround_days = []
        bills_paid = sum(1 for e in events
                         if e["kind"] == "bill_paid" or (e["kind"] == "bill_logged" and e.get("status") == "paid"))

    # ── Open-work snapshot at the END of the range, rebuilt from history so a
    # past month reports what was open then, not what is open now ──
    open_by_status: Counter = Counter()
    async for job in db.repairs.find({}, {"tools.status_history": 1, "tools.status": 1}):
        for tool in job.get("tools") or []:
            hist = [e for e in (tool.get("status_history") or [])
                    if isinstance(e.get("timestamp"), datetime) and e["timestamp"] < end]
            if not hist:
                continue
            status_then = max(hist, key=lambda e: e["timestamp"]).get("status")
            if status_then in ACTIVE_STATUSES:
                open_by_status[status_then] += 1

    kinds = Counter(e["kind"] for e in events)
    summary = {
        "tools_received": tools_received,
        "jobs_created": kinds.get("job_created", 0),
        "requests_received": kinds.get("request_received", 0),
        "customers_created": kinds.get("customer_created", 0),
        "status_changes": kinds.get("status_changed", 0),
        "transitions": {s: transitions.get(s, 0) for s in STATUS_LABELS},
        "tasks_created": kinds.get("task_created", 0),
        "tasks_completed": kinds.get("task_completed", 0),
        "edits": sum(kinds.get(k, 0) for k in ("tool_edited", "job_edited", "customer_edited",
                                               "bill_edited", "payment_edited")),
        "deletions": sum(kinds.get(k, 0) for k in ("job_deleted", "tool_removed", "customer_deleted",
                                                   "bill_deleted", "payment_deleted")),
        "emails_sent": kinds.get("wo_email_sent", 0),
        "avg_turnaround_days": (round(sum(turnaround_days) / len(turnaround_days), 1)
                                if turnaround_days else None),
        "open_at_end": {s: open_by_status.get(s, 0) for s in ACTIVE_STATUSES},
        "open_total": sum(open_by_status.values()),
        "kinds": dict(kinds),
    }
    if is_admin:
        # Only admins get the bill cards, so a technician's report never
        # shows an empty "Bills" section.
        summary["bills_logged"] = kinds.get("bill_logged", 0)
        summary["bills_paid"] = bills_paid
        summary["payments_received"] = kinds.get("payment_received", 0)

    # Month-by-month breakdown for long ranges (the year report prints this
    # instead of a thousand lines).
    months = None
    if (end - start).days > 62:
        per_month: dict = defaultdict(Counter)
        for e in events:
            m = e["day"][:7]
            c = per_month[m]
            c["events"] += 1
            if e["kind"] == "job_created":
                c["jobs_created"] += 1
                c["tools_received"] += len(e.get("details") or [])
            elif e["kind"] == "tool_received":
                c["tools_received"] += 1
            elif e["kind"] == "status_changed":
                c["status_changes"] += 1
                if e.get("status") == "ready":
                    c["ready"] += 1
                elif e.get("status") == "completed":
                    c["completed"] += 1
            elif e["kind"] == "task_completed":
                c["tasks_completed"] += 1
            elif e["kind"] == "request_received":
                c["requests_received"] += 1
        months = [{"month": m, **{k: per_month[m].get(k, 0) for k in
                                  ("events", "jobs_created", "tools_received", "status_changes",
                                   "ready", "completed", "tasks_completed", "requests_received")}}
                  for m in sorted(per_month)]

    return {
        "from": from_,
        "to": to,
        "actor": person,
        "events": events,
        "summary": summary,
        "months": months,
        "days_with_activity": len({e["day"] for e in events}),
    }


@router.get("/people")
async def activity_by_person(
    from_: str = Query(..., alias="from", pattern=r"^\d{4}-\d{2}-\d{2}$"),
    to: str = Query(..., pattern=r"^\d{4}-\d{2}-\d{2}$"),
    current_user: User = Depends(require_staff_or_admin),
):
    """The same happenings grouped the other way: one card per shop account
    with its counts and last action in the period. Admins see everyone;
    anyone else gets only their own card. Derived each time, never stored."""
    start, end = _parse_range(from_, to)
    db = get_database()
    is_admin = current_user.role == "admin"
    collected = await _collect_events(db, start, end, is_admin)

    staff: dict = {}
    async for u in db.users.find({"role": {"$in": ["admin", "staff", "technician"]}},
                                 {"first_name": 1, "last_name": 1, "email": 1, "role": 1, "is_active": 1}):
        uid = str(u["_id"])
        name = f"{u.get('first_name') or ''} {u.get('last_name') or ''}".strip() or u.get("email") or ""
        staff[uid] = {"user_id": uid, "name": name, "role": u.get("role"), "is_active": u.get("is_active", True)}
    by_name = {s["name"].lower(): uid for uid, s in staff.items() if s["name"]}

    def person_key(actor) -> str | None:
        a = _actor(actor)
        if not a:
            return None
        if a.get("user_id") in staff:
            return a["user_id"]
        return by_name.get((a.get("name") or "").strip().lower())

    counters: dict = defaultdict(Counter)
    last: dict = {}
    unattributed = 0
    for e in collected["events"]:
        key = person_key(e.get("actor"))
        if not key:
            # Online requests have no actor by design — the customer sent them.
            if e["kind"] != "request_received":
                unattributed += 1
            continue
        c = counters[key]
        c["total"] += 1
        k = e["kind"]
        if k == "job_created":
            c["jobs_created"] += 1
            c["tools_received"] += len(e.get("details") or [])
        elif k == "tool_received":
            c["tools_received"] += 1
        elif k == "status_changed":
            c["status_changes"] += 1
            if e.get("status") == "ready":
                c["ready"] += 1
            elif e.get("status") == "completed":
                c["completed"] += 1
        elif k == "task_created":
            c["tasks_created"] += 1
        elif k == "task_completed":
            c["tasks_completed"] += 1
        elif k in _EDIT_KINDS or k in _DELETE_KINDS or k in ("photos_added", "photo_removed", "wo_email_sent", "customer_created"):
            c["edits"] += 1
        elif k.startswith(_LIBRARY_PREFIXES):
            c["library"] += 1
        elif k.startswith(("bill_", "payment_")):
            c["money"] += 1
        elif k.startswith(_ADMIN_KIND_PREFIXES):
            c["admin"] += 1
        if key not in last or e["ts"] > last[key]["ts"]:
            last[key] = {"ts": e["ts"], "day": e["day"], "time": e["time"], "summary": e["summary"]}

    people = []
    for uid, s in staff.items():
        if not is_admin and uid != current_user.id:
            continue
        c = counters.get(uid, Counter())
        # Dormant accounts with nothing in the period stay off the board.
        if not s["is_active"] and c["total"] == 0:
            continue
        people.append({
            **s,
            "counts": {k: c.get(k, 0) for k in _PERSON_COUNT_KEYS},
            "last": last.get(uid),
        })
    people.sort(key=lambda p: (-p["counts"]["total"], p["name"].lower()))
    return {
        "from": from_,
        "to": to,
        "people": people,
        "events_total": len(collected["events"]),
        "unattributed": unattributed if is_admin else None,
    }
