"""Split the legacy per-tool `zoho_ref` into zoho_quote_number / zoho_invoice_number.

Dry run by default — prints every tool it would touch and changes nothing.
Pass --apply to write.

Routing: a ref that starts with INV goes to zoho_invoice_number; anything
else goes to zoho_quote_number (quotes come first in the workflow, so an
unprefixed ref is far more likely to be one). Review the dry-run listing
before applying — a misrouted number can be fixed on the tool afterwards.

    python scripts/migrate_zoho_ref.py            # dry run
    python scripts/migrate_zoho_ref.py --apply    # write
"""
import asyncio
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.database import connect_to_mongo, close_mongo_connection, get_database  # noqa: E402


def route(ref: str) -> str:
    return "zoho_invoice_number" if ref.upper().startswith("INV") else "zoho_quote_number"


async def main(apply: bool) -> None:
    await connect_to_mongo()
    try:
        db = get_database()
        planned = 0
        async for job in db.repairs.find({"tools.zoho_ref": {"$exists": True}}, {"request_number": 1, "tools": 1}):
            set_ops: dict = {}
            unset_ops: dict = {}
            for i, tool in enumerate(job.get("tools") or []):
                if "zoho_ref" not in tool:
                    continue
                ref = (tool.get("zoho_ref") or "").strip()
                unset_ops[f"tools.{i}.zoho_ref"] = ""
                if ref:
                    target = route(ref)
                    # Never clobber a value already entered in the new field.
                    if not (tool.get(target) or "").strip():
                        set_ops[f"tools.{i}.{target}"] = ref
                        print(f"  {job.get('request_number')} tool[{i}]: '{ref}' -> {target}")
                    else:
                        print(f"  {job.get('request_number')} tool[{i}]: '{ref}' skipped ({target} already set)")
                planned += 1
            if apply and (set_ops or unset_ops):
                update: dict = {}
                if set_ops:
                    update["$set"] = set_ops
                if unset_ops:
                    update["$unset"] = unset_ops
                await db.repairs.update_one({"_id": job["_id"]}, update)
        mode = "APPLIED" if apply else "DRY RUN"
        print(f"{mode}: {planned} tool(s) carried a zoho_ref field")
        if not apply and planned:
            print("Re-run with --apply to write these changes.")
    finally:
        await close_mongo_connection()


if __name__ == "__main__":
    asyncio.run(main(apply="--apply" in sys.argv[1:]))
