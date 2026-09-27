#!/usr/bin/env python3
"""
Seed the diagnosis-code library (Admin Settings → Diagnosis Codes).

Loads scripts/data/diagnosis_codes_seed.json into the `diagnosis_codes`
collection. Matching is by code (HJ-03), so re-running is safe: by default
only codes that do not exist yet are added, and nothing the shop edited in
Admin Settings is touched. `--update` rewrites the seed's fields on existing
codes too (active flag and usage are never touched).

Usage:
    python scripts/seed_diagnosis_codes.py            # add missing codes
    python scripts/seed_diagnosis_codes.py --dry-run  # show what would change
    python scripts/seed_diagnosis_codes.py --update   # also refresh existing codes from the file

In production:
    docker exec cns-backend-prod python scripts/seed_diagnosis_codes.py
"""

import asyncio
import json
import re
import sys
from datetime import datetime
from pathlib import Path

# Add parent directory to path for imports
sys.path.insert(0, str(Path(__file__).parent.parent))

from motor.motor_asyncio import AsyncIOMotorClient
from app.config import settings
from app.models.diagnosis_code import CATEGORIES

SEED_FILE = Path(__file__).parent / "data" / "diagnosis_codes_seed.json"

# Fields the seed owns. `active`, `created_*` and anything else on an existing
# document are left alone.
SEED_FIELDS = ["category", "tool_type", "title", "likely_causes", "technician_checks", "solution", "parts", "quote_note"]
CODE_RE = re.compile(r"^([A-Z0-9]{1,6})-(\d{1,4})$")


def build_doc(entry: dict) -> dict:
    code = entry["code"].strip().upper()
    m = CODE_RE.match(code)
    if not m:
        raise ValueError(f"Bad code {entry['code']!r}: expected PREFIX-NN")
    doc = {field: entry.get(field) for field in SEED_FIELDS}
    doc["category"] = (doc["category"] or "GENERAL").strip().upper()
    if doc["category"] not in CATEGORIES:
        raise ValueError(f"{code}: category must be one of {', '.join(CATEGORIES)}")
    doc["tool_type"] = (doc["tool_type"] or "GENERAL").strip().upper()
    doc["title"] = (doc["title"] or "").strip()
    doc["likely_causes"] = [s.strip() for s in (doc["likely_causes"] or []) if s and s.strip()]
    doc["technician_checks"] = [s.strip() for s in (doc["technician_checks"] or []) if s and s.strip()]
    doc["solution"] = (doc["solution"] or "").strip() or None
    doc["quote_note"] = (doc["quote_note"] or "").strip() or None
    doc["parts"] = [
        {"name": p["name"].strip(), "quantity": int(p.get("quantity", 1) or 1)}
        for p in (doc["parts"] or []) if p.get("name", "").strip()
    ]
    if not doc["title"]:
        raise ValueError(f"{code}: title (symptom) is required")
    doc["code"] = code
    doc["prefix"] = m.group(1)
    doc["number"] = int(m.group(2))
    return doc


async def main():
    dry_run = "--dry-run" in sys.argv
    update = "--update" in sys.argv

    print("\n" + "=" * 60)
    print("SEED DIAGNOSIS CODES")
    print("=" * 60)
    print(f"\nDatabase: {settings.database_name}")
    if dry_run:
        print("Mode:     DRY RUN (no writes)")
    elif update:
        print("Mode:     ADD + UPDATE (existing codes refreshed from the file)")
    else:
        print("Mode:     ADD MISSING (existing codes untouched)")

    entries = json.loads(SEED_FILE.read_text(encoding="utf-8"))
    docs = [build_doc(e) for e in entries]
    codes = [d["code"] for d in docs]
    dupes = sorted({c for c in codes if codes.count(c) > 1})
    if dupes:
        print(f"\nSeed file repeats codes: {', '.join(dupes)}")
        sys.exit(1)
    print(f"Seed file: {len(docs)} codes across {len({d['tool_type'] for d in docs})} tool types")

    client = AsyncIOMotorClient(settings.mongodb_url, serverSelectionTimeoutMS=10000)
    db = client[settings.database_name]

    try:
        await client.admin.command("ping")
        print("Connected to MongoDB\n")

        created = updated = skipped = 0
        now = datetime.utcnow()

        for doc in docs:
            existing = await db.diagnosis_codes.find_one({"code": doc["code"]}, projection={"_id": 1, "title": 1})
            if existing:
                if update:
                    if not dry_run:
                        await db.diagnosis_codes.update_one(
                            {"_id": existing["_id"]}, {"$set": {**doc, "updated_at": now}}
                        )
                    print(f"  ~ {doc['code']:8} updated   {doc['title']}")
                    updated += 1
                else:
                    print(f"  = {doc['code']:8} exists    {existing.get('title', '')}")
                    skipped += 1
                continue
            if not dry_run:
                await db.diagnosis_codes.insert_one({
                    **doc,
                    "active": True,
                    "created_by": {"user_id": None, "name": "seed"},
                    "created_at": now,
                    "updated_at": now,
                })
            print(f"  + {doc['code']:8} added     {doc['title']}")
            created += 1

        print("\n" + "-" * 60)
        print(f"Added {created} · Updated {updated} · Left alone {skipped}")
        if dry_run:
            print("(dry run — nothing was written)")
    finally:
        client.close()


if __name__ == "__main__":
    asyncio.run(main())
