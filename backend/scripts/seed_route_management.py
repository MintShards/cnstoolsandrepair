#!/usr/bin/env python3
"""
Route Management sample data seeder.

Fills zones / businesses / visits / routes with a realistic-looking data set so
the Route Management screens can be reviewed with something more than a couple
of rows in them.

Everything it writes is tagged with `_seed: "route-mgmt-sample"`, so `--reset`
can remove exactly what this script created and nothing else. Real records are
never touched.

All company names, contacts, phone numbers and emails are invented. Phone
numbers use the 555 range and emails use example.com, both reserved for
fictional use, so nothing here can reach a real person.

Usage (from the backend/ directory):

    python scripts/seed_route_management.py            # add sample data
    python scripts/seed_route_management.py --reset    # remove it again
    python scripts/seed_route_management.py --yes      # skip the confirmation

The target database is whatever DATABASE_NAME in your .env points at — the
script prints it and asks before writing.
"""
import argparse
import asyncio
import random
import sys
import urllib.parse
from datetime import datetime, timedelta
from pathlib import Path
from zoneinfo import ZoneInfo

sys.path.insert(0, str(Path(__file__).parent.parent))

from bson import ObjectId  # noqa: E402
from motor.motor_asyncio import AsyncIOMotorClient  # noqa: E402
from app.config import settings  # noqa: E402

SEED_TAG = "route-mgmt-sample"
PACIFIC = ZoneInfo("America/Vancouver")

# Deterministic: re-running produces the same data set.
rng = random.Random(20260728)

ZONES = [
    ("Surrey", "Newton, Whalley and Cloverdale industrial parks"),
    ("Langley", "Gloucester and Port Kells light industrial"),
    ("Delta", "Annacis Island and Tilbury"),
    ("Richmond", "Bridgeport and Mitchell Island"),
    ("Burnaby", "Big Bend and Still Creek"),
    ("Abbotsford", "Sumas Way corridor"),
]

# Name pools — combined into plainly invented company names.
PREFIX = [
    "Ironline", "Northpoint", "Cascade Ridge", "Blue Harbour", "Redstone",
    "Silverpine", "Kestrel", "Grantham", "Westbourne", "Copper Creek",
    "Halden", "Marnoch", "Bridgewater", "Ashcroft", "Tallow Bay",
    "Verdant", "Kingsmill", "Rockfield", "Oakhaven", "Stormpoint",
]
TRADE = [
    "Diesel", "Fabrication", "Machine", "Hydraulics", "Fleet",
    "Marine", "Aerospace", "Mining Supply", "Millwright", "Pneumatics",
    "Welding", "Truck & Trailer", "Equipment", "Industrial", "Toolworks",
]
SUFFIX = ["Ltd.", "Inc.", "Works", "Services", "Group", "Co.", "Systems"]

STREETS = [
    "128 St", "192 St", "Annacis Pkwy", "Mitchell Rd", "Still Creek Ave",
    "Sumas Way", "Fraser Hwy", "River Rd", "Bridgeport Rd", "80 Ave",
    "Golden Ears Way", "Cliveden Ave", "Boundary Rd", "Production Way",
]
FIRST_NAMES = [
    "Dave", "Priya", "Marco", "Janelle", "Tomas", "Aiko", "Reg", "Bianca",
    "Hardeep", "Colin", "Renee", "Miguel", "Sandra", "Wes", "Ingrid", "Omar",
]
LAST_NAMES = [
    "Whitfield", "Kaur", "Bergeron", "Osei", "Lindqvist", "Tanaka", "Moro",
    "Delacroix", "Sandhu", "Fairbanks", "Nakamura", "Reyes", "Holloway", "Ives",
]

