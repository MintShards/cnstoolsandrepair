import asyncio
import logging
import re
import uuid
from collections import defaultdict
from fastapi import APIRouter, HTTPException, UploadFile, File, Form, Depends, Query, Response
from typing import List, Optional
from bson import ObjectId
from datetime import datetime
from zoneinfo import ZoneInfo

from app.database import get_database, get_next_work_order_number
from app.models.repair import (
    RepairJobCreate, RepairJobUpdate, RepairJobResponse,
    ToolItemCreate, ToolItemUpdate, ToolStatusUpdate,
    ToolItem, ToolItemResponse, RepairStatus, RepairSource,
    StatusHistoryEntry, ALLOWED_TRANSITIONS, validate_status_transition,
    BatchStatusRequest, BatchStatusResponse, BatchStatusResult,
    WorkOrderEmailSendRequest,
)
from app.models.auth import User
from app.dependencies.auth import require_admin
from app.services.file_service import save_upload_file, delete_file
from app.services.work_order_email_service import send_work_order_email
from app.utils.helpers import convert_objectid_to_str

router = APIRouter(prefix="/api/repairs", tags=["repairs"])
logger = logging.getLogger(__name__)

_PACIFIC = ZoneInfo("America/Vancouver")

# Status tier for smart sort (lower = higher priority / shown first)
_STATUS_TIER = {
    "quoted": 1, "diagnosed": 1, "ready": 1, "invoiced": 1,
    "approved": 2, "parts_pending": 2, "in_repair": 2, "received": 2,
    "completed": 3, "closed": 3, "declined": 3,
    "beyond_economical_repair": 3, "abandoned": 3,
}


def _pacific_date_to_utc(dt: datetime) -> datetime:
    """Convert a naive datetime (interpreted as Pacific midnight) to naive UTC for MongoDB storage."""
    aware = dt.replace(tzinfo=_PACIFIC)
    return aware.astimezone(ZoneInfo("UTC")).replace(tzinfo=None)


async def _adjust_library_part_stock(db, library_part_id: str, delta: int, reason: str,
                                      job_id: str = None, tool_id: str = None):
    """Adjust stock for a library part. Floors at 0. Appends to stock_history."""
    try:
        oid = ObjectId(library_part_id)
    except Exception:
        return
    part = await db.parts_library_parts.find_one({"_id": oid})
    if not part:
        return
    old_qty = part.get("quantity_on_hand", 0) or 0
    new_qty = max(0, old_qty + delta)
    now = datetime.utcnow()
    history_entry = {
        "timestamp": now,
        "delta": delta,
        "reason": reason,
        "resulting_quantity": new_qty,
        "reference_job_id": job_id,
        "reference_tool_id": tool_id,
        "adjusted_by": "system",
        "source": "auto",
    }
    await db.parts_library_parts.update_one(
        {"_id": oid},
        {
            "$set": {"quantity_on_hand": new_qty, "updated_at": now},
            "$push": {"stock_history": {"$each": [history_entry], "$slice": -200}}
        }
    )


def _migrate_tool_parts(tool: dict) -> dict:
    """Migrate old parts_needed string to parts list for backward compat"""
    if "parts_needed" in tool and "parts" not in tool:
        old = tool.pop("parts_needed", None)
        if old and isinstance(old, str) and old.strip():
            tool["parts"] = [{"name": old.strip(), "quantity": 1, "price": None, "status": "pending"}]
        else:
            tool["parts"] = []
    elif "parts" not in tool:
        tool["parts"] = []
    # Remove legacy field if still present alongside new field
    tool.pop("parts_needed", None)
    # Migrate unit_cost → price and add new fields with defaults
    for part in tool["parts"]:
        if "unit_cost" in part and "price" not in part:
            part["price"] = part.pop("unit_cost")
        elif "unit_cost" in part:
            part.pop("unit_cost")
        part.setdefault("price", None)
        part.setdefault("supplier", None)
        part.setdefault("order_link", None)
        part.setdefault("notes", None)
        part.setdefault("order_date", None)
        part.setdefault("eta", None)
        part.setdefault("date_received", None)
        part.setdefault("tracking", None)
        part.setdefault("part_number", None)
        part.setdefault("library_part_id", None)
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
# SUMMARY (before LIST and /{id} to avoid routing conflict)
# ──────────────────────────────────────────────

@router.get("/lifetime-stats")
async def get_lifetime_stats(
    current_user: User = Depends(require_admin)
):
    """
    Returns lifetime/historical stats for the dashboard:
    - total_tools_repaired: all tools with completed or closed status
    - completed_this_month: tools completed in the current calendar month
    - avg_turnaround_days: average days from received → completed (last 90 days)
    - total_jobs_created: total number of repair job documents
    """
    db = get_database()
    now = datetime.utcnow()
    month_start = now.replace(day=1, hour=0, minute=0, second=0, microsecond=0)
    ninety_days_ago = datetime.utcfromtimestamp(now.timestamp() - 90 * 86400)

    # Total tools repaired (completed or closed)
    pipeline_total = [
        {"$unwind": "$tools"},
        {"$match": {"tools.status": {"$in": ["completed", "closed"]}}},
        {"$count": "total"},
    ]
    result = await db.repairs.aggregate(pipeline_total).to_list(length=1)
    total_tools_repaired = result[0]["total"] if result else 0

    # Tools completed this month
    pipeline_month = [
        {"$unwind": "$tools"},
        {"$match": {
            "tools.status": {"$in": ["completed", "closed"]},
            "tools.date_completed": {"$gte": month_start},
        }},
        {"$count": "total"},
    ]
    result_month = await db.repairs.aggregate(pipeline_month).to_list(length=1)
    completed_this_month = result_month[0]["total"] if result_month else 0

    # Average turnaround: date_completed - date_received in days (last 90 days)
    pipeline_avg = [
        {"$unwind": "$tools"},
        {"$match": {
            "tools.status": {"$in": ["completed", "closed"]},
            "tools.date_completed": {"$gte": ninety_days_ago},
            "tools.date_received": {"$exists": True, "$ne": None},
        }},
        {"$project": {
            "days": {
                "$divide": [
                    {"$subtract": ["$tools.date_completed", "$tools.date_received"]},
                    86400000  # ms → days
                ]
            }
        }},
        {"$match": {"days": {"$gt": 0}}},
        {"$group": {"_id": None, "avg_days": {"$avg": "$days"}}},
    ]
    result_avg = await db.repairs.aggregate(pipeline_avg).to_list(length=1)
    avg_turnaround_days = round(result_avg[0]["avg_days"], 1) if result_avg else None

    # Total jobs ever created
    total_jobs_created = await db.repairs.count_documents({})

    return {
        "total_tools_repaired": total_tools_repaired,
        "completed_this_month": completed_this_month,
        "avg_turnaround_days": avg_turnaround_days,
        "total_jobs_created": total_jobs_created,
    }


