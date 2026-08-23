import calendar
import logging
from datetime import date, datetime, timedelta
from typing import List, Optional
from zoneinfo import ZoneInfo

from bson import ObjectId
from fastapi import APIRouter, Depends, HTTPException, Query, Response, status

from app.database import get_database
from app.dependencies.auth import require_staff_or_admin
from app.models.auth import User
from app.models.task import (
    BatchCompleteRequest,
    BatchCompleteResponse,
    BatchCompleteResult,
    TaskCreate,
    TaskResponse,
    TaskUpdate,
)
from app.utils.helpers import convert_objectid_to_str, user_display_name

router = APIRouter(prefix="/api/tasks", tags=["tasks"])
logger = logging.getLogger(__name__)

_PACIFIC = ZoneInfo("America/Vancouver")

# Whitelist of sortable columns. Priority sorts by rank, not alphabetically.
TASK_SORT_FIELDS = {
    "due_date": "due_date",
    "priority": "_priority_rank",
    "created_at": "created_at",
    "completed_at": "completed_at",
    "title": "title",
    "status": "status",
}

_OPEN_QUERY = {"status": {"$ne": "done"}}
_UNASSIGNED_OR = [{"assignee_id": None}, {"assignee_id": {"$exists": False}}]


def _pacific_today_ymd() -> str:
    """Shop-local calendar date, matching the frontend's getTodayPacific()."""
    return datetime.now(_PACIFIC).strftime("%Y-%m-%d")


def _next_due(due_ymd: str, recurrence: str, today_ymd: str) -> str:
    """Next occurrence date for a recurring task, as a YYYY-MM-DD string.

    Advances from the ORIGINAL due date (preserving the weekday / day-of-month
    anchor) until the result is strictly after both the original due date and
    today — so completing a long-overdue chore never spawns an already-overdue
    next occurrence. Monthly clamps to the target month's length (Jan 31 →
    Feb 28) but keeps anchoring on the original day (→ Mar 31).
    """
    y, m, d = (int(p) for p in due_ymd.split("-"))
    current = date(y, m, d)
    today = date(*(int(p) for p in today_ymd.split("-")))
    anchor_day = d

    while True:
        if recurrence == "daily":
            current = current + timedelta(days=1)
        elif recurrence == "weekly":
            current = current + timedelta(days=7)
        elif recurrence == "monthly":
            if current.month == 12:
                ny, nm = current.year + 1, 1
            else:
                ny, nm = current.year, current.month + 1
            last_day = calendar.monthrange(ny, nm)[1]
            current = date(ny, nm, min(anchor_day, last_day))
        else:
            raise ValueError(f"Unknown recurrence: {recurrence}")

        if current > today:
            return current.strftime("%Y-%m-%d")


def _display_name(user: User) -> str:
    return (f"{user.first_name or ''} {user.last_name or ''}".strip()) or user.email


def _user_ref(user: User) -> dict:
    return {"user_id": user.id, "name": _display_name(user)}


def _build_task_response(doc: dict) -> TaskResponse:
    doc = convert_objectid_to_str(doc)
    doc["id"] = doc.pop("_id")
    return TaskResponse(**doc)


async def _resolve_assignee(db, assignee_id: Optional[str]):
    """Validate an assignee id against active users; return (id, display name)."""
    if assignee_id is None:
        return None, None
    if not ObjectId.is_valid(assignee_id):
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Assignee not found")
    user_doc = await db.users.find_one({"_id": ObjectId(assignee_id), "is_active": True})
    if not user_doc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Assignee not found")
    return assignee_id, user_display_name(user_doc)


async def _resolve_repair(db, repair_id: Optional[str]):
    """Validate a work-order link; return (id, request_number snapshot)."""
    if repair_id is None:
        return None, None
    if not ObjectId.is_valid(repair_id):
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Work order not found")
    job = await db.repairs.find_one({"_id": ObjectId(repair_id)}, {"request_number": 1})
    if not job:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Work order not found")
    return repair_id, job.get("request_number")


