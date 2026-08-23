from bson import ObjectId
from typing import Dict, Any


def convert_objectid_to_str(doc: Dict[str, Any]) -> Dict[str, Any]:
    """Convert MongoDB ObjectId to string for JSON serialization"""
    if doc and "_id" in doc:
        doc["_id"] = str(doc["_id"])
    return doc


def user_display_name(doc: Dict[str, Any]) -> str:
    """Best display name for a users document.

    Tolerates the legacy create_admin.py shape, which wrote a single
    `name` field instead of first_name/last_name.
    """
    full = f"{doc.get('first_name') or ''} {doc.get('last_name') or ''}".strip()
    return full or doc.get("name") or doc.get("email") or "Unknown"
