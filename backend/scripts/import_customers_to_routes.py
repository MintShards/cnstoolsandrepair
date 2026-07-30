#!/usr/bin/env python3
"""
Import existing Repair Tracker customers into Route Management.

Why this exists: route management only sees the `businesses` collection, and
the built-in bridge ("Convert to Customer") only goes prospect -> customer.
On a database that already has customers, none of them are visitable —
they have no zones, no routes, and a rep could accidentally re-add one as a
prospect and convert it into a DUPLICATE customer.

This script builds the reverse bridge, idempotently:

  * a customer already linked to a business  -> skipped
  * a customer whose email or company name matches an existing business
                                             -> that business is LINKED
                                                (customer_id set), no duplicate
  * everyone else                            -> a new business is created in an
                                                "Unsorted" zone, linked back via
                                                customer_id, marked warm

Businesses require a zone and a Google Maps link, so imports land in a
top-level "Unsorted" zone (move each into its real zone via Edit Business),
and the maps link is synthesized as a Google Maps search for the customer's
address (falls back to company name).

Usage, from backend/:
  python scripts/import_customers_to_routes.py --dry-run   # preview only
  python scripts/import_customers_to_routes.py             # apply

Safe to re-run any time — already-linked customers are skipped, so running it
after new walk-in customers appear in the tracker just picks up the new ones.
"""
import asyncio
import sys
from datetime import datetime
from pathlib import Path
from urllib.parse import quote_plus

sys.path.insert(0, str(Path(__file__).parent.parent))

from motor.motor_asyncio import AsyncIOMotorClient
from app.config import settings

UNSORTED_ZONE_NAME = "Unsorted"


def _maps_link(customer: dict) -> str:
    """A real Google Maps search URL for the customer's address or name."""
    query = (customer.get("address") or "").strip() or (
        f"{(customer.get('company_name') or '').strip()}, BC"
    )
    return f"https://www.google.com/maps/search/?api=1&query={quote_plus(query)}"


def _display_name(customer: dict) -> str:
    company = (customer.get("company_name") or "").strip()
    if company:
        return company
    contact = f"{customer.get('first_name', '')} {customer.get('last_name', '')}".strip()
    return contact or "Unnamed customer"


async def ensure_unsorted_zone(db, apply: bool) -> str:
    existing = await db.zones.find_one({
        "name": {"$regex": f"^{UNSORTED_ZONE_NAME}$", "$options": "i"},
        "parent_id": None,
    })
    if existing:
        return str(existing["_id"])
    if not apply:
        return "(would create)"
    now = datetime.utcnow()
    result = await db.zones.insert_one({
        "name": UNSORTED_ZONE_NAME,
        "description": "Imported repair-tracker customers — move each into its real zone",
        "parent_id": None,
        "created_at": now,
        "updated_at": now,
    })
    return str(result.inserted_id)


async def import_customers(apply: bool) -> None:
    client = AsyncIOMotorClient(settings.mongodb_url)
    db = client[settings.database_name]
    mode = "APPLY" if apply else "DRY RUN (no writes)"

    print("=" * 64)
    print(f"Repair Tracker customers -> Route Management businesses  [{mode}]")
    print(f"Database: {settings.database_name}")
    print("=" * 64)

    try:
        # Businesses record who created them; imports are attributed to the
        # first admin account (the API sets this from the logged-in user).
        admin = await db.users.find_one({"role": "admin"})
        created_by = str(admin["_id"]) if admin else "import-script"

        zone_id = await ensure_unsorted_zone(db, apply)

        # Every business already linked to some customer.
        linked_customer_ids = set()
        businesses = []
        async for biz in db.businesses.find({}):
            businesses.append(biz)
            if biz.get("customer_id"):
                linked_customer_ids.add(biz["customer_id"])

        by_email = {
            (b.get("email") or "").lower().strip(): b
            for b in businesses if (b.get("email") or "").strip()
        }
        by_name = {
            (b.get("company_name") or "").lower().strip(): b
            for b in businesses if (b.get("company_name") or "").strip()
        }

        created, linked, skipped = 0, 0, 0
        no_address = []
        now = datetime.utcnow()

        async for customer in db.customers.find({}).sort("created_at", 1):
            cid = str(customer["_id"])
            name = _display_name(customer)

            if cid in linked_customer_ids:
                skipped += 1
                print(f"  = {name:40s} already in route management")
                continue

            email = (customer.get("email") or "").lower().strip()
            match = (email and by_email.get(email)) or by_name.get(name.lower())
            if match is not None:
                if match.get("customer_id"):
                    # Matches a business that belongs to a DIFFERENT customer —
                    # ambiguous, leave it for a human.
                    skipped += 1
                    print(f"  ! {name:40s} matches a business linked to another customer — review manually")
                    continue
                linked += 1
                print(f"  ~ {name:40s} linked to existing business record")
                if apply:
                    await db.businesses.update_one(
                        {"_id": match["_id"]},
                        {"$set": {"customer_id": cid, "updated_at": now}},
                    )
                continue

            created += 1
            has_address = bool((customer.get("address") or "").strip())
            if not has_address:
                no_address.append(name)
            note = "" if has_address else "  (no address — maps link is a name search)"
            print(f"  + {name:40s} new business in '{UNSORTED_ZONE_NAME}'{note}")
            if apply:
                await db.businesses.insert_one({
                    "company_name": name,
                    "google_maps_link": _maps_link(customer),
                    "zone_ids": [zone_id],
                    "contact_first_name": (customer.get("first_name") or "").strip() or None,
                    "contact_last_name": (customer.get("last_name") or "").strip() or None,
                    "phone": customer.get("phone"),
                    "email": email or None,
                    "address": customer.get("address"),
                    "notes": customer.get("customer_notes"),
                    "interest_level": "warm",
                    "customer_id": cid,
                    "visit_count": 0,
                    "last_visited_at": None,
                    "created_by": created_by,
                    "created_at": now,
                    "updated_at": now,
                })

        print("-" * 64)
        print(f"  {created} to create, {linked} to link, {skipped} skipped"
              + ("" if apply else "  (dry run — nothing written)"))
        if no_address:
            print(f"\n  ⚠ {len(no_address)} imported without an address — their maps link is a")
            print("    company-name search. Add the address (Edit Business) to make")
            print("    navigation and multi-stop routing precise:")
            for n in no_address:
                print(f"      - {n}")
        if apply and created:
            print(f"\nNext step: open Zones → {UNSORTED_ZONE_NAME} businesses via the")
            print("Businesses tab zone filter and move each into its real zone.")
    finally:
        client.close()


if __name__ == "__main__":
    asyncio.run(import_customers(apply="--dry-run" not in sys.argv))