async def _spawn_next_occurrence(db, pre_image: dict, now: datetime) -> None:
    """Insert the next occurrence of a just-completed recurring task."""
    next_due = _next_due(pre_image["due_date"], pre_image["recurrence"], _pacific_today_ymd())
    doc = {
        "title": pre_image["title"],
        "details": pre_image.get("details"),
        "status": "todo",
        "priority": pre_image.get("priority", "normal"),
        "due_date": next_due,
        "assignee_id": pre_image.get("assignee_id"),
        "assignee_name": pre_image.get("assignee_name"),
        "repair_id": pre_image.get("repair_id"),
        "request_number": pre_image.get("request_number"),
        "recurrence": pre_image["recurrence"],
        "spawned_from": str(pre_image["_id"]),
        "source_message_id": None,
        "created_by": pre_image.get("created_by"),
        "completed_by": None,
        "completed_at": None,
        "created_at": now,
        "updated_at": now,
    }
    await db.tasks.insert_one(doc)
    logger.info(f"Recurring task '{pre_image['title']}' respawned, next due {next_due}")


async def _complete_task(db, oid: ObjectId, current_user: User, now: datetime) -> Optional[dict]:
    """Mark a task done. Idempotent: the status filter means a task already
    done matches nothing, so double-completion (or two workers racing) spawns
    the recurring follow-up at most once. Returns the pre-image, or None if
    the task was already done."""
    pre = await db.tasks.find_one_and_update(
        {"_id": oid, "status": {"$ne": "done"}},
        {"$set": {
            "status": "done",
            "completed_by": _user_ref(current_user),
            "completed_at": now,
            "updated_at": now,
        }},
    )
    if pre is not None and pre.get("recurrence", "none") != "none" and pre.get("due_date"):
        await _spawn_next_occurrence(db, pre, now)
    return pre


async def create_task_document(
    db, data: TaskCreate, current_user: User, source_message_id: Optional[str] = None
) -> dict:
    """Validate + insert a task. Shared by POST /api/tasks and call-log spawning."""
    assignee_id, assignee_name = await _resolve_assignee(db, data.assignee_id)
    repair_id, request_number = await _resolve_repair(db, data.repair_id)

    now = datetime.utcnow()
    doc = {
        "title": data.title,
        "details": data.details,
        "status": data.status,
        "priority": data.priority,
        "due_date": data.due_date,
        "assignee_id": assignee_id,
        "assignee_name": assignee_name,
        "repair_id": repair_id,
        "request_number": request_number,
        "recurrence": data.recurrence,
        "spawned_from": None,
        "source_message_id": source_message_id,
        "created_by": _user_ref(current_user),
        "completed_by": _user_ref(current_user) if data.status == "done" else None,
        "completed_at": now if data.status == "done" else None,
        "created_at": now,
        "updated_at": now,
    }
    result = await db.tasks.insert_one(doc)
    return await db.tasks.find_one({"_id": result.inserted_id})


# /summary and /batch-complete MUST be defined before /{task_id}
@router.get("/summary")
async def get_tasks_summary(current_user: User = Depends(require_staff_or_admin)):
    """Badge counts for the workspace sidebar / tracker header / dashboard."""
    db = get_database()
    today = _pacific_today_ymd()
    my_open_query = {**_OPEN_QUERY, "assignee_id": current_user.id}

    my_open = await db.tasks.count_documents(my_open_query)
    my_overdue = await db.tasks.count_documents({**my_open_query, "due_date": {"$lt": today}})
    due_today = await db.tasks.count_documents({**_OPEN_QUERY, "due_date": today})
    all_open = await db.tasks.count_documents(_OPEN_QUERY)
    unassigned_open = await db.tasks.count_documents({**_OPEN_QUERY, "$or": _UNASSIGNED_OR})

    return {
        "my_open": my_open,
        "my_overdue": my_overdue,
        "due_today": due_today,
        "all_open": all_open,
        "unassigned_open": unassigned_open,
    }


