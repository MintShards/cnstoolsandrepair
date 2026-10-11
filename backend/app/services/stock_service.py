"""Library stock, kept by the work orders.

The shop's rule: a part that ARRIVES is booked into the parts library, and
the work order TAKES IT OUT when it is installed. The library count is the
one truth, and a job part linked to a library part moves it in two ways only:

  booked in  (+qty)  when the row's status reaches `received` from pending /
                     ordered — or jumps straight to `installed` from there,
                     which books and uses the part in one go;
  taken out  (-qty)  when the row's status reaches `installed`.

A part pulled from the shelf (`in_stock`) is already in the count, so it is
only ever taken out. Each row remembers what it moved (`stock_booked_qty`,
`stock_deducted_qty`), so a save is idempotent, an undo returns exactly what
was moved, a quantity edit moves only the difference, and rows are matched
across saves by their stable `id`, never by name. Counts are not floored: a
part installed that was never booked in leaves the library below zero, which
is the honest signal that a receipt was skipped.
"""
import logging
import uuid
from datetime import datetime
from typing import List, Optional, Tuple

from bson import ObjectId
from pymongo import ReturnDocument

logger = logging.getLogger(__name__)

IN_LIBRARY = ("received", "installed")        # the shop has the part
NOT_YET_HERE = (None, "pending", "ordered")    # before it arrived

# How a move reads in the library's stock history.
REASON_LABELS = {
    "received_for_job": "Booked in — received for a work order",
    "received_and_installed": "Booked in and installed in one step",
    "installed_in_job": "Taken out — installed on a work order",
    "reversed_from_installed": "Returned — no longer installed",
    "unreceived": "Receipt undone on the work order",
    "quantity_changed": "Quantity on the work order changed",
    "removed_from_job": "Returned — part removed from the work order",
    "relinked_restore": "Returned — work order part re-linked elsewhere",
    "relinked_unbook": "Receipt moved — work order part re-linked elsewhere",
    "tool_removed": "Returned — tool removed from the work order",
    "job_deleted": "Returned — work order deleted",
}

Move = Tuple[str, int, str, str]   # (library_part_id, delta, reason, row name)


def _qty(part: dict) -> int:
    try:
        return max(1, int(part.get("quantity") or 1))
    except (TypeError, ValueError):
        return 1


def _as_int(value) -> int:
    try:
        return int(value or 0)
    except (TypeError, ValueError):
        return 0


class StockPlan:
    """The moves one save implies, decided before anything is written."""

    def __init__(self) -> None:
        self.moves: List[Move] = []

    def add(self, lib_id: Optional[str], delta: int, reason: str, name: str) -> None:
        if lib_id and delta:
            self.moves.append((lib_id, int(delta), reason, name or ""))

    def __bool__(self) -> bool:
        return bool(self.moves)


async def _legacy_deducted(db, lib_id: str, job_id: Optional[str], tool_id: Optional[str]) -> int:
    """What the old code already took out of this library part for this tool.
    Rows from before the per-row counters carry no record of their own, so
    the part's history (entries referencing this job + tool) stands in."""
    if not (job_id and tool_id):
        return 0
    try:
        oid = ObjectId(lib_id)
    except Exception:
        return 0
    doc = await db.parts_library_parts.find_one({"_id": oid}, {"stock_history": 1})
    total = 0
    for h in (doc or {}).get("stock_history") or []:
        if h.get("reference_job_id") == job_id and h.get("reference_tool_id") == tool_id:
            total += _as_int(h.get("delta"))
    return max(0, -total)