VISIT_NOTES = [
    "Front desk only — shop supervisor was on the floor, try mid-morning next time.",
    "Walked the shop. Six air ratchets and two impact guns out of service.",
    "They currently send everything to a shop in Coquitlam. Turnaround is their pain point.",
    "Left a card and the rate sheet. Asked for a quote on rebuild vs replace.",
    "Maintenance lead wants a quarterly service arrangement. Worth a follow-up.",
    "Not interested right now — just signed with someone else for the year.",
    "Busy season, asked us to come back after the shutdown.",
    "Good conversation. They have a lot of older pneumatic tooling.",
    "Purchasing handles all vendors — need to get on the approved list first.",
    "Showed them the loaner programme. That was the part they liked.",
    "Two dead grinders in the corner they'd written off. Offered to look at them.",
    "New shop foreman started last month, rebuilding their vendor list.",
]
FOLLOW_UP_NOTES = [
    "Send the rebuild quote",
    "Call the maintenance lead",
    "Drop off rate sheet",
    "Check back after shutdown",
    "Follow up on approved vendor list",
    "Bring loaner tool sample",
]
ROUTE_NAMES = [
    "Newton run", "Port Kells loop", "Annacis morning", "Mitchell Island",
    "Big Bend circuit", "Sumas corridor", "Cloverdale drop-ins", "Bridgeport calls",
]


def maps_link(address: str) -> str:
    return "https://maps.google.com/?q=" + urllib.parse.quote(address)


def pacific_today() -> datetime:
    return datetime.now(PACIFIC).date()


def utc_naive(days_ago: int, hour: int, minute: int) -> datetime:
    """Match how the app stores timestamps: naive UTC."""
    local = datetime.now(PACIFIC).replace(hour=hour, minute=minute, second=0, microsecond=0)
    local -= timedelta(days=days_ago)
    return local.astimezone(ZoneInfo("UTC")).replace(tzinfo=None)


async def reset(db) -> None:
    total = 0
    for name in ("zones", "businesses", "visits", "routes", "customers"):
        res = await db[name].delete_many({"_seed": SEED_TAG})
        if res.deleted_count:
            print(f"  removed {res.deleted_count:>4} from {name}")
        total += res.deleted_count
    print(f"\n✅ Removed {total} sample records. Real data untouched.")