@router.post("/batch-complete", response_model=BatchCompleteResponse)
async def batch_complete_tasks(
    batch: BatchCompleteRequest,
    current_user: User = Depends(require_staff_or_admin),
):
    """Mark up to 100 tasks done, reporting per-item results rather than
    failing the whole batch. Already-done tasks count as success (idempotent)."""
    db = get_database()
    now = datetime.utcnow()
    results: List[BatchCompleteResult] = []

    for task_id in batch.ids:
        if not ObjectId.is_valid(task_id):
            results.append(BatchCompleteResult(id=task_id, success=False, error="Invalid task ID"))
            continue
        oid = ObjectId(task_id)
        pre = await _complete_task(db, oid, current_user, now)
        if pre is None:
            exists = await db.tasks.find_one({"_id": oid}, {"_id": 1})
            if exists:
                results.append(BatchCompleteResult(id=task_id, success=True))
            else:
                results.append(BatchCompleteResult(id=task_id, success=False, error="Task not found"))
        else:
            results.append(BatchCompleteResult(id=task_id, success=True))

    success_count = sum(1 for r in results if r.success)
    return BatchCompleteResponse(
        results=results,
        success_count=success_count,
        failure_count=len(results) - success_count,
    )


@router.get("/", response_model=List[TaskResponse])
async def list_tasks(
    response: Response,
    skip: int = Query(default=0, ge=0),
    limit: int = Query(default=50, ge=1, le=200),
    status_filter: Optional[str] = Query(default=None, alias="status",
                                         pattern="^(todo|in_progress|done|open)$"),
    assignee: Optional[str] = Query(default=None),
    priority: Optional[str] = Query(default=None, pattern="^(normal|high|urgent)$"),
    due_from: Optional[str] = Query(default=None, pattern=r"^\d{4}-\d{2}-\d{2}$"),
    due_to: Optional[str] = Query(default=None, pattern=r"^\d{4}-\d{2}-\d{2}$"),
    sort_by: str = Query(default="due_date"),
    sort_dir: str = Query(default="asc", pattern="^(asc|desc)$"),
    current_user: User = Depends(require_staff_or_admin),
):
    """Paginated, server-sorted task list. `status=open` means not done;
    `assignee` accepts `me`, `unassigned`, or a user id."""
    db = get_database()

    query: dict = {}
    if status_filter == "open":
        query["status"] = {"$ne": "done"}
    elif status_filter:
        query["status"] = status_filter
    if assignee == "me":
        query["assignee_id"] = current_user.id
    elif assignee == "unassigned":
        query["$or"] = _UNASSIGNED_OR
    elif assignee:
        query["assignee_id"] = assignee
    if priority:
        query["priority"] = priority
    if due_from or due_to:
        due_range: dict = {}
        if due_from:
            due_range["$gte"] = due_from
        if due_to:
            due_range["$lte"] = due_to
        query["due_date"] = due_range

    if sort_by not in TASK_SORT_FIELDS:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Cannot sort by '{sort_by}'. Allowed: {', '.join(sorted(TASK_SORT_FIELDS))}",
        )
    sort_key = TASK_SORT_FIELDS[sort_by]
    direction = 1 if sort_dir == "asc" else -1

    total = await db.tasks.count_documents(query)
    response.headers["X-Total-Count"] = str(total)
    response.headers["Access-Control-Expose-Headers"] = "X-Total-Count"

    add_fields: dict = {
        "_priority_rank": {
            "$switch": {
                "branches": [
                    {"case": {"$eq": ["$priority", "urgent"]}, "then": 3},
                    {"case": {"$eq": ["$priority", "high"]}, "then": 2},
                ],
                "default": 1,
            }
        },
    }
    # Tasks without a due date sort last in either direction.
    if sort_key == "due_date":
        sentinel = "9999-12-31" if direction == 1 else ""
        add_fields["_due_key"] = {"$ifNull": ["$due_date", sentinel]}
        sort_key = "_due_key"

    pipeline = [
        {"$match": query},
        {"$addFields": add_fields},
        # _id breaks ties so pagination stays stable across pages.
        {"$sort": {sort_key: direction, "_id": 1}},
        {"$skip": skip},
        {"$limit": limit},
    ]

    docs = []
    async for doc in db.tasks.aggregate(pipeline):
        doc.pop("_priority_rank", None)
        doc.pop("_due_key", None)
        docs.append(_build_task_response(doc))
    return docs