@router.get("/summary")
async def get_repair_summary(
    current_user: User = Depends(require_admin)
):
    """
    Returns aggregated dashboard stats:
    - status_counts: count of tools in each active status
    - overdue_count: tools past estimated_completion and not terminal
    - stale_count: tools with no status change in 3+ days and not terminal
    - rush_urgent_active: count of rush/urgent tools in active (non-terminal) statuses
    - updated_today: count of jobs updated today
    - total_active_jobs: jobs with at least one non-terminal tool
    - technician_summary: per-technician active/overdue/stale/rush_urgent counts
    - today_activity: {new_jobs, completions, status_changes}
    - recent_completions: list of recently completed tools (last 24h, max 10)
    - parts_summary: {pending, ordered, received, total_cost}
    - financial_summary: {active_value, completed_month_value, tools_priced, tools_total}
    - aging_buckets: {fresh, normal, aging, stale_plus} tool counts by days since last update
    """
    db = get_database()
    now = datetime.utcnow()
    terminal_statuses = {"completed", "abandoned", "closed", "declined", "beyond_economical_repair"}

    # Read configurable stale threshold from settings (default 3 days)
    settings_doc = await db.business_settings.find_one({"active": True})
    stale_days_threshold = 3
    if settings_doc:
        stale_days_threshold = int(settings_doc.get("stale_days", 3) or 3)

    # ── Status counts via aggregation ──
    pipeline = [
        {"$unwind": "$tools"},
        {"$group": {"_id": "$tools.status", "count": {"$sum": 1}}},
    ]
    status_cursor = db.repairs.aggregate(pipeline)
    raw_counts = await status_cursor.to_list(length=50)
    status_counts = {item["_id"]: item["count"] for item in raw_counts}

    # ── Jobs updated today (Pacific time) ──
    pacific = ZoneInfo("America/Vancouver")
    now_pacific = datetime.now(pacific)
    today_start_pacific = now_pacific.replace(hour=0, minute=0, second=0, microsecond=0)
    today_start_utc = today_start_pacific.astimezone(ZoneInfo("UTC")).replace(tzinfo=None)
    updated_today = await db.repairs.count_documents({"updated_at": {"$gte": today_start_utc}})

    # ── New jobs created today ──
    new_jobs_today = await db.repairs.count_documents({"created_at": {"$gte": today_start_utc}})

    # ── Month start for financial summary ──
    month_start_utc = now.replace(day=1, hour=0, minute=0, second=0, microsecond=0)

    # ── 24h ago for recent completions ──
    one_day_ago = datetime.utcfromtimestamp(now.timestamp() - 86400)

    # ── Pull all jobs that have at least one non-terminal tool ──
    # Using $nin on an array field excludes jobs where ANY element matches,
    # so we use $in with all non-terminal statuses instead.
    active_statuses = ["received", "diagnosed", "quoted", "approved", "parts_pending", "in_repair", "ready", "invoiced"]
    active_jobs_cursor = db.repairs.find(
        {"tools.status": {"$in": active_statuses}}
    )
    active_jobs = await active_jobs_cursor.to_list(length=2000)

    overdue_count = 0
    stale_count = 0
    rush_urgent_active = 0

    # New accumulators
    technician_summary = {}  # name -> {active, overdue, stale, rush_urgent}
    completions_today = 0
    recent_completions = []
    parts_pending = 0
    parts_ordered = 0
    parts_in_stock = 0
    parts_received = 0
    parts_installed = 0
    parts_total_cost = 0.0
    parts_has_cost = False
    ready_for_repair = []
    active_value = 0.0
    tools_priced = 0
    tools_total = 0
    completed_month_value = 0.0
    aging_fresh = 0    # 0-1 days
    aging_normal = 0   # 2-3 days
    aging_aging = 0    # 4-7 days
    aging_stale_plus = 0  # 8+ days
    pending_approval_stale_count = 0  # quoted status 2+ days
    stuck_count = 0  # diagnosed/in_repair with no update 24h+
    priority_jobs = []  # top jobs by urgency for work queue
    customer_map = {}  # for active_customers

    for job in active_jobs:
        request_number = job.get("request_number", "")
        for tool in job.get("tools", []):
            tool_status = tool.get("status")
            if tool_status in terminal_statuses:
                continue

            tools_total += 1

            # ── Tech workload ──
            raw_tech = tool.get("assigned_technician", "")
            tech_name = raw_tech.strip().title() if raw_tech and raw_tech.strip() else "Unassigned"
            if tech_name not in technician_summary:
                technician_summary[tech_name] = {"active": 0, "overdue": 0, "stale": 0, "rush_urgent": 0}
            technician_summary[tech_name]["active"] += 1

            # ── Overdue ──
            is_overdue = False
            ec = tool.get("estimated_completion")
            if ec:
                ec_dt = ec if isinstance(ec, datetime) else datetime.fromisoformat(str(ec).replace("Z", "+00:00")).replace(tzinfo=None)
                if ec_dt < now:
                    overdue_count += 1
                    is_overdue = True
                    technician_summary[tech_name]["overdue"] += 1

            # ── Stale / aging buckets ──
            history = tool.get("status_history", [])
            days_since = 0
            if history:
                last_entry = history[-1]
                last_ts = last_entry.get("timestamp")
                if last_ts:
                    last_dt = last_ts if isinstance(last_ts, datetime) else datetime.fromisoformat(str(last_ts).replace("Z", "+00:00")).replace(tzinfo=None)
                    days_since = (now - last_dt).days
                    if days_since >= stale_days_threshold:
                        stale_count += 1
                        technician_summary[tech_name]["stale"] += 1

            if days_since <= 1:
                aging_fresh += 1
            elif days_since <= 3:
                aging_normal += 1
            elif days_since <= 7:
                aging_aging += 1
            else:
                aging_stale_plus += 1

            # ── Rush/Urgent ──
            if tool.get("priority") in ("rush", "urgent"):
                rush_urgent_active += 1
                technician_summary[tech_name]["rush_urgent"] += 1

            # ── Pending approval stale (quoted 2+ days) ──
            if tool_status == "quoted" and days_since >= 2:
                pending_approval_stale_count += 1

            # ── Stuck (diagnosed/in_repair 24h+) ──
            if tool_status in ("diagnosed", "in_repair") and history:
                last_entry = history[-1]
                last_ts = last_entry.get("timestamp")
                if last_ts:
                    last_dt_stuck = last_ts if isinstance(last_ts, datetime) else datetime.fromisoformat(str(last_ts).replace("Z", "+00:00")).replace(tzinfo=None)
                    hours_since = (now - last_dt_stuck).total_seconds() / 3600
                    if hours_since >= 24:
                        stuck_count += 1

            # ── Priority jobs (for work queue) ──
            # Only include tools that actually need attention:
            # overdue, rush/urgent, stale, stuck, or waiting approval 2+ days
            company = job.get("company_name", "")
            first_n = job.get("first_name", "")
            last_n = job.get("last_name", "")
            cust_name = company if company else f"{first_n} {last_n}".strip()
            is_rush_urgent = tool.get("priority") in ("rush", "urgent")
            is_stale = days_since >= stale_days_threshold
            is_stuck = False
            if tool_status in ("diagnosed", "in_repair") and history:
                stuck_entry = history[-1]
                stuck_ts = stuck_entry.get("timestamp")
                if stuck_ts:
                    stuck_dt = stuck_ts if isinstance(stuck_ts, datetime) else datetime.fromisoformat(str(stuck_ts).replace("Z", "+00:00")).replace(tzinfo=None)
                    is_stuck = (now - stuck_dt).total_seconds() / 3600 >= 24
            is_approval_stale = tool_status == "quoted" and days_since >= 2

            # Only add if tool has a reason to be in the work queue
            if is_overdue or is_rush_urgent or is_stale or is_stuck or is_approval_stale:
                urgency = 0
                reason = []
                if is_overdue:
                    urgency -= 100
                    reason.append("overdue")
                if is_rush_urgent:
                    urgency -= 50
                    reason.append(tool.get("priority", "rush"))
                if is_stuck:
                    urgency -= 40
                    reason.append("stuck")
                if is_stale:
                    urgency -= 30
                    reason.append("stale")
                if is_approval_stale:
                    urgency -= 20
                    reason.append("awaiting approval")
                urgency -= days_since  # older = more urgent
                priority_jobs.append({
                    "request_number": job.get("request_number", ""),
                    "job_id": str(job.get("_id", "")),
                    "tool_type": tool.get("tool_type", ""),
                    "brand": tool.get("brand", ""),
                    "model_number": tool.get("model_number", ""),
                    "customer_name": cust_name,
                    "status": tool_status,
                    "days_in_status": days_since,
                    "assigned_technician": (tool.get("assigned_technician") or "").strip() or "Unassigned",
                    "priority": tool.get("priority", "standard"),
                    "is_overdue": is_overdue,
                    "reason": reason,
                    "_urgency": urgency,
                })

            # ── Parts aggregation ──
            tool_parts_list = tool.get("parts", [])
            for part in tool_parts_list:
                part_status = part.get("status", "pending")
                if part_status == "pending":
                    parts_pending += 1
                elif part_status == "ordered":
                    parts_ordered += 1
                elif part_status == "in_stock":
                    parts_in_stock += 1
                elif part_status == "received":
                    parts_received += 1
                elif part_status == "installed":
                    parts_installed += 1
                unit_cost = part.get("price") if part.get("price") is not None else part.get("unit_cost")
                qty = part.get("quantity", 1) or 1
                if unit_cost is not None:
                    parts_total_cost += float(unit_cost) * int(qty)
                    parts_has_cost = True

            # ── Ready for Repair detection ──
            READY_PART_STATUSES = {"in_stock", "received", "installed"}
            if tool_status in ("approved", "parts_pending"):
                if len(tool_parts_list) == 0 or all(
                    p.get("status") in READY_PART_STATUSES for p in tool_parts_list
                ):
                    ready_for_repair.append({
                        "request_number": job.get("request_number", ""),
                        "job_id": str(job.get("_id", "")),
                        "tool_type": tool.get("tool_type", ""),
                        "brand": tool.get("brand", ""),
                        "model_number": tool.get("model_number", ""),
                        "customer_name": cust_name,
                        "status": tool_status,
                        "parts_count": len(tool_parts_list),
                        "assigned_technician": (tool.get("assigned_technician") or "").strip() or "Unassigned",
                        "priority": tool.get("priority", "standard"),
                    })

            # ── Financial: active job value ──
            tool_parts_cost = sum(
                float(p.get("price") or p.get("unit_cost") or 0) * int(p.get("quantity", 1) or 1)
                for p in tool.get("parts", [])
                if p.get("price") is not None or p.get("unit_cost") is not None
            )
            labour_h = tool.get("labour_hours")
            labour_r = tool.get("hourly_rate")
            tool_labour = float(labour_h or 0) * float(labour_r or 0)
            if tool_parts_cost > 0 or tool_labour > 0:
                active_value += tool_parts_cost + tool_labour
                tools_priced += 1

    # ── Recently completed tools (last 24h) — scan all jobs ──
    # Also compute completions_today and completed_month_value from a separate query
    all_jobs_with_completions_cursor = db.repairs.find(
        {"tools.date_completed": {"$gte": one_day_ago}},
        {"request_number": 1, "tools": 1}
    )
    all_completed_jobs = await all_jobs_with_completions_cursor.to_list(length=500)

    for job in all_completed_jobs:
        request_number = job.get("request_number", "")
        for tool in job.get("tools", []):
            dc = tool.get("date_completed")
            if not dc:
                continue
            dc_dt = dc if isinstance(dc, datetime) else datetime.fromisoformat(str(dc).replace("Z", "+00:00")).replace(tzinfo=None)
            if dc_dt >= today_start_utc:
                completions_today += 1
            if dc_dt >= one_day_ago and len(recent_completions) < 10:
                recent_completions.append({
                    "request_number": request_number,
                    "brand": tool.get("brand", ""),
                    "model_number": tool.get("model_number", ""),
                    "assigned_technician": tool.get("assigned_technician", ""),
                    "date_completed": dc_dt.isoformat() + "Z",
                })
            # Completed this month financial value
            if dc_dt >= month_start_utc:
                tool_parts_cost = sum(
                    float(p.get("price") or p.get("unit_cost") or 0) * int(p.get("quantity", 1) or 1)
                    for p in tool.get("parts", [])
                    if p.get("price") is not None or p.get("unit_cost") is not None
                )
                labour_h = tool.get("labour_hours")
                labour_r = tool.get("hourly_rate")
                tool_labour = float(labour_h or 0) * float(labour_r or 0)
                completed_month_value += tool_parts_cost + tool_labour

    recent_completions.sort(key=lambda x: x["date_completed"], reverse=True)

    # Sort technician summary: Unassigned last, rest by active count desc
    sorted_techs = sorted(
        technician_summary.items(),
        key=lambda kv: (kv[0] == "Unassigned", -kv[1]["active"])
    )
    technician_summary_list = [{"name": k, **v} for k, v in sorted_techs]

    # ── Total active jobs ──
    total_active_jobs = await db.repairs.count_documents(
        {"tools.status": {"$in": active_statuses}}
    )

    # ── Ready for Pickup / Invoiced list ──
    pickup_statuses = {"ready", "invoiced"}
    pickup_jobs_cursor = db.repairs.find(
        {"tools.status": {"$in": list(pickup_statuses)}},
        {"request_number": 1, "company_name": 1, "first_name": 1, "last_name": 1, "phone": 1, "tools": 1}
    )
    pickup_jobs_raw = await pickup_jobs_cursor.to_list(length=200)

    ready_for_pickup = []
    for job in pickup_jobs_raw:
        pickup_tools = [t for t in job.get("tools", []) if t.get("status") in pickup_statuses]
        if not pickup_tools:
            continue
        # Determine dominant status (ready takes priority over invoiced)
        dominant_status = "ready" if any(t.get("status") == "ready" for t in pickup_tools) else "invoiced"
        # Find how long the earliest tool has been in a pickup status
        days_waiting = 0
        for tool in pickup_tools:
            history = tool.get("status_history", [])
            # Find the most recent entry where status became ready or invoiced
            for entry in reversed(history):
                if entry.get("status") in pickup_statuses:
                    ts = entry.get("timestamp")
                    if ts:
                        ts_dt = ts if isinstance(ts, datetime) else datetime.fromisoformat(str(ts).replace("Z", "+00:00")).replace(tzinfo=None)
                        d = (now - ts_dt).days
                        if d > days_waiting:
                            days_waiting = d
                    break
        company = job.get("company_name", "")
        first = job.get("first_name", "")
        last = job.get("last_name", "")
        customer_name = company if company else f"{first} {last}".strip()
        ready_for_pickup.append({
            "request_number": job.get("request_number", ""),
            "customer_name": customer_name,
            "phone": job.get("phone", ""),
            "tool_count": len(pickup_tools),
            "status": dominant_status,
            "days_waiting": days_waiting,
        })
    ready_for_pickup.sort(key=lambda x: -x["days_waiting"])
    ready_for_pickup = ready_for_pickup[:15]

    # ── Pending repair requests (unconverted online quotes) ──
    pending_requests_count = await db.quotes.count_documents({"status": "pending"})

    # ── Ready for Repair: sort by priority (urgent first) and trim ──
    priority_rank = {"urgent": 0, "rush": 1, "standard": 2}
    ready_for_repair.sort(key=lambda x: priority_rank.get(x["priority"], 2))
    ready_for_repair = ready_for_repair[:15]

    # ── Priority jobs: sort and trim ──
    priority_jobs.sort(key=lambda x: x["_urgency"])
    priority_jobs = priority_jobs[:15]
    for j in priority_jobs:
        j.pop("_urgency", None)

    # ── Active customers: aggregate from active_jobs ──
    for job in active_jobs:
        company = job.get("company_name", "")
        first_n = job.get("first_name", "")
        last_n = job.get("last_name", "")
        cust_name = company if company else f"{first_n} {last_n}".strip()
        if not cust_name:
            cust_name = "Unknown"
        updated = job.get("updated_at")
        if cust_name not in customer_map:
            customer_map[cust_name] = {"job_count": 0, "last_activity": None}
        customer_map[cust_name]["job_count"] += 1
        if updated and (customer_map[cust_name]["last_activity"] is None or updated > customer_map[cust_name]["last_activity"]):
            customer_map[cust_name]["last_activity"] = updated

    active_customers = sorted(
        [{"name": k, "job_count": v["job_count"], "last_activity": v["last_activity"].isoformat() + "Z" if v["last_activity"] else None}
         for k, v in customer_map.items()],
        key=lambda x: -x["job_count"]
    )[:20]

    # ── Pending approvals (quoted status jobs) ──
    quoted_jobs_cursor = db.repairs.find(
        {"tools.status": "quoted"},
        {"request_number": 1, "company_name": 1, "first_name": 1, "last_name": 1, "phone": 1, "tools": 1}
    )
    quoted_jobs_raw = await quoted_jobs_cursor.to_list(length=200)

    pending_approvals = []
    for job in quoted_jobs_raw:
        quoted_tools = [t for t in job.get("tools", []) if t.get("status") == "quoted"]
        if not quoted_tools:
            continue
        days_waiting = 0
        for tool in quoted_tools:
            history = tool.get("status_history", [])
            for entry in reversed(history):
                if entry.get("status") == "quoted":
                    ts = entry.get("timestamp")
                    if ts:
                        ts_dt = ts if isinstance(ts, datetime) else datetime.fromisoformat(str(ts).replace("Z", "+00:00")).replace(tzinfo=None)
                        d = (now - ts_dt).days
                        if d > days_waiting:
                            days_waiting = d
                    break
        company = job.get("company_name", "")
        first = job.get("first_name", "")
        last = job.get("last_name", "")
        customer_name = company if company else f"{first} {last}".strip()
        pending_approvals.append({
            "request_number": job.get("request_number", ""),
            "job_id": str(job.get("_id", "")),
            "customer_name": customer_name,
            "phone": job.get("phone", ""),
            "tool_count": len(quoted_tools),
            "days_waiting": days_waiting,
        })
    pending_approvals.sort(key=lambda x: -x["days_waiting"])
    pending_approvals = pending_approvals[:15]

    # Low-stock parts count
    low_stock_count = await db.parts_library_parts.count_documents({
        "active": True,
        "reorder_point": {"$gt": 0},
        "$expr": {"$lte": ["$quantity_on_hand", "$reorder_point"]}
    })

    return {
        "status_counts": status_counts,
        "overdue_count": overdue_count,
        "stale_count": stale_count,
        "stale_days": stale_days_threshold,
        "rush_urgent_active": rush_urgent_active,
        "updated_today": updated_today,
        "total_active_jobs": total_active_jobs,
        "low_stock_count": low_stock_count,
        # New fields
        "technician_summary": technician_summary_list,
        "today_activity": {
            "new_jobs": new_jobs_today,
            "completions": completions_today,
            "status_changes": updated_today,
        },
        "recent_completions": recent_completions,
        "parts_summary": {
            "pending": parts_pending,
            "ordered": parts_ordered,
            "in_stock": parts_in_stock,
            "received": parts_received,
            "installed": parts_installed,
            "total_cost": round(parts_total_cost, 2) if parts_has_cost else None,
        },
        "ready_for_repair": ready_for_repair,
        "ready_for_repair_count": len(ready_for_repair),
        "financial_summary": {
            "active_value": round(active_value, 2),
            "completed_month_value": round(completed_month_value, 2),
            "tools_priced": tools_priced,
            "tools_total": tools_total,
        },
        "aging_buckets": {
            "fresh": aging_fresh,
            "normal": aging_normal,
            "aging": aging_aging,
            "stale_plus": aging_stale_plus,
        },
        "ready_for_pickup": ready_for_pickup,
        "pending_requests_count": pending_requests_count,
        "pending_approval_stale_count": pending_approval_stale_count,
        "stuck_count": stuck_count,
        "priority_jobs": priority_jobs,
        "active_customers": active_customers,
        "pending_approvals": pending_approvals,
    }


