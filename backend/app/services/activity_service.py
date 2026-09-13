"""Activity log for the Workspace calendar and the printable activity report.

Who did what, day by day. Only events that have NO primary record of their
own are written here (tool / customer / work-order edits, deletions, photo
changes). Status changes, job creation, tool arrivals, tasks, customers and
online requests are read from their own collections by routers/activity.py,
which merges both sources into one timeline.
"""
import logging
from datetime import datetime
from enum import Enum
from typing import Optional

logger = logging.getLogger(__name__)

TOOL_FIELD_LABELS = {
    "tool_type": "Tool type", "brand": "Brand", "model_number": "Model",
    "serial_number": "Serial", "quantity": "Quantity", "remarks": "Remarks",
    "labour_hours": "Labour hours", "hourly_rate": "Hourly rate",
    "priority": "Priority", "warranty": "Warranty",
    "zoho_quote_number": "Zoho quote #", "zoho_invoice_number": "Zoho invoice #",
    "assigned_technician": "Technician", "estimated_completion": "Est. completion",
    "date_received": "Date received", "included_items": "Included with unit",
    "rod_length_received": "Rod received (ft)", "rod_length_cut": "Rod cut (ft)",
    "rod_length_remaining": "Rod remaining (ft)",
    "camera_head_model": "Camera head model", "camera_head_serial": "Camera head S/N",
    "controller_model": "Controller model", "controller_serial": "Controller S/N",
    "reel_model": "Reel model", "reel_serial": "Reel S/N",
    "counter_at_intake": "Odometer at intake", "counter_after_repair": "Odometer after repair",
    "intake_condition": "Condition at intake", "final_checklist": "Final test checklist",
}

CUSTOMER_FIELD_LABELS = {
    "company_name": "Company", "first_name": "First name", "last_name": "Last name",
    "email": "Email", "phone": "Phone", "address": "Address",
    "customer_notes": "Notes", "source": "Source",
}


def actor_ref(user) -> dict:
    """Snapshot of the acting user for history entries and the activity log."""
    name = f"{getattr(user, 'first_name', '') or ''} {getattr(user, 'last_name', '') or ''}".strip()
    return {"user_id": user.id, "name": name or user.email}


def tool_label(tool: dict) -> str:
    """'BRAND MODEL', or the Hathorn component models when there is no model."""
    bits = [tool.get("brand")]
    if tool.get("model_number"):
        bits.append(tool["model_number"])
    else:
        comps = [tool.get(k) for k in ("controller_model", "reel_model", "camera_head_model") if tool.get(k)]
        if comps:
            bits.append(" / ".join(comps))
    label = " ".join(b for b in bits if b)
    return label or tool.get("tool_type") or "tool"


def customer_display(doc: dict) -> str:
    return (doc.get("company_name")
            or f"{doc.get('first_name') or ''} {doc.get('last_name') or ''}".strip()
            or "—")


def _plain(value):
    """Incoming Pydantic dumps keep enums (Priority.RUSH); stored docs hold
    their string values. Compare and print the plain value."""
    if isinstance(value, Enum):
        return value.value
    if isinstance(value, list):
        return [_plain(v) for v in value]
    return value


def _fmt(value) -> str:
    value = _plain(value)
    if value is None or value == "" or value == []:
        return "—"
    if isinstance(value, bool):
        return "Yes" if value else "No"
    if isinstance(value, datetime):
        return value.strftime("%Y-%m-%d")
    if isinstance(value, list):
        return f"{len(value)} item{'s' if len(value) != 1 else ''}"
    if isinstance(value, float) and value.is_integer():
        return str(int(value))
    return str(value)


def _same(a, b) -> bool:
    a, b = _plain(a), _plain(b)
    if isinstance(a, str) or isinstance(b, str):
        return str(a or "").strip().lower() == str(b or "").strip().lower()
    if isinstance(a, list) and isinstance(b, list):
        return [str(x).strip().lower() for x in a] == [str(x).strip().lower() for x in b]
    if isinstance(a, datetime) and isinstance(b, datetime):
        return a.date() == b.date()
    if isinstance(a, (int, float)) and isinstance(b, (int, float)):
        return float(a) == float(b)
    return a == b


def diff_fields(old: dict, new: dict, labels: dict) -> list:
    """Human lines for the labelled keys present in `new` whose value changed."""
    lines = []
    for key, label in labels.items():
        if key not in new:
            continue
        before, after = old.get(key), new.get(key)
        if _same(before, after):
            continue
        lines.append(f"{label}: {_fmt(before)} → {_fmt(after)}")
    return lines


def _diff_parts(old_parts: list, new_parts: list) -> list:
    old_by = {(p.get("name") or "").strip().lower(): p for p in (old_parts or []) if p.get("name")}
    new_by = {(p.get("name") or "").strip().lower(): p for p in (new_parts or []) if p.get("name")}
    lines = []
    for key, part in new_by.items():
        if key not in old_by:
            lines.append(f"Part added: {part.get('name')}")
            continue
        before = _plain(old_by[key].get("status")) or "pending"
        after = _plain(part.get("status")) or "pending"
        if before != after:
            lines.append(f"Part {part.get('name')}: {before} → {after}")
    for key, part in old_by.items():
        if key not in new_by:
            lines.append(f"Part removed: {part.get('name')}")
    return lines


def diff_tool(old: dict, new_fields: dict) -> list:
    lines = diff_fields(old, new_fields, TOOL_FIELD_LABELS)
    if "parts" in new_fields:
        lines += _diff_parts(old.get("parts") or [], new_fields.get("parts") or [])
    return lines


def diff_customer(old: dict, new_fields: dict) -> list:
    return diff_fields(old, new_fields, CUSTOMER_FIELD_LABELS)


async def record_activity(db, *, kind: str, actor: Optional[dict], summary: str,
                          details: Optional[list] = None, job: Optional[dict] = None,
                          tool: Optional[dict] = None, customer: Optional[dict] = None) -> None:
    """Best effort: an activity write must never fail the request it describes."""
    doc = {
        "ts": datetime.utcnow(),
        "kind": kind,
        "actor": actor,
        "summary": summary,
        "details": [str(d) for d in (details or [])][:40],
        "job_id": str(job["_id"]) if job is not None and job.get("_id") is not None else None,
        "request_number": job.get("request_number") if job else None,
        "tool_id": tool.get("tool_id") if tool else None,
        "tool_label": tool_label(tool) if tool else None,
        "customer_id": str(customer["_id"]) if customer is not None and customer.get("_id") is not None else None,
        "customer_name": customer_display(customer) if customer else None,
    }
    try:
        await db.activity_log.insert_one(doc)
    except Exception as exc:  # noqa: BLE001 - logging must not break the request
        logger.warning(f"activity log write failed ({kind}): {exc}")