async def seed(db) -> None:
    now = datetime.utcnow()

    # ---- Sales reps: use the accounts that already exist ------------------
    reps = await db.users.find({"role": {"$in": ["sales", "admin"]}}).to_list(length=50)
    if not reps:
        print("❌ No users found. Create an admin or sales rep first.")
        return
    rep_ids = [str(r["_id"]) for r in reps]
    sales_reps = [str(r["_id"]) for r in reps if r.get("role") == "sales"] or rep_ids
    print(f"  using {len(reps)} existing user(s) as visit/route owners")
    creator = rep_ids[0]

    # ---- Zones ------------------------------------------------------------
    zone_ids: dict[str, str] = {}
    created_zones = 0
    for name, description in ZONES:
        # Reuse a zone that already exists rather than creating a duplicate —
        # and leave it untagged, so --reset won't delete the user's own zone.
        existing = await db.zones.find_one({"name": {"$regex": f"^{name}$", "$options": "i"}})
        if existing:
            zone_ids[name] = str(existing["_id"])
            continue
        res = await db.zones.insert_one({
            "name": name, "description": description,
            "created_at": now, "updated_at": now, "_seed": SEED_TAG,
        })
        zone_ids[name] = str(res.inserted_id)
        created_zones += 1
    print(f"  zones:      {created_zones} new, {len(zone_ids) - created_zones} existing reused")

    # ---- Businesses -------------------------------------------------------
    used_names: set[str] = set()
    business_docs = []
    for _ in range(48):
        for _attempt in range(20):
            name = f"{rng.choice(PREFIX)} {rng.choice(TRADE)} {rng.choice(SUFFIX)}"
            if name not in used_names:
                used_names.add(name)
                break
        else:
            continue

        zone_name = rng.choice(list(zone_ids))
        # Roughly a fifth sit in two zones — boundary shops worked from either side.
        biz_zones = [zone_ids[zone_name]]
        if rng.random() < 0.2:
            other = rng.choice([z for z in zone_ids if z != zone_name])
            biz_zones.append(zone_ids[other])
        street_no = rng.randrange(1200, 19900)
        address = f"{street_no} {rng.choice(STREETS)}, {zone_name}, BC"
        # Weighted so most prospects are cold, as they would be in reality.
        interest = rng.choices(["cold", "warm", "hot"], weights=[6, 3, 2])[0]
        has_contact = rng.random() > 0.15

        doc = {
            "company_name": name,
            "google_maps_link": maps_link(address),
            "zone_ids": biz_zones,
            "contact_first_name": rng.choice(FIRST_NAMES) if has_contact else None,
            "contact_last_name": rng.choice(LAST_NAMES) if has_contact else None,
            # 555 numbers are reserved for fictional use.
            "phone": f"{rng.choice(['604', '778'])}-555-{rng.randrange(100, 999):03d}{rng.randrange(0, 9)}"
                     if has_contact else None,
            "email": None,
            "address": address,
            "notes": None,
            "interest_level": interest,
            "last_visited_at": None,
            "visit_count": 0,
            "customer_id": None,
            "created_by": creator,
            "created_at": now - timedelta(days=rng.randrange(30, 200)),
            "updated_at": now,
            "_seed": SEED_TAG,
        }
        if has_contact:
            slug = name.split()[0].lower()
            doc["email"] = f"shop@{slug}-example.com"
        business_docs.append(doc)

    res = await db.businesses.insert_many(business_docs)
    business_ids = [str(i) for i in res.inserted_ids]
    for doc, bid in zip(business_docs, business_ids):
        doc["_id"] = bid
    print(f"  businesses: {len(business_ids)}")

    # ---- Visits (drives visit_count / last_visited_at) --------------------
    visited = business_docs[:32]          # leave the rest never-visited
    visit_docs = []
    overdue_left, upcoming_left = 5, 7
    today = pacific_today()

    for biz in visited:
        for _ in range(rng.randrange(1, 5)):
            days_ago = rng.randrange(1, 150)
            visited_at = utc_naive(days_ago, rng.randrange(8, 16), rng.choice([0, 15, 30, 45]))
            follow_up_date = None
            follow_up_note = None
            if overdue_left and rng.random() < 0.10:
                follow_up_date = (today - timedelta(days=rng.randrange(2, 25))).isoformat()
                follow_up_note = rng.choice(FOLLOW_UP_NOTES)
                overdue_left -= 1
            elif upcoming_left and rng.random() < 0.14:
                follow_up_date = (today + timedelta(days=rng.randrange(1, 21))).isoformat()
                follow_up_note = rng.choice(FOLLOW_UP_NOTES)
                upcoming_left -= 1

            visit_docs.append({
                "business_id": biz["_id"],
                "route_id": None,
                "rep_id": rng.choice(sales_reps),
                "notes": rng.choice(VISIT_NOTES),
                "interest_level": biz["interest_level"],
                "follow_up_date": follow_up_date,
                "follow_up_note": follow_up_note,
                "visited_at": visited_at,
                "_seed": SEED_TAG,
            })

    await db.visits.insert_many(visit_docs)

    # Keep the denormalised counters on each business consistent with the visits.
    for biz in visited:
        mine = [v for v in visit_docs if v["business_id"] == biz["_id"]]
        await db.businesses.update_one(
            {"_id": ObjectId(biz["_id"])},
            {"$set": {
                "visit_count": len(mine),
                "last_visited_at": max(v["visited_at"] for v in mine),
            }},
        )
    print(f"  visits:     {len(visit_docs)} "
          f"({5 - overdue_left} overdue follow-ups, {7 - upcoming_left} upcoming)")

    # ---- Routes: past (done), today (in progress), upcoming (untouched) ---
    # A business in two zones is a candidate for routes in either.
    by_zone: dict[str, list[dict]] = {}
    for biz in business_docs:
        for zid in biz["zone_ids"]:
            by_zone.setdefault(zid, []).append(biz)

    route_docs = []

    def build_stops(zone_id: str, count: int, completed: int):
        pool = by_zone.get(zone_id, [])
        picked = rng.sample(pool, min(count, len(pool)))
        stops = []
        for i, b in enumerate(picked):
            done = i < completed
            stops.append({
                "business_id": b["_id"],
                "order": i,
                "completed": done,
                "completed_at": utc_naive(0, 9 + i, 0) if done else None,
            })
        return stops

    zone_list = list(zone_ids.values())

    # Past routes — finished
    for n in range(8):
        zid = rng.choice(zone_list)
        days_ago = rng.randrange(3, 40)
        count = rng.randrange(4, 8)
        route_docs.append({
            "name": rng.choice(ROUTE_NAMES),
            "date": (today - timedelta(days=days_ago)).isoformat(),
            "zone_id": zid,
            "stops": build_stops(zid, count, count),
            "assigned_to": rng.choice(sales_reps),
            "created_by": creator,
            "created_at": now - timedelta(days=days_ago + 1),
            "updated_at": now - timedelta(days=days_ago),
            "_seed": SEED_TAG,
        })

    # Today — one per sales rep, part-way through
    for rep in sales_reps:
        zid = rng.choice(zone_list)
        count = rng.randrange(5, 8)
        route_docs.append({
            "name": rng.choice(ROUTE_NAMES),
            "date": today.isoformat(),
            "zone_id": zid,
            "stops": build_stops(zid, count, rng.randrange(1, count - 1)),
            "assigned_to": rep,
            "created_by": creator,
            "created_at": now - timedelta(days=1),
            "updated_at": now,
            "_seed": SEED_TAG,
        })

    # Upcoming — nothing done yet
    for n in range(4):
        zid = rng.choice(zone_list)
        route_docs.append({
            "name": rng.choice(ROUTE_NAMES),
            "date": (today + timedelta(days=rng.randrange(1, 14))).isoformat(),
            "zone_id": zid,
            "stops": build_stops(zid, rng.randrange(4, 8), 0),
            "assigned_to": rng.choice(sales_reps),
            "created_by": creator,
            "created_at": now,
            "updated_at": now,
            "_seed": SEED_TAG,
        })

    await db.routes.insert_many(route_docs)
    print(f"  routes:     {len(route_docs)} (8 past, {len(sales_reps)} today, 4 upcoming)")

    # ---- A few conversions so the Status column shows both states ---------
    converted = 0
    for biz in rng.sample(visited, 6):
        cust = await db.customers.insert_one({
            "first_name": biz["contact_first_name"] or "Shop",
            "last_name": biz["contact_last_name"] or "Contact",
            "company_name": biz["company_name"],
            "email": biz["email"],
            "phone": biz["phone"],
            "address": biz["address"],
            "customer_notes": "Converted from a route management prospect.",
            "created_at": now,
            "updated_at": now,
            "_seed": SEED_TAG,
        })
        await db.businesses.update_one(
            {"_id": ObjectId(biz["_id"])},
            {"$set": {"customer_id": str(cust.inserted_id), "updated_at": now}},
        )
        converted += 1
    print(f"  customers:  {converted} converted from prospects")

    print("\n✅ Sample data seeded. Undo any time with --reset.")


