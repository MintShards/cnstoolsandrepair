"""Web Push to staff phones — no third-party messaging app.

Subscriptions live in `push_subscriptions`, one per browser/device keyed by
its endpoint and owned by the staff user who enabled them. Sends are best
effort: they run in the request's background tasks, never fail the action
that triggered them, and endpoints the push service reports gone (404/410)
are pruned so a stale phone doesn't keep costing a round-trip.
"""
import asyncio
import json
import logging
from datetime import datetime
from typing import Iterable, Optional

from app.config import settings

logger = logging.getLogger(__name__)

try:
    from pywebpush import WebPushException, webpush
except ImportError:  # dependency missing in an older image — push simply stays off
    webpush = None
    WebPushException = Exception

_TTL_SECONDS = 12 * 60 * 60


def push_enabled() -> bool:
    return bool(webpush and settings.vapid_public_key and settings.vapid_private_key)


def notification(title: str, body: str, url: str = "/workspace", tag: Optional[str] = None) -> dict:
    """Payload shape the service worker (frontend/public/sw.js) understands."""
    return {"title": title, "body": body, "url": url, "tag": tag}


def _send_one(sub: dict, data: str) -> str:
    """Blocking send for one device; called via asyncio.to_thread."""
    try:
        webpush(
            subscription_info={"endpoint": sub["endpoint"], "keys": sub["keys"]},
            data=data,
            vapid_private_key=settings.vapid_private_key,
            vapid_claims={"sub": settings.vapid_claims_email},
            ttl=_TTL_SECONDS,
        )
        return "ok"
    except WebPushException as exc:
        status = getattr(getattr(exc, "response", None), "status_code", None)
        if status in (404, 410):
            return "gone"
        logger.warning(f"push send failed ({status}): {exc}")
        return "error"
    except Exception as exc:  # noqa: BLE001 - a push must never take the request down
        logger.warning(f"push send failed: {exc}")
        return "error"


async def send_push(db, payload: dict, *, user_ids: Optional[Iterable[str]] = None,
                    exclude_user_id: Optional[str] = None) -> int:
    """Deliver `payload` to every device of `user_ids` (None = every
    subscribed staff device), skipping the actor's own devices when
    `exclude_user_id` is given. Returns the number of successful sends."""
    if not push_enabled():
        return 0
    query: dict = {}
    if user_ids is not None:
        ids = [i for i in user_ids if i]
        if not ids:
            return 0
        query["user_id"] = {"$in": ids}
    subs = [s async for s in db.push_subscriptions.find(query)]
    if exclude_user_id:
        subs = [s for s in subs if s.get("user_id") != exclude_user_id]
    if not subs:
        # Still worth a line: it tells us the trigger fired and the person
        # simply hasn't enabled notifications on any device.
        logger.info(f"push '{payload.get('title')}': no subscribed device to send to")
        return 0

    data = json.dumps(payload)
    results = await asyncio.gather(*(asyncio.to_thread(_send_one, s, data) for s in subs))

    gone = [s["_id"] for s, r in zip(subs, results) if r == "gone"]
    if gone:
        await db.push_subscriptions.delete_many({"_id": {"$in": gone}})
    ok = [s["_id"] for s, r in zip(subs, results) if r == "ok"]
    if ok:
        await db.push_subscriptions.update_many(
            {"_id": {"$in": ok}}, {"$set": {"last_used_at": datetime.utcnow()}}
        )
    logger.info(f"push '{payload.get('title')}': {len(ok)}/{len(subs)} device(s), {len(gone)} pruned")
    return len(ok)
