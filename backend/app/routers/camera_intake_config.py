from fastapi import APIRouter, HTTPException, Depends
from datetime import datetime
from app.database import get_database
from app.models.camera_intake import CameraIntakeConfigUpdate, CameraIntakeConfigResponse
from app.utils.helpers import convert_objectid_to_str
from app.dependencies.auth import require_admin, require_staff_or_admin


router = APIRouter(prefix="/api/camera-intake-config", tags=["camera-intake-config"])


@router.get("/", response_model=CameraIntakeConfigResponse, dependencies=[Depends(require_staff_or_admin)])
async def get_camera_intake_config():
    """The camera-intake option lists the tracker's tool form renders.

    Staff-guarded (not public): only the Repair Tracker reads it. Missing
    document or missing fields fall back to the shipped defaults.
    """
    db = get_database()
    doc = await db.camera_intake_config.find_one({"active": True})
    if not doc:
        return CameraIntakeConfigResponse()
    doc = convert_objectid_to_str(doc)
    return CameraIntakeConfigResponse(**doc)


@router.put("/", response_model=CameraIntakeConfigResponse, dependencies=[Depends(require_admin)])
async def update_camera_intake_config(data: CameraIntakeConfigUpdate):
    """Admin Settings → Camera Intake saves here. Singleton upsert.

    The Ready gate in the repairs router reads final_checklist from this
    document on every status change, so edits take effect immediately —
    no restart, no code change.
    """
    db = get_database()
    payload = data.model_dump()
    payload["active"] = True
    payload["updatedAt"] = datetime.utcnow()

    await db.camera_intake_config.update_one(
        {"active": True},
        {
            "$set": payload,
            "$setOnInsert": {"createdAt": datetime.utcnow()},
        },
        upsert=True,
    )

    doc = await db.camera_intake_config.find_one({"active": True})
    if not doc:
        raise HTTPException(status_code=500, detail="Failed to save camera intake config")

    doc = convert_objectid_to_str(doc)
    return CameraIntakeConfigResponse(**doc)