async def main() -> int:
    parser = argparse.ArgumentParser(description="Seed Route Management sample data")
    parser.add_argument("--reset", action="store_true", help="remove previously seeded sample data")
    parser.add_argument("--yes", action="store_true", help="skip the confirmation prompt")
    args = parser.parse_args()

    action = "REMOVE sample data from" if args.reset else "ADD sample data to"
    print("=" * 62)
    print("CNS Tool Repair — Route Management sample data")
    print("=" * 62)
    print(f"\nAbout to {action}:")
    print(f"  database: {settings.database_name}")
    print(f"  cluster:  {settings.mongodb_url.split('@')[-1].split('/')[0]}")
    print()

    if not args.yes:
        if input("Type 'yes' to continue: ").strip().lower() != "yes":
            print("Aborted — nothing was changed.")
            return 1

    client = AsyncIOMotorClient(settings.mongodb_url)
    db = client[settings.database_name]
    try:
        await db.command("ping")
        print()
        if args.reset:
            await reset(db)
        else:
            existing = await db.businesses.count_documents({"_seed": SEED_TAG})
            if existing:
                print(f"⚠️  {existing} sample businesses already exist.")
                print("   Run with --reset first to avoid duplicates.")
                return 1
            await seed(db)
        return 0
    except Exception as exc:
        print(f"❌ {type(exc).__name__}: {exc}")
        return 1
    finally:
        client.close()


if __name__ == "__main__":
    sys.exit(asyncio.run(main()))
