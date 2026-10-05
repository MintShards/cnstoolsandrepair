"""Diagnosis codes — the internal library of common tool problems.

Staff read and apply codes from the tracker; admins maintain the list in
Admin Settings → Diagnosis Codes. Deleting retires a code (`active: false`)
so findings that came from it keep their reference, and its number is never
reused. Usage counts are derived from repair findings on every read, never
stored.

Route order: the fixed paths (`/next`) come before `/{code_id}`.
"""
import logging
import re
from datetime import datetime
from typing import List, Optional

from bson import ObjectId
from fastapi import APIRouter, Depends, HTTPException, Query

from app.database import get_database
from app.dependencies.auth import require_admin, require_staff_or_admin
from app.models.auth import User
from app.models.diagnosis_code import (
    DiagnosisCodeCreate,
    DiagnosisCodeResponse,
    DiagnosisCodeUpdate,
    format_code,
    suggest_prefix,
)
from app.services.activity_service import CODE_FIELD_LABELS, actor_ref, diff_fields, record_activity
from app.utils.helpers import convert_objectid_to_str

router = APIRouter(prefix="/api/diagnosis-codes", tags=["diagnosis-codes"])
logger = logging.getLogger(__name__)


async def _next_number(db, prefix: str) -> int:
    """Next free number for a prefix — one past the highest ever issued,
    retired codes included, so a number is never reused."""
    doc = await db.diagnosis_codes.find_one(
        {"prefix": prefix}, sort=[("number", -1)], projection={"number": 1}
    )
    return int(doc["number"]) + 1 if doc else 1


async def _usage_counts(db) -> dict:
    """How many findings on repair tools came from each code."""
    pipeline = [
        {"$unwind": "$tools"},
        {"$unwind": "$tools.diagnostics"},
        {"$match": {"tools.diagnostics.code": {"$type": "string", "$ne": ""}}},
        {"$group": {"_id": "$tools.diagnostics.code", "n": {"$sum": 1}}},
    ]
    counts = {}
    async for row in db.repairs.aggregate(pipeline):
        counts[row["_id"]] = row["n"]
    return counts


def _build(doc: dict, usage: dict) -> DiagnosisCodeResponse:
    doc = convert_objectid_to_str(doc)
    doc["id"] = doc.pop("_id")
    doc["usage_count"] = usage.get(doc.get("code"), 0)
    return DiagnosisCodeResponse(**doc)


async def _assert_code_free(db, code: str, exclude_id: Optional[ObjectId] = None) -> None:
    query = {"code": code}
    if exclude_id is not None:
        query["_id"] = {"$ne": exclude_id}
    if await db.diagnosis_codes.find_one(query, projection={"_id": 1}):
        raise HTTPException(status_code=409, detail=f"Code {code} is already taken.")


@router.get("/", response_model=List[DiagnosisCodeResponse])
async def list_codes(
    tool_type: Optional[str] = Query(None, max_length=100),
    q: Optional[str] = Query(None, max_length=100),
    active_only: bool = True,
    current_user: User = Depends(require_staff_or_admin),
):
    """The library, grouped by tool type then code. `q` searches the code,
    the symptom, the likely causes, the repair and the quote note."""
    db = get_database()
    query: dict = {}
    if active_only:
        query["active"] = True
    if tool_type and tool_type.strip():
        query["tool_type"] = tool_type.strip().upper()
    if q and q.strip():
        pattern = {"$regex": re.escape(q.strip()), "$options": "i"}
        query["$or"] = [
            {"code": pattern},
            {"title": pattern},
            {"likely_causes": pattern},
            {"solution": pattern},
            {"quote_note": pattern},
        ]
    docs = await db.diagnosis_codes.find(
        query, sort=[("tool_type", 1), ("prefix", 1), ("number", 1)]
    ).to_list(length=2000)
    usage = await _usage_counts(db) if docs else {}
    return [_build(doc, usage) for doc in docs]


