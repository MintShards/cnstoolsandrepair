import logging
from datetime import datetime
from typing import List, Optional

from bson import ObjectId
from fastapi import APIRouter, Depends, HTTPException, Query, Response, status

from app.database import get_database
from app.dependencies.auth import require_admin
from app.models.auth import User
from app.models.message import MessageCreate, MessageResponse, PinRequest, SpawnedTaskRef
from app.models.task import TaskCreate
from app.routers.tasks import _resolve_repair, _user_ref, create_task_document
from app.utils.helpers import convert_objectid_to_str

router = APIRouter(prefix="/api/messages", tags=["messages"])
logger = logging.getLogger(__name__)

PINNED_LIMIT = 20


def _build_message_response(doc: dict, task: Optional[SpawnedTaskRef] = None) -> MessageResponse:
    doc = convert_objectid_to_str(doc)
    doc["id"] = doc.pop("_id")
    if task is not None:
        doc["task"] = task
    return MessageResponse(**doc)


# /summary and /mark-all-read MUST be defined before /{message_id}
@router.get("/summary")
async def get_messages_summary(current_user: User = Depends(require_admin)):
    """Unread count + latest previews for badges and the dashboard card."""
    db = get_database()
    unread = await db.messages.count_documents({"read_by": {"$ne": current_user.id}})

    latest = []
    cursor = db.messages.find({}, sort=[("created_at", -1), ("_id", 1)]).limit(3)
    async for doc in cursor:
        latest.append({
            "id": str(doc["_id"]),
            "type": doc.get("type", "post"),
            "author_name": (doc.get("author") or {}).get("name"),
            "preview": (doc.get("body") or "")[:120],
            "important": doc.get("important", False),
            "created_at": doc.get("created_at"),
        })
    return {"unread": unread, "latest": latest}


@router.post("/mark-all-read")
async def mark_all_read(current_user: User = Depends(require_admin)):
    """Mark every message read for the current user. Only unread documents
    match the filter, so repeat calls (the feed polls this) are cheap."""
    db = get_database()
    result = await db.messages.update_many(
        {"read_by": {"$ne": current_user.id}},
        {"$addToSet": {"read_by": current_user.id}},
    )
    return {"marked": result.modified_count}


@router.get("/", response_model=List[MessageResponse])
async def list_messages(
    response: Response,
    skip: int = Query(default=0, ge=0),
    limit: int = Query(default=30, ge=1, le=100),
    pinned: bool = Query(default=False),
    current_user: User = Depends(require_admin),
):
    """Newest-first feed page. `pinned=true` returns only pinned messages
    (small hard cap, no pagination) for the block above the feed."""
    db = get_database()

    if pinned:
        query = {"pinned": True}
        cursor = db.messages.find(query, sort=[("created_at", -1), ("_id", 1)]).limit(PINNED_LIMIT)
        docs = await cursor.to_list(length=PINNED_LIMIT)
        response.headers["X-Total-Count"] = str(len(docs))
        response.headers["Access-Control-Expose-Headers"] = "X-Total-Count"
        return [_build_message_response(d) for d in docs]

    total = await db.messages.count_documents({})
    response.headers["X-Total-Count"] = str(total)
    response.headers["Access-Control-Expose-Headers"] = "X-Total-Count"

    cursor = (
        db.messages.find({}, sort=[("created_at", -1), ("_id", 1)])
        .skip(skip)
        .limit(limit)
    )
    docs = await cursor.to_list(length=limit)
    return [_build_message_response(d) for d in docs]


@router.post("/", response_model=MessageResponse, status_code=status.HTTP_201_CREATED)
async def create_message(data: MessageCreate, current_user: User = Depends(require_admin)):
    """Post to the feed or log a customer call. A call can spawn an assigned
    follow-up task in the same request (`spawn_task`)."""
    db = get_database()
    repair_id, request_number = await _resolve_repair(db, data.repair_id)

    spawned_task: Optional[SpawnedTaskRef] = None
    task_id: Optional[str] = None
    if data.spawn_task is not None:
        task_data = TaskCreate(
            title=data.spawn_task.title,
            details=data.spawn_task.details,
            assignee_id=data.spawn_task.assignee_id,
            priority=data.spawn_task.priority,
            due_date=data.spawn_task.due_date,
            repair_id=repair_id,
        )
        task_doc = await create_task_document(db, task_data, current_user)
        task_id = str(task_doc["_id"])
        spawned_task = SpawnedTaskRef(id=task_id, title=task_doc["title"])

    doc = {
        "type": data.type,
        "body": data.body,
        "author": _user_ref(current_user),
        "pinned": False,
        "important": data.important,
        "call": data.call.model_dump() if data.call else None,
        "repair_id": repair_id,
        "request_number": request_number,
        "task_id": task_id,
        "read_by": [current_user.id],
        "acknowledged_by": [],
        "created_at": datetime.utcnow(),
    }
    result = await db.messages.insert_one(doc)

    if task_id:
        await db.tasks.update_one(
            {"_id": ObjectId(task_id)},
            {"$set": {"source_message_id": str(result.inserted_id)}},
        )

    created = await db.messages.find_one({"_id": result.inserted_id})
    logger.info(f"Feed {data.type} created by {current_user.email}"
                + (f" (spawned task {task_id})" if task_id else ""))
    return _build_message_response(created, task=spawned_task)


@router.post("/{message_id}/ack", response_model=MessageResponse)
async def toggle_acknowledge(message_id: str, current_user: User = Depends(require_admin)):
    """Toggle the current user's 👍 on a message."""
    db = get_database()
    if not ObjectId.is_valid(message_id):
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Message not found")
    oid = ObjectId(message_id)

    doc = await db.messages.find_one({"_id": oid})
    if not doc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Message not found")

    if current_user.id in doc.get("acknowledged_by", []):
        op = {"$pull": {"acknowledged_by": current_user.id}}
    else:
        op = {"$addToSet": {"acknowledged_by": current_user.id}}
    await db.messages.update_one({"_id": oid}, op)

    updated = await db.messages.find_one({"_id": oid})
    return _build_message_response(updated)


@router.patch("/{message_id}/pin", response_model=MessageResponse)
async def set_pinned(message_id: str, data: PinRequest, current_user: User = Depends(require_admin)):
    """Pin/unpin a message to the top of the feed. Any staff member may pin —
    everyone shares the admin role, so gating would be meaningless."""
    db = get_database()
    if not ObjectId.is_valid(message_id):
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Message not found")
    oid = ObjectId(message_id)

    result = await db.messages.update_one({"_id": oid}, {"$set": {"pinned": data.pinned}})
    if result.matched_count == 0:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Message not found")

    updated = await db.messages.find_one({"_id": oid})
    return _build_message_response(updated)


@router.delete("/{message_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_message(message_id: str, current_user: User = Depends(require_admin)):
    """Author-only delete — the escape hatch for a mistaken call log."""
    db = get_database()
    if not ObjectId.is_valid(message_id):
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Message not found")
    oid = ObjectId(message_id)

    doc = await db.messages.find_one({"_id": oid})
    if not doc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Message not found")
    if (doc.get("author") or {}).get("user_id") != current_user.id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN,
                            detail="Only the author can delete a message")

    await db.messages.delete_one({"_id": oid})