@router.get("/{task_id}", response_model=TaskResponse)
async def get_task(task_id: str, current_user: User = Depends(require_staff_or_admin)):
    """Fetch one task — used by feed entries linking to their spawned task."""
    db = get_database()
    if not ObjectId.is_valid(task_id):
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Task not found")
    doc = await db.tasks.find_one({"_id": ObjectId(task_id)})
    if not doc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Task not found")
    return _build_task_response(doc)


@router.post("/", response_model=TaskResponse, status_code=status.HTTP_201_CREATED)
async def create_task(data: TaskCreate, current_user: User = Depends(require_staff_or_admin)):
    """Create a task, snapshotting the assignee name and work-order number."""
    db = get_database()
    created = await create_task_document(db, data, current_user)
    logger.info(f"Task created: '{created['title']}' by {current_user.email}")
    return _build_task_response(created)


@router.put("/{task_id}", response_model=TaskResponse)
async def update_task(task_id: str, data: TaskUpdate, current_user: User = Depends(require_staff_or_admin)):
    """Partial update. Explicit nulls clear due_date/assignee/work-order link;
    status changes run through the completion path (recurrence-aware)."""
    db = get_database()
    if not ObjectId.is_valid(task_id):
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Task not found")
    oid = ObjectId(task_id)

    existing = await db.tasks.find_one({"_id": oid})
    if not existing:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Task not found")

    updates = data.model_dump(exclude_unset=True)
    if not updates:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="No fields provided to update.")
    new_status = updates.pop("status", None)

    if "assignee_id" in updates:
        assignee_id, assignee_name = await _resolve_assignee(db, updates["assignee_id"])
        updates["assignee_id"] = assignee_id
        updates["assignee_name"] = assignee_name
    if "repair_id" in updates:
        repair_id, request_number = await _resolve_repair(db, updates["repair_id"])
        updates["repair_id"] = repair_id
        updates["request_number"] = request_number

    merged_recurrence = updates.get("recurrence", existing.get("recurrence", "none"))
    merged_due = updates["due_date"] if "due_date" in updates else existing.get("due_date")
    if merged_recurrence != "none" and not merged_due:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST,
                            detail="Recurring tasks need a due date")

    now = datetime.utcnow()
    if updates:
        updates["updated_at"] = now
        await db.tasks.update_one({"_id": oid}, {"$set": updates})

    if new_status == "done":
        await _complete_task(db, oid, current_user, now)
    elif new_status is not None and new_status != existing.get("status"):
        # Reopening clears completion markers. An already-spawned recurring
        # follow-up is NOT retracted — delete it manually if unwanted.
        await db.tasks.update_one(
            {"_id": oid},
            {"$set": {"status": new_status, "completed_by": None, "completed_at": None, "updated_at": now}},
        )

    updated = await db.tasks.find_one({"_id": oid})
    return _build_task_response(updated)


@router.post("/{task_id}/claim", response_model=TaskResponse)
async def claim_task(task_id: str, current_user: User = Depends(require_staff_or_admin)):
    """Atomically claim an unassigned task. First claimer wins; the loser
    gets a 409 rather than silently overwriting."""
    db = get_database()
    if not ObjectId.is_valid(task_id):
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Task not found")
    oid = ObjectId(task_id)

    result = await db.tasks.update_one(
        {"_id": oid, "$or": _UNASSIGNED_OR},
        {"$set": {
            "assignee_id": current_user.id,
            "assignee_name": _display_name(current_user),
            "updated_at": datetime.utcnow(),
        }},
    )
    if result.matched_count == 0:
        exists = await db.tasks.find_one({"_id": oid}, {"_id": 1})
        if not exists:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Task not found")
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Task already claimed")

    updated = await db.tasks.find_one({"_id": oid})
    return _build_task_response(updated)


@router.delete("/{task_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_task(task_id: str, current_user: User = Depends(require_staff_or_admin)):
    """Hard delete (tasks are operational, not records of business value)."""
    db = get_database()
    if not ObjectId.is_valid(task_id):
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Task not found")
    result = await db.tasks.delete_one({"_id": ObjectId(task_id)})
    if result.deleted_count == 0:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Task not found")