# ──────────────────────────────────────────────
# PARTS ANALYTICS
# ──────────────────────────────────────────────

@router.get("/parts-analytics")
async def get_parts_analytics(current_user: User = Depends(require_admin)):
    """Aggregated parts usage analytics for stocking and supplier decisions."""
    db = get_database()

    # Shared prefix: one document per part row with trimmed identity fields.
    # Legacy rows hold empty strings (old part forms sent '' for unset fields),
    # so every filter/group below works on the trimmed values, never the raw ones.
    part_row_stages = [
        {"$unwind": "$tools"},
        {"$unwind": "$tools.parts"},
        {"$addFields": {
            "_name": {"$trim": {"input": {"$ifNull": ["$tools.parts.name", ""]}}},
            "_pn": {"$trim": {"input": {"$ifNull": ["$tools.parts.part_number", ""]}}},
            "_lid": {"$trim": {"input": {"$ifNull": ["$tools.parts.library_part_id", ""]}}},
            "_supplier": {"$trim": {"input": {"$ifNull": ["$tools.parts.supplier", ""]}}},
            "_qty": {"$convert": {"input": "$tools.parts.quantity", "to": "double", "onError": 1, "onNull": 1}},
            "_price": {"$convert": {"input": "$tools.parts.price", "to": "double", "onError": None, "onNull": None}},
        }},
    ]

    # Resolve the Parts Library record per row: by library_part_id when linked,
    # else by part number (case-insensitive) so manually typed parts still sync
    # with library cost, canonical naming, and compat groups.
    lib_resolve_stages = [
        {"$lookup": {
            "from": "parts_library_parts",
            "let": {"pid": "$_lid"},
            "pipeline": [
                {"$match": {"$expr": {"$and": [
                    {"$ne": ["$$pid", ""]},
                    {"$eq": [{"$toString": "$_id"}, "$$pid"]},
                ]}}},
                {"$project": {"name": 1, "part_number": 1, "compatibility_group_ids": 1, "cost": 1}},
            ],
            "as": "_lib_by_id",
        }},
        {"$lookup": {
            "from": "parts_library_parts",
            "let": {"pn": {"$toLower": "$_pn"}},
            "pipeline": [
                {"$match": {"$expr": {"$and": [
                    {"$ne": ["$$pn", ""]},
                    {"$eq": [{"$toLower": {"$trim": {"input": {"$ifNull": ["$part_number", ""]}}}}, "$$pn"]},
                ]}}},
                {"$limit": 1},
                {"$project": {"name": 1, "part_number": 1, "compatibility_group_ids": 1, "cost": 1}},
            ],
            "as": "_lib_by_pn",
        }},
        {"$addFields": {
            "_lib": {"$ifNull": [
                {"$arrayElemAt": ["$_lib_by_id", 0]},
                {"$arrayElemAt": ["$_lib_by_pn", 0]},
            ]},
        }},
        {"$addFields": {
            "_unit_cost": {"$ifNull": [
                "$_price",
                {"$ifNull": [
                    {"$convert": {"input": "$_lib.cost", "to": "double", "onError": None, "onNull": None}},
                    0,
                ]},
            ]},
        }},
    ]

    pipeline_most_used = part_row_stages + [
        {"$match": {"_name": {"$ne": ""}}},
    ] + lib_resolve_stages + [
        # Same physical part groups together whether the row was library-linked
        # or manually typed: library id first, then part number, then name.
        {"$addFields": {
            "_group_key": {"$cond": [
                {"$ne": ["$_lib", None]},
                {"$toString": "$_lib._id"},
                {"$cond": [{"$ne": ["$_pn", ""]}, {"$toLower": "$_pn"}, {"$toLower": "$_name"}]},
            ]},
        }},
        {"$group": {
            "_id": "$_group_key",
            "part_name": {"$first": {"$ifNull": ["$_lib.name", "$_name"]}},
            # $max skips nulls, so rows missing a part number don't win
            "part_number": {"$max": {"$ifNull": [
                "$_lib.part_number",
                {"$cond": [{"$ne": ["$_pn", ""]}, "$_pn", None]},
            ]}},
            "total_quantity": {"$sum": "$_qty"},
            "job_ids": {"$addToSet": "$_id"},
            "total_spend": {"$sum": {"$multiply": ["$_unit_cost", "$_qty"]}},
            "compat_ids": {"$max": "$_lib.compatibility_group_ids"},
        }},
        {"$addFields": {
            "job_count": {"$size": "$job_ids"},
        }},
        {"$sort": {"total_quantity": -1, "job_count": -1}},
        {"$limit": 25},
        # Look up compat group names (relationship stored on parts, not groups)
        {"$lookup": {
            "from": "parts_library_compat_groups",
            "let": {"group_ids": {"$map": {
                "input": {"$ifNull": ["$compat_ids", []]},
                "as": "gid",
                "in": {"$convert": {"input": "$$gid", "to": "objectId", "onError": None, "onNull": None}},
            }}},
            "pipeline": [
                {"$match": {"$expr": {"$and": [
                    {"$in": ["$_id", "$$group_ids"]},
                    {"$eq": ["$active", True]},
                ]}}},
                {"$project": {"_id": 0, "name": 1}},
            ],
            "as": "compat_groups",
        }},
        {"$project": {
            "_id": 0,
            "part_name": 1,
            "part_number": 1,
            "total_quantity": 1,
            "job_count": 1,
            "total_spend": {"$round": ["$total_spend", 2]},
            "compat_groups": {"$map": {"input": "$compat_groups", "as": "g", "in": "$$g.name"}},
        }},
    ]

    pipeline_suppliers = part_row_stages + [
        # Trimmed match drops the legacy ''/whitespace suppliers that used to
        # surface as a nameless top supplier.
        {"$match": {"_supplier": {"$ne": ""}}},
    ] + lib_resolve_stages + [
        # Case-insensitive grouping so "Ebay"/"eBay" don't split the same supplier
        {"$group": {
            "_id": {"$toLower": "$_supplier"},
            "supplier": {"$first": "$_supplier"},
            "part_count": {"$sum": "$_qty"},
            "total_spend": {"$sum": {"$multiply": ["$_unit_cost", "$_qty"]}},
            "unique_parts": {"$addToSet": {"$toLower": {
                "$cond": [{"$ne": ["$_pn", ""]}, "$_pn", "$_name"]
            }}},
        }},
        {"$addFields": {"unique_part_count": {"$size": "$unique_parts"}}},
        {"$sort": {"part_count": -1}},
        {"$limit": 10},
        {"$project": {
            "_id": 0,
            "supplier": 1,
            "part_count": 1,
            "total_spend": {"$round": ["$total_spend", 2]},
            "unique_part_count": 1,
        }},
    ]

    pipeline_lead_times = part_row_stages + [
        # $convert tolerates legacy rows where dates were stored as ISO strings
        {"$addFields": {
            "_od": {"$convert": {"input": "$tools.parts.order_date", "to": "date", "onError": None, "onNull": None}},
            "_dr": {"$convert": {"input": "$tools.parts.date_received", "to": "date", "onError": None, "onNull": None}},
        }},
        {"$match": {"_supplier": {"$ne": ""}, "_od": {"$ne": None}, "_dr": {"$ne": None}}},
        {"$addFields": {
            "lead_days": {"$divide": [{"$subtract": ["$_dr", "$_od"]}, 86400000]}
        }},
        # Received-before-ordered is a data entry error, not a real lead time
        {"$match": {"lead_days": {"$gte": 0}}},
        {"$group": {
            "_id": {"$toLower": "$_supplier"},
            "supplier": {"$first": "$_supplier"},
            "avg_lead_days": {"$avg": "$lead_days"},
            "min_lead_days": {"$min": "$lead_days"},
            "max_lead_days": {"$max": "$lead_days"},
            "sample_count": {"$sum": 1},
        }},
        {"$sort": {"avg_lead_days": 1}},
        {"$project": {
            "_id": 0,
            "supplier": 1,
            "avg_lead_days": {"$round": ["$avg_lead_days", 1]},
            "min_lead_days": {"$round": ["$min_lead_days", 1]},
            "max_lead_days": {"$round": ["$max_lead_days", 1]},
            "sample_count": 1,
        }},
    ]

    pipeline_monthly_spend = part_row_stages + [
        # Money actually committed: ordered/received/installed. Pending parts
        # aren't purchases yet; in_stock pulls come from previously bought stock.
        {"$match": {"tools.parts.status": {"$in": ["ordered", "received", "installed"]}}},
    ] + lib_resolve_stages + [
        {"$addFields": {
            "_od": {"$convert": {"input": "$tools.parts.order_date", "to": "date", "onError": None, "onNull": None}},
            "_dr": {"$convert": {"input": "$tools.parts.date_received", "to": "date", "onError": None, "onNull": None}},
            "_created": {"$convert": {"input": "$created_at", "to": "date", "onError": None, "onNull": None}},
        }},
        # Bucket by when the money was spent: order date, else received, else job creation
        {"$addFields": {
            "month_key": {"$dateToString": {
                "format": "%Y-%m",
                "date": {"$ifNull": ["$_od", {"$ifNull": ["$_dr", "$_created"]}]},
                "onNull": None,
            }},
        }},
        {"$match": {"month_key": {"$ne": None}}},
        {"$group": {
            "_id": "$month_key",
            "total_cost": {"$sum": {"$multiply": ["$_unit_cost", "$_qty"]}},
            "part_count": {"$sum": "$_qty"},
        }},
        {"$sort": {"_id": -1}},
        {"$limit": 6},
        {"$project": {
            "_id": 0,
            "month": "$_id",
            "total_cost": {"$round": ["$total_cost", 2]},
            "part_count": 1,
        }},
    ]

    most_used, top_suppliers, lead_times, monthly_spend = await asyncio.gather(
        db.repairs.aggregate(pipeline_most_used).to_list(length=25),
        db.repairs.aggregate(pipeline_suppliers).to_list(length=10),
        db.repairs.aggregate(pipeline_lead_times).to_list(length=20),
        db.repairs.aggregate(pipeline_monthly_spend).to_list(length=6),
    )

    return {
        "most_used_parts": most_used,
        "top_suppliers": top_suppliers,
        "supplier_lead_times": lead_times,
        "monthly_spend": monthly_spend,
    }


