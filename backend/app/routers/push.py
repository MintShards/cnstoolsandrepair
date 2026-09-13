"""Web Push subscriptions for staff devices (see services/push_service.py)."""
import logging
from datetime import datetime

from fastapi import APIRouter, Depends

from app.config import settings
from app.database import get_database
from app.dependencies.auth import require_staff_or_admin
from app.models.auth import User
from app.models.push import PushSubscriptionIn, PushUnsubscribeIn
from app.services.push_service import notification, push_enabled, send_push

router = APIRouter(prefix="/api/push", tags=["push"])
logger = logging.getLogger(__name__)


@router.get("/public-key")
async def get_public_key(current_user: User = Depends(require_staff_or_admin)):
    """The VAPID public key the browser subscribes with; `enabled` is false
    until the keys are configured in .env (scripts/generate_vapid_keys.py)."""
    return {"enabled": push_enabled(), "public_key": settings.vapid_public_key or None}


@router.get("/me")
async def my_devices(current_user: User = Depends(require_staff_or_admin)):
    db = get_database()
    devices = await db.push_subscriptions.count_documents({"user_id": current_user.id})
    return {"enabled": push_enabled(), "devices": devices}


@router.post("/subscribe", status_code=201)
async def subscribe(sub: PushSubscriptionIn, current_user: User = Depends(require_staff_or_admin)):
    """Upsert by endpoint: re-enabling on the same device updates the row
    rather than duplicating it, and a device that changes hands moves to
    its new owner."""
    db = get_database()
    now = datetime.utcnow()
    await db.push_subscriptions.update_one(
        {"endpoint": sub.endpoint},
        {
            "$set": {
                "user_id": current_user.id,
                "keys": {"p256dh": sub.keys.p256dh, "auth": sub.keys.auth},
                "expiration_time": sub.expiration_time,
                "user_agent": sub.user_agent,
                "updated_at": now,
            },
            "$setOnInsert": {"created_at": now},
        },
        upsert=True,
    )
    devices = await db.push_subscriptions.count_documents({"user_id": current_user.id})
    logger.info(f"push subscription saved for {current_user.email} ({devices} device(s))")
    return {"ok": True, "devices": devices}


@router.delete("/subscribe")
async def unsubscribe(body: PushUnsubscribeIn, current_user: User = Depends(require_staff_or_admin)):
    db = get_database()
    result = await db.push_subscriptions.delete_one({"endpoint": body.endpoint, "user_id": current_user.id})
    return {"ok": True, "removed": result.deleted_count}


@router.post("/test")
async def send_test(current_user: User = Depends(require_staff_or_admin)):
    """Ping the caller's own devices so they can see a notification arrive."""
    db = get_database()
    sent = await send_push(
        db,
        notification(
            "Notifications are on",
            "You'll get task assignments, new online requests and ready-for-pickup alerts here.",
            "/workspace",
            tag="push-test",
        ),
        user_ids=[current_user.id],
    )
    return {"sent": sent}