@router.get("/next")
async def next_code(
    prefix: Optional[str] = Query(None, max_length=6),
    tool_type: Optional[str] = Query(None, max_length=100),
    current_user: User = Depends(require_admin),
):
    """What the next code would be: the given prefix, or one suggested from
    the tool type, with the next free number for it."""
    db = get_database()
    clean = (prefix or "").strip().upper()
    if clean and not re.fullmatch(r"[A-Z0-9]{1,6}", clean):
        raise HTTPException(status_code=400, detail="Prefix must be 1–6 letters or digits.")
    if not clean:
        clean = suggest_prefix(tool_type or "")
    number = await _next_number(db, clean)
    return {"prefix": clean, "number": number, "code": format_code(clean, number)}


@router.post("/", response_model=DiagnosisCodeResponse, status_code=201)
async def create_code(
    data: DiagnosisCodeCreate,
    current_user: User = Depends(require_admin),
):
    db = get_database()
    number = data.number or await _next_number(db, data.prefix)
    code = format_code(data.prefix, number)
    await _assert_code_free(db, code)
    now = datetime.utcnow()
    doc = data.model_dump(exclude={"number"})
    doc.update({
        "code": code,
        "number": number,
        "created_by": actor_ref(current_user),
        "created_at": now,
        "updated_at": now,
    })
    result = await db.diagnosis_codes.insert_one(doc)
    created = await db.diagnosis_codes.find_one({"_id": result.inserted_id})
    logger.info("Diagnosis code %s created by %s", code, current_user.email)
    await record_activity(db, kind="code_added", actor=actor_ref(current_user),
                          summary=f"Diagnosis code {code} added — {data.title}",
                          details=[f"{data.category} · {data.tool_type}"])
    return _build(created, {})


@router.put("/{code_id}", response_model=DiagnosisCodeResponse)
async def update_code(
    code_id: str,
    data: DiagnosisCodeUpdate,
    current_user: User = Depends(require_admin),
):
    db = get_database()
    if not ObjectId.is_valid(code_id):
        raise HTTPException(status_code=404, detail="Diagnosis code not found.")
    oid = ObjectId(code_id)
    existing = await db.diagnosis_codes.find_one({"_id": oid})
    if not existing:
        raise HTTPException(status_code=404, detail="Diagnosis code not found.")

    update_fields = data.model_dump(exclude_unset=True)
    if not update_fields:
        raise HTTPException(status_code=400, detail="No fields provided to update.")

    # A new prefix or number renumbers the code; it must stay unique.
    prefix = update_fields.get("prefix", existing["prefix"])
    number = update_fields.get("number", existing["number"])
    code = format_code(prefix, number)
    if code != existing["code"]:
        await _assert_code_free(db, code, exclude_id=oid)
        update_fields["code"] = code
    update_fields["updated_at"] = datetime.utcnow()

    await db.diagnosis_codes.update_one({"_id": oid}, {"$set": update_fields})
    updated = await db.diagnosis_codes.find_one({"_id": oid})
    changes = diff_fields(existing, update_fields, CODE_FIELD_LABELS)
    if "parts" in update_fields and update_fields["parts"] != existing.get("parts"):
        changes.append("Parts list changed")
    if changes:
        restored = update_fields.get("active") is True and not existing.get("active", True)
        await record_activity(
            db, kind="code_restored" if restored else "code_edited", actor=actor_ref(current_user),
            summary=f"Diagnosis code {updated['code']} {'restored' if restored else 'edited'} — {updated.get('title')}",
            details=changes,
        )
    usage = await _usage_counts(db)
    return _build(updated, usage)


@router.delete("/{code_id}", status_code=204)
async def retire_code(
    code_id: str,
    current_user: User = Depends(require_admin),
):
    """Retire a code. Findings that came from it keep their reference and
    the number is never handed out again; PUT `active: true` brings it back."""
    db = get_database()
    if not ObjectId.is_valid(code_id):
        raise HTTPException(status_code=404, detail="Diagnosis code not found.")
    result = await db.diagnosis_codes.update_one(
        {"_id": ObjectId(code_id), "active": True},
        {"$set": {"active": False, "updated_at": datetime.utcnow()}},
    )
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Diagnosis code not found.")
    retired = await db.diagnosis_codes.find_one({"_id": ObjectId(code_id)}, {"code": 1, "title": 1})
    await record_activity(db, kind="code_retired", actor=actor_ref(current_user),
                          summary=f"Diagnosis code {(retired or {}).get('code', '')} retired — {(retired or {}).get('title', '')}")