# ──────────────────────────────────────────────
# LIST
# ──────────────────────────────────────────────

@router.get("/")
async def list_repair_jobs(
    response: Response,
    skip: int = Query(default=0, ge=0),
    limit: int = Query(default=50, ge=1, le=200),
    status: Optional[str] = None,
    priority: Optional[str] = None,
    search: Optional[str] = None,
    customer_id: Optional[str] = None,
    assigned_technician: Optional[str] = None,
    active_only: bool = Query(default=False),
    sort_by: Optional[str] = Query(default="smart", regex="^(created_at|updated_at|request_number|smart)$"),
    sort_order: Optional[str] = Query(default="desc", regex="^(asc|desc)$"),
    current_user: User = Depends(require_admin)
):
    """List all repair jobs with optional filtering, search, and server-side pagination.
    Returns X-Total-Count header with total matching documents."""
    db = get_database()

    query = {}

    if customer_id:
        query["customer_id"] = customer_id

    if status:
        query["tools.status"] = status
    elif active_only:
        _ACTIVE = ["received", "diagnosed", "quoted", "approved", "parts_pending", "in_repair", "ready", "invoiced"]
        query["tools.status"] = {"$in": _ACTIVE}

    if priority:
        query["tools.priority"] = priority

    if assigned_technician:
        query["tools.assigned_technician"] = assigned_technician

    if search:
        escaped = re.escape(search)
        query["$or"] = [
            {"company_name": {"$regex": escaped, "$options": "i"}},
            {"first_name": {"$regex": escaped, "$options": "i"}},
            {"last_name": {"$regex": escaped, "$options": "i"}},
            {"email": {"$regex": escaped, "$options": "i"}},
            {"request_number": {"$regex": escaped, "$options": "i"}},
            {"tools.brand": {"$regex": escaped, "$options": "i"}},
            {"tools.model_number": {"$regex": escaped, "$options": "i"}},
            {"tools.tool_type": {"$regex": escaped, "$options": "i"}},
            {"tools.serial_number": {"$regex": escaped, "$options": "i"}},
        ]

    total = await db.repairs.count_documents(query)
    response.headers["X-Total-Count"] = str(total)
    response.headers["Access-Control-Expose-Headers"] = "X-Total-Count"

    if sort_by == "smart":
        # Compute Pacific midnight as naive UTC for MongoDB comparison
        now_pacific = datetime.now(_PACIFIC)
        today_start_utc = now_pacific.replace(
            hour=0, minute=0, second=0, microsecond=0
        ).astimezone(ZoneInfo("UTC")).replace(tzinfo=None)

        # Build $switch branches mapping each status string to its tier
        tier_branches = [
            {"case": {"$eq": ["$$t.status", status]}, "then": tier}
            for status, tier in _STATUS_TIER.items()
        ]

        pipeline = [
            {"$match": query},
            {"$addFields": {
                # 0 = updated today (sorts first), 1 = older
                "_updated_today": {"$cond": [{"$gte": ["$updated_at", today_start_utc]}, 0, 1]},
                # Best (lowest) tier across all tools on this job
                "_smart_tier": {
                    "$min": {
                        "$map": {
                            "input": "$tools",
                            "as": "t",
                            "in": {
                                "$switch": {
                                    "branches": tier_branches,
                                    "default": 3,
                                }
                            },
                        }
                    }
                },
            }},
            {"$sort": {"_updated_today": 1, "_smart_tier": 1, "updated_at": -1}},
            {"$skip": skip},
            {"$limit": limit},
            {"$unset": ["_updated_today", "_smart_tier"]},
        ]

        jobs = await db.repairs.aggregate(pipeline).to_list(length=limit)
    else:
        sort_direction = 1 if sort_order == "asc" else -1
        sort_field = sort_by if sort_by in ("created_at", "updated_at", "request_number") else "created_at"
        cursor = db.repairs.find(query).sort(sort_field, sort_direction).skip(skip).limit(limit)
        jobs = await cursor.to_list(length=limit)

    jobs = [convert_objectid_to_str(j) for j in jobs]
    return [_build_job_response(j) for j in jobs]