async def plan_part_stock(db, *, job_id: Optional[str], tool_id: Optional[str],
                          old_parts: Optional[list], new_parts: Optional[list]) -> StockPlan:
    """Decide the library moves that saving `new_parts` in place of
    `old_parts` implies, and stamp every new row with its stable id and its
    running counters. Nothing is written here; the caller stores the rows
    and then applies the plan."""
    plan = StockPlan()
    old_parts = [p for p in (old_parts or []) if isinstance(p, dict)]
    new_parts = [p for p in (new_parts or []) if isinstance(p, dict)]
    old_by_id = {p["id"]: p for p in old_parts if p.get("id")}
    legacy = [p for p in old_parts if not p.get("id")]      # saved before rows had ids
    matched_ids = set()
    used_legacy = set()

    for new in new_parts:
        old = None
        if new.get("id") and new["id"] in old_by_id:
            old = old_by_id[new["id"]]
            matched_ids.add(new["id"])
        else:
            # A row saved before ids: pair it by name with an unmatched
            # legacy row so its past moves carry over instead of repeating.
            wanted = (new.get("name") or "").strip().lower()
            for i, lp in enumerate(legacy):
                if i in used_legacy:
                    continue
                if (lp.get("name") or "").strip().lower() == wanted:
                    old = lp
                    used_legacy.add(i)
                    break
            new["id"] = new.get("id") or str(uuid.uuid4())

        old_status = old.get("status") if old else None
        old_lib = old.get("library_part_id") if old else None
        booked = _as_int(old.get("stock_booked_qty")) if old else 0
        deducted = _as_int(old.get("stock_deducted_qty")) if old else 0
        if old is not None and not old.get("id") and old_lib and deducted == 0 and old_status == "installed":
            deducted = await _legacy_deducted(db, old_lib, job_id, tool_id)

        lib = new.get("library_part_id")
        name = new.get("name") or ""
        q = _qty(new)
        status = new.get("status")

        # Re-linked to another library part: give the old part back whatever
        # this row moved on it, and start the new link clean. A row linked
        # for the first time starts clean too — whatever it was before, the
        # library is only now hearing about it.
        if old_lib and lib != old_lib:
            if deducted:
                plan.add(old_lib, +deducted, "relinked_restore", name)
            if booked:
                plan.add(old_lib, -booked, "relinked_unbook", name)
        if lib != old_lib:
            booked = deducted = 0
            old_status = None

        if not lib:
            new["stock_booked_qty"] = 0
            new["stock_deducted_qty"] = 0
            continue

        # Booking in.
        if status in IN_LIBRARY:
            if booked == 0 and old_status in NOT_YET_HERE:
                reason = "received_for_job" if status == "received" else "received_and_installed"
                plan.add(lib, +q, reason, name)
                booked = q
            elif booked and booked != q:
                plan.add(lib, q - booked, "quantity_changed", name)
                booked = q
        elif status in ("pending", "ordered") and booked:
            plan.add(lib, -booked, "unreceived", name)
            booked = 0
        # in_stock: already on the shelf — nothing to book.

        # Taking out.
        want = q if status == "installed" else 0
        if want > deducted:
            plan.add(lib, -(want - deducted), "installed_in_job" if deducted == 0 else "quantity_changed", name)
            deducted = want
        elif want < deducted:
            plan.add(lib, +(deducted - want), "reversed_from_installed" if want == 0 else "quantity_changed", name)
            deducted = want

        new["stock_booked_qty"] = booked
        new["stock_deducted_qty"] = deducted

    # Rows that left the job: what they took out goes back on the shelf;
    # what they booked in stays — the part did arrive.
    for i, old in enumerate(old_parts):
        if old.get("id"):
            if old["id"] in matched_ids:
                continue
        elif legacy.index(old) in used_legacy:
            continue
        lib = old.get("library_part_id")
        if not lib:
            continue
        deducted = _as_int(old.get("stock_deducted_qty"))
        if not old.get("id") and deducted == 0 and old.get("status") == "installed":
            deducted = await _legacy_deducted(db, lib, job_id, tool_id)
        if deducted:
            plan.add(lib, +deducted, "removed_from_job", old.get("name") or "")
    return plan


async def plan_parts_removed(db, *, job_id: str, tool_id: str, parts: Optional[list],
                             reason: str) -> StockPlan:
    """The moves implied by a tool (or whole job) leaving the tracker: every
    row's deduction comes back; bookings stay, the parts did arrive."""
    plan = await plan_part_stock(db, job_id=job_id, tool_id=tool_id, old_parts=parts, new_parts=[])
    plan.moves = [(lib, delta, reason, name) for lib, delta, reason_, name in plan.moves]
    return plan


async def apply_stock_moves(db, plan: StockPlan, *, job: Optional[dict], tool: Optional[dict],
                            actor: Optional[dict]) -> None:
    """Write the planned moves to the library parts, each with a history
    entry that names the work order, the tool and who saved it. Best effort
    per move: one bad library id never blocks the rest."""
    if not plan:
        return
    now = datetime.utcnow()
    job_id = str(job.get("_id")) if job and job.get("_id") is not None else (job or {}).get("id")
    for lib_id, delta, reason, name in plan.moves:
        try:
            oid = ObjectId(lib_id)
        except Exception:
            continue
        updated = await db.parts_library_parts.find_one_and_update(
            {"_id": oid},
            {"$inc": {"quantity_on_hand": delta}, "$set": {"updated_at": now}},
            return_document=ReturnDocument.AFTER,
            projection={"quantity_on_hand": 1},
        )
        if not updated:
            continue
        entry = {
            "timestamp": now,
            "delta": delta,
            "reason": reason,
            "resulting_quantity": updated.get("quantity_on_hand", 0),
            "reference_job_id": job_id,
            "reference_tool_id": (tool or {}).get("tool_id"),
            "reference_request_number": (job or {}).get("request_number"),
            "reference_tool_label": _tool_label(tool),
            "part_row_name": name,
            "adjusted_by": (actor or {}).get("name") or "system",
            "adjusted_by_id": (actor or {}).get("user_id"),
            "source": "auto",
        }
        await db.parts_library_parts.update_one(
            {"_id": oid},
            {"$push": {"stock_history": {"$each": [entry], "$slice": -200}}},
        )
        if updated.get("quantity_on_hand", 0) < 0:
            logger.warning("Library part %s is below zero (%s) after %s on %s — a receipt was skipped",
                           lib_id, updated.get("quantity_on_hand"), reason, (job or {}).get("request_number"))


def _tool_label(tool: Optional[dict]) -> Optional[str]:
    if not tool:
        return None
    bits = [tool.get("brand"), tool.get("model_number")]
    comps = [tool.get("controller_model"), tool.get("reel_model"), tool.get("camera_head_model")]
    if not tool.get("model_number") and any(comps):
        bits = [tool.get("brand"), " / ".join(c for c in comps if c)]
    label = " ".join(str(b).strip() for b in bits if b and str(b).strip())
    return label or None