# ──────────────────────────────────────────────
# BATCH STATUS UPDATE (before /{job_id} routes)
# ──────────────────────────────────────────────

@router.post("/batch-status", response_model=BatchStatusResponse)
async def batch_update_tool_status(
    batch: BatchStatusRequest,
    current_user: User = Depends(require_admin)
):
    """Batch update status for multiple tools across one or more repair jobs."""
    db = get_database()

    results: list[BatchStatusResult] = []
    now = datetime.utcnow()

    # Group items by job_id to minimize DB round-trips
    by_job: dict[str, list] = defaultdict(list)
    for item in batch.items:
        by_job[item.job_id].append(item)

    for job_id, items in by_job.items():
        try:
            object_id = ObjectId(job_id)
        except Exception:
            for item in items:
                results.append(BatchStatusResult(
                    job_id=job_id, tool_id=item.tool_id,
                    success=False, error="Invalid job ID format"
                ))
            continue

        job = await db.repairs.find_one({"_id": object_id})
        if not job:
            for item in items:
                results.append(BatchStatusResult(
                    job_id=job_id, tool_id=item.tool_id,
                    success=False, error="Repair job not found"
                ))
            continue

        tools = job.get("tools", [])

        for item in items:
            tool_index = next((i for i, t in enumerate(tools) if t.get("tool_id") == item.tool_id), None)
            if tool_index is None:
                results.append(BatchStatusResult(
                    job_id=job_id, tool_id=item.tool_id,
                    success=False, error="Tool not found in this repair job"
                ))
                continue

            current_status = tools[tool_index].get("status", "received")
            new_status = item.new_status.value

            if not validate_status_transition(current_status, new_status):
                allowed = sorted(ALLOWED_TRANSITIONS.get(current_status, set()))
                results.append(BatchStatusResult(
                    job_id=job_id, tool_id=item.tool_id,
                    success=False,
                    error=f"Cannot change '{current_status}' → '{new_status}'. Allowed: {', '.join(allowed) or 'none'}"
                ))
                continue

            history_entry = {
                "status": new_status,
                "timestamp": now,
                "notes": item.notes
            }
            set_data: dict = {
                f"tools.{tool_index}.status": new_status,
                "updated_at": now,
            }
            if item.new_status == RepairStatus.COMPLETED:
                set_data[f"tools.{tool_index}.date_completed"] = now

            # Auto-mark all parts as installed when tool moves to "ready"
            # If a part wasn't used, it should be deleted from the job before reaching ready
            ready_stock_adjustments = []
            if item.new_status == RepairStatus.READY:
                tool_parts = tools[tool_index].get("parts", [])
                for pi, part in enumerate(tool_parts):
                    if part.get("status") != "installed":
                        set_data[f"tools.{tool_index}.parts.{pi}.status"] = "installed"
                        lib_id = part.get("library_part_id")
                        if lib_id:
                            qty = part.get("quantity", 1) or 1
                            ready_stock_adjustments.append((lib_id, -qty))

            try:
                await db.repairs.update_one(
                    {"_id": object_id},
                    {
                        "$set": set_data,
                        "$push": {f"tools.{tool_index}.status_history": history_entry}
                    }
                )
                # Update local copy so subsequent items in same job see new status
                tools[tool_index]["status"] = new_status
                if item.new_status == RepairStatus.READY:
                    for _part in tools[tool_index].get("parts", []):
                        if _part.get("status") != "installed":
                            _part["status"] = "installed"
                # Apply stock decrements for auto-installed parts
                job_id_str = str(object_id)
                for lib_id, delta in ready_stock_adjustments:
                    await _adjust_library_part_stock(
                        db, lib_id, delta, "auto_installed_ready",
                        job_id=job_id_str, tool_id=item.tool_id
                    )
                results.append(BatchStatusResult(
                    job_id=job_id, tool_id=item.tool_id,
                    success=True, new_status=new_status
                ))
            except Exception as e:
                logger.error(f"Batch status update failed for job {job_id} tool {item.tool_id}: {e}")
                results.append(BatchStatusResult(
                    job_id=job_id, tool_id=item.tool_id,
                    success=False, error="Database error"
                ))

    success_count = sum(1 for r in results if r.success)
    failure_count = len(results) - success_count
    return BatchStatusResponse(results=results, success_count=success_count, failure_count=failure_count)


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
            "first_name": customer.get("first_name"),
            "last_name": customer.get("last_name"),
            "email": customer.get("email"),
            "phone": customer.get("phone"),
            "address": customer.get("address"),
            "customer_notes": job_data_dict.get("customer_notes") or customer.get("customer_notes"),
        }
    else:
        # Inline customer fields — find or create
        email = str(job_data_dict.get("email", "")).lower().strip()
        if not email or not job_data_dict.get("first_name") or not job_data_dict.get("last_name") or not job_data_dict.get("phone"):
            raise HTTPException(
                status_code=422,
                detail="Either customer_id or first_name + last_name + email + phone are required"
            )
        existing = await db.customers.find_one({"email": email})
        if existing:
            cid = str(existing["_id"])
        else:
            now = datetime.utcnow()
            new_customer = {
                "company_name": job_data_dict.get("company_name"),
                "first_name": job_data_dict.get("first_name"),
                "last_name": job_data_dict.get("last_name"),
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
            "first_name": job_data_dict.get("first_name"),
            "last_name": job_data_dict.get("last_name"),
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
        tool_dict["date_received"] = _pacific_date_to_utc(tool_dict["date_received"])
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
            "zoho_ref": None,
            "assigned_technician": None,
            "photos": [],
            "status": RepairStatus.RECEIVED.value,
            "date_received": datetime.now(_PACIFIC).astimezone(ZoneInfo("UTC")).replace(tzinfo=None),
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
        first_name = quote.get("first_name", "").strip()
        last_name = quote.get("last_name", "").strip()
        phone = quote.get("phone", "").strip()
        phone_pattern = r'^\d{3}-\d{3}-\d{4}$'
        if email and first_name and last_name and re.match(phone_pattern, phone):
            now = datetime.utcnow()
            new_customer = {
                "company_name": quote.get("company_name") or None,
                "first_name": first_name,
                "last_name": last_name,
                "email": email,
                "phone": phone,
                "address": quote.get("address") or None,
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
        "first_name": quote.get("first_name", ""),
        "last_name": quote.get("last_name", ""),
        "email": email,
        "phone": quote.get("phone", ""),
        "address": quote.get("address") or None,
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

    # Only allow deletion of jobs where all tools are still in 'received' status
    for tool in job.get("tools", []):
        if tool.get("status") != "received":
            raise HTTPException(
                status_code=409,
                detail="Cannot delete: one or more tools have progressed beyond received status. Use the status workflow (abandoned/closed) instead."
            )

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
    tool_dict["date_received"] = _pacific_date_to_utc(tool_dict["date_received"])
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

    # Auto-set order_date and date_received when part status changes
    # Also track stock adjustments for inventory
    stock_adjustments = []
    if "parts" in update_fields:
        now = datetime.utcnow()
        old_parts = {p.get("name", ""): p for p in tools[tool_index].get("parts", [])}
        for part in update_fields["parts"]:
            old = old_parts.get(part.get("name", ""), {})
            new_status = part.get("status")
            old_status = old.get("status")
            if new_status == "ordered" and not part.get("order_date") and old_status != "ordered":
                part["order_date"] = now
            if new_status == "received" and not part.get("date_received") and old_status != "received":
                part["date_received"] = now
            # in_stock: part available from inventory — no order/receive dates needed
            # Stock: decrement when installed, increment back if reversed from installed
            lib_id = part.get("library_part_id") or old.get("library_part_id")
            if lib_id:
                qty = part.get("quantity", 1) or 1
                if new_status == "installed" and old_status not in ("installed",):
                    stock_adjustments.append((lib_id, -qty, "installed_in_job"))
                elif old_status == "installed" and new_status != "installed":
                    stock_adjustments.append((lib_id, qty, "reversed_from_installed"))

    set_data = {f"tools.{tool_index}.{k}": v for k, v in update_fields.items()}
    set_data["updated_at"] = datetime.utcnow()

    await db.repairs.update_one({"_id": object_id}, {"$set": set_data})

    # Apply stock adjustments after successful DB update
    job_id_str = str(object_id)
    for lib_id, delta, reason in stock_adjustments:
        await _adjust_library_part_stock(db, lib_id, delta, reason, job_id=job_id_str, tool_id=tool_id)

    updated_job = await db.repairs.find_one({"_id": object_id})
    updated_job = convert_objectid_to_str(updated_job)
    return _build_job_response(updated_job)


# ──────────────────────────────────────────────
# TOGGLE PART SOURCING FLAG
# ──────────────────────────────────────────────

@router.patch("/{job_id}/tools/{tool_id}/parts/{part_index}/sourcing")
async def toggle_part_sourcing(
    job_id: str,
    tool_id: str,
    part_index: int,
    current_user: User = Depends(require_admin)
):
    """Toggle the needs_sourcing flag on a specific part without replacing the entire parts array."""
    db = get_database()
    if not ObjectId.is_valid(job_id):
        raise HTTPException(status_code=404, detail="Repair job not found.")

    job = await db.repairs.find_one({"_id": ObjectId(job_id)})
    if not job:
        raise HTTPException(status_code=404, detail="Repair job not found.")

    # Find tool index by tool_id string
    tools = job.get("tools", [])
    tool_idx = None
    for i, t in enumerate(tools):
        if str(t.get("tool_id", "")) == tool_id or str(t.get("_id", "")) == tool_id:
            tool_idx = i
            break

    if tool_idx is None:
        raise HTTPException(status_code=404, detail="Tool not found on this repair job.")

    parts = tools[tool_idx].get("parts", [])
    if part_index < 0 or part_index >= len(parts):
        raise HTTPException(status_code=404, detail="Part index out of range.")

    current_value = parts[part_index].get("needs_sourcing", False)
    new_value = not current_value

    # Use positional update with array index path
    field_path = f"tools.{tool_idx}.parts.{part_index}.needs_sourcing"
    await db.repairs.update_one(
        {"_id": ObjectId(job_id)},
        {"$set": {field_path: new_value}}
    )

    return {"needs_sourcing": new_value, "part_index": part_index}


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

    current_status = tools[tool_index].get("status", "received")
    new_status = status_update.status.value
    if not validate_status_transition(current_status, new_status):
        allowed = sorted(ALLOWED_TRANSITIONS.get(current_status, set()))
        raise HTTPException(
            status_code=400,
            detail=f"Cannot change from '{current_status}' to '{new_status}'. "
                   f"Allowed: {', '.join(allowed) if allowed else 'none (terminal status)'}"
        )

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

    # Auto-mark all parts as installed when tool moves to "ready"
    # If a part wasn't used, it should be deleted from the job before reaching ready
    ready_stock_adjustments = []
    if status_update.status == RepairStatus.READY:
        parts = tools[tool_index].get("parts", [])
        for pi, part in enumerate(parts):
            if part.get("status") != "installed":
                set_data[f"tools.{tool_index}.parts.{pi}.status"] = "installed"
                lib_id = part.get("library_part_id")
                if lib_id:
                    qty = part.get("quantity", 1) or 1
                    ready_stock_adjustments.append((lib_id, -qty))

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

    # Apply stock decrements for parts auto-promoted to installed
    job_id_str = str(object_id)
    for lib_id, delta in ready_stock_adjustments:
        await _adjust_library_part_stock(
            db, lib_id, delta, "auto_installed_ready", job_id=job_id_str, tool_id=tool_id
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
# DELETE TOOL PHOTO
# ──────────────────────────────────────────────

@router.delete("/{job_id}/tools/{tool_id}/photos", response_model=RepairJobResponse)
async def delete_tool_photo(
    job_id: str,
    tool_id: str,
    photo_url: str = Query(..., description="Full photo URL or filename to delete"),
    current_user: User = Depends(require_admin)
):
    """Delete a specific photo from a tool in a repair job"""
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

    photos = tools[tool_index].get("photos", [])
    if photo_url not in photos:
        raise HTTPException(status_code=404, detail="Photo not found on this tool")

    # Delete file from storage (Spaces or local)
    try:
        await delete_file(photo_url)
    except Exception as e:
        logger.warning(f"Failed to delete photo file {photo_url}: {str(e)}")

    # Remove from database
    await db.repairs.update_one(
        {"_id": object_id},
        {
            "$pull": {f"tools.{tool_index}.photos": photo_url},
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


@router.post("/{job_id}/send-work-order-email", dependencies=[Depends(require_admin)])
async def send_work_order_email_endpoint(
    job_id: str,
    request: WorkOrderEmailSendRequest,
    current_user: User = Depends(require_admin),
):
    """Send the work order PDF + tool photos to the customer via email."""
    db = get_database()

    try:
        object_id = ObjectId(job_id)
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid job ID")

    job_doc = await db.repairs.find_one({"_id": object_id})
    if not job_doc:
        raise HTTPException(status_code=404, detail="Repair job not found")

    job_doc = convert_objectid_to_str(job_doc)
    job = _build_job_response(job_doc).model_dump()

    to_email = (request.recipient_email or "").strip() or (job.get("email") or "").strip()
    if not to_email:
        raise HTTPException(
            status_code=422,
            detail="No recipient email address. Add an email to the customer record or provide one in the request."
        )

    biz_settings = await db.business_settings.find_one({"active": True}) or {}
    template = biz_settings.get("workOrderEmailTemplate") or {}
    contact = biz_settings.get("contact") or {}
    business_info = {
        "companyName": "CNS Tool Repair",
        "phone": contact.get("phone") or "",
        "email": contact.get("email") or "",
        "address": contact.get("address") or {},
    }

    service_agreement = await db.service_agreement.find_one({}) or {}

    result = await send_work_order_email(
        db=db,
        job=job,
        template=template,
        business_info=business_info,
        service_agreement=service_agreement,
        recipient_email=request.recipient_email,
        subject_override=request.subject,
        custom_message=request.custom_message,
        sent_by=current_user.email if hasattr(current_user, "email") else "admin",
    )

    if not result["success"]:
        raise HTTPException(status_code=500, detail=result.get("error") or "Failed to send email")

    return {
        "success": True,
        "message": f"Work order email sent to {result['sent_to']}",
        "sent_to": result["sent_to"],
    }
