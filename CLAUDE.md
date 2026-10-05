# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## ⚠️ Security Notice
**IMPORTANT:** Never include real MongoDB credentials, Resend API keys, passwords, or tokens in this file. All credentials are in `backend/.env` (gitignored).

## Project Overview

**CNS Tool Repair** - B2B industrial pneumatic tool repair website for Surrey, BC
- **Stack**: FARM (FastAPI + React + MongoDB)
- **Architecture**: Backend API + Frontend SPA
- **Business Model**: Local on-site service (customers bring tools for diagnosis)
- **Target**: Mid to large industrial businesses (10 sectors: Automotive, Fleet, Manufacturing, Metal Fabrication, Construction, Oil & Gas, Aerospace, Marine, Mining, MRO)
- **Current Phase**: Development with MongoDB Atlas (cloud database)

## Quick Start

### One command, both servers, in the background
```bash
./dev.sh start     # backend :8000 + frontend :5173, terminal stays free
./dev.sh status    # also: logs · restart · stop
```
(Requires the one-time backend venv + frontend npm install below.)

### Backend (FastAPI)
```bash
cd backend
python3 -m venv venv && source venv/bin/activate
pip install -r requirements.txt
cp .env.example .env  # Edit with MongoDB Atlas credentials

# WSL CRITICAL: Must bind to 0.0.0.0 for Windows browser access
python3 -m uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

### Frontend (React + Vite)
```bash
cd frontend
npm install
npm run dev       # Dev server on :5173
npm run lint      # ESLint check
npm run lint:fix  # ESLint auto-fix
npm run build     # Production build to dist/
```

### MongoDB Atlas
- Cloud database (no local MongoDB needed)
- Connection string in `backend/.env`
- Dev DB: `cnstoolsandrepair_db_dev`
- View via MongoDB Compass

## Architecture

### Request Flow
Client → React SPA → Axios (`api.js`) → FastAPI routers → MongoDB Atlas → Resend (email)

### Backend (FastAPI)
- **Async-first** using Motor driver (all DB ops use `await`)
- **Structure**: `app/main.py` (FastAPI app) → `routers/` (API endpoints) → `services/` (business logic) → `database.py` (MongoDB connection)
- **Logging**: `app/logging_config.py` — JSON in production, human-readable in dev. All modules use `logging.getLogger(__name__)`. Never use `print()`.
- **Key patterns**:
  - ObjectId conversion: `convert_objectid_to_str()` + rename `_id` to `id` before returning to frontend
  - File uploads: `multipart/form-data` with `UploadFile`, saved to `uploads/` with UUID filenames
  - Email: Non-blocking Resend notifications (don't block quote creation)
  - Email senders: `request@cnstoolrepair.com` (display: "Request") for repair requests, `message@cnstoolrepair.com` (display: "Message") for contact form, `purchasing@cnstoolrepair.com` (display: "CNS Tool Repair Purchasing") for parts sourcing emails, `sales@cnstoolrepair.com` (display: "CNS Tool Repair Sales") for Tools for Sale quote requests. Reply-To is always set to customer email.
  - Middleware: Request logging, CORS, static file serving (`/uploads`)

### Frontend (React)
- **React Router v6** with component-based architecture
- **State**: ThemeContext (dark mode), SettingsContext (business settings)
- **Forms**: React Hook Form with collapsible multi-tool quote form, auto-capitalization on inputs
- **Design**: Tailwind CSS, Russo One logo font, Montserrat body, Material Symbols icons
- **Colors**: Primary blue #1152d4, Accent orange #FF2400 (fails WCAG contrast as small text on white — pair as `text-red-700 dark:text-accent-orange` for small labels)
- **SEO**: react-helmet-async, sitemap.xml, robots.txt, Open Graph tags, structured data
- **Vite**: Proxies `/api` and `/uploads` to backend (no CORS issues in dev)
- **Key components**:
  - `Quote.jsx` - Multi-tool form with collapsible tool entries (default 1 tool shown)
  - `AdminSettings.jsx` - Tabbed interface for content management
  - Route redirects: `/quote` → `/repair-request`, `/tools` → `/services`

### Database Schema
```javascript
// quotes - Customer quote requests with multi-tool support and photos
{
  request_number: "REQ-2026-0001",  // Auto-generated via atomic counter
  company_name: string | null,
  first_name: string,
  last_name: string,
  email: string,
  phone: string,  // Format: ###-###-####
  tools: [{
    tool_type: string,       // Auto-capitalized
    tool_brand: string,      // Auto-capitalized
    tool_model: string,      // Auto-capitalized
    quantity: number,
    problem_description: string
  }],
  photos: [string],  // Array of /uploads/quotes/{uuid}.ext
  status: "pending" | "in_progress" | "completed",
  created_at: datetime,
  updated_at: datetime
}

// repairs - Full repair job lifecycle (source: online_request|drop_off|phone_in|email)
//           Per-tool accounting fields: diagnostics[{id, diagnosis, solution, parts, code, customer_explanation}], extra_charges[{description, amount}],
//           invoiced_amount (pre-tax Zoho figure), labour_cost_override (flat $ for the tool), tax_status (taxable|pst_exempt|tax_exempt)
// technicians - Staff/technician directory
// suppliers - Parts supplier directory

// Parts Library (3-level hierarchy):
// library_brands → library_models → library_parts
// compat_groups - Cross-brand interchangeable part compatibility groupings

// tools_catalog - Repairable tools (categorized: air_tools, electric_tools, lifting_equipment)
// products - Tools we SELL, shown on /products (air_tools|hydraulic|lifting).
//            Deliberately separate from tools_catalog (tools we REPAIR).
// product_quotes - Quote requests from /products (PQ-YYYY-XXXX, no prices)
// brands - Brand logos for carousel (has 'authorized' field for classification)
// industries_page_content - Industries page content (singleton document with hero + industries array)
// camera_intake_config - Hathorn camera option lists (singleton: included_options, condition_options,
//                        final_checklist). Edited in Admin Settings → Camera Intake; the repairs
//                        router re-reads final_checklist on every status change (Ready gate).
// diagnosis_codes - Internal library of common tool problems (HJ-03): tool_type (or GENERAL), prefix, number,
//                   title (symptom), likely_causes[], technician_checks[], solution, parts[{name, quantity}],
//                   quote_note, active. Admin Settings → Diagnosis Codes; applied from the tracker's finding editor.
// bills - Supplier bills & receipts (money OUT; Workspace → Cash Flow, admin only)
// payments - Customer payments on Zoho invoices, entered by hand (money IN; admin only)
// settings - Business settings (singleton document)
// gallery - Photo gallery
// users - Admin authentication
// counters - Atomic counters for request number generation
// sourcing_logs - Parts sourcing history and email logs
// service_agreement - Service agreement terms (singleton document)
```

## Critical Patterns

### MongoDB ObjectId Handling (CRITICAL)
```python
# MUST convert _id to string AND rename to id
created_quote = await db.quotes.find_one({"_id": result.inserted_id})
created_quote = convert_objectid_to_str(created_quote)
created_quote["id"] = created_quote.pop("_id")
return QuoteResponse(**created_quote)
```

### Multi-Tool Quote System
```python
# Quote now supports multiple tools with auto-capitalization
tools_data = json.loads(tools)  # Parse JSON array from form
tool_entries = [ToolEntry(**tool) for tool in tools_data]

# ToolEntry model auto-capitalizes tool_type, tool_brand, tool_model
class ToolEntry(BaseModel):
    tool_type: str = Field(..., min_length=1)
    tool_brand: str = Field(..., min_length=1)
    tool_model: str = Field(..., min_length=1)
    quantity: int = Field(gt=0)
    problem_description: str = Field(..., min_length=10)

    @field_validator('tool_type', 'tool_brand', 'tool_model', mode='before')
    def capitalize_fields(cls, v):
        if v: return v.strip().title()
        return v
```

### Request Number Generation (ATOMIC)
```python
# Atomic counter using MongoDB findOneAndUpdate for thread safety
request_number = await get_next_request_number()  # Returns "REQ-YYYY-XXXX"

# Backend: app/database.py:get_next_request_number()
# Uses counters collection with atomic increment
# Format: REQ-2026-0001, REQ-2026-0002, etc. (resets yearly)
```

### Tools API Route Order (CRITICAL)
```python
# /by-category MUST be defined BEFORE /{id} to avoid matching "by-category" as an ID
@router.get("/by-category")  # Returns {"air_tools": [...], "electric_tools": [...], ...}
@router.get("/{id}")
```

### Repair Job Lifecycle
```python
# RepairStatus enum (13 states):
# received → diagnosed → quoted → approved → parts_pending →
# in_repair → ready → invoiced → completed
# (also: declined, beyond_economical_repair, abandoned, closed)

# ALLOWED_TRANSITIONS (source: backend/app/models/repair.py):
#   received      → diagnosed, abandoned
#   diagnosed     → quoted, beyond_economical_repair, received, abandoned
#   quoted        → approved, declined, diagnosed, abandoned
#   approved      → parts_pending, in_repair, quoted, abandoned
#   declined      → closed, abandoned
#   beyond_economical_repair → closed, quoted, abandoned
#   parts_pending → in_repair, quoted, approved, abandoned
#   in_repair     → ready, parts_pending, approved, abandoned
#   ready         → invoiced, in_repair, abandoned
#   invoiced      → completed, ready, abandoned
#   completed     → closed
#   abandoned     → closed
#   closed        → (none)

# RepairSource enum: online_request | drop_off | phone_in | email
# Priority enum: standard | rush | urgent
# PartStatus enum: pending | ordered | in_stock | received | installed

# PartItem includes order tracking:
# { name, part_number, quantity, price, supplier,
#   order_link, order_date, eta, date_received,
#   tracking, library_part_id, needs_sourcing, sourcing_emailed,
#   notes, status (PartStatus) }
```

Repairs router (`routers/repairs.py`) supports server-side pagination with filters, batch status updates, and work order generation.

**Status gates** (enforced in BOTH the single and batch status routes): a Hathorn tool can't reach `ready` until the configured final checklist is ticked (`hathorn_ready_blockers`); ANY tool can't reach `quoted` without `zoho_quote_number` or `invoiced` without `zoho_invoice_number` (`zoho_number_blocker` + `ZOHO_NUMBER_FIELDS` in models/repair.py — Zoho Books owns quotes and invoices, the tracker only records their numbers, and they're different numbers). The number may be sent with the status change itself (`ToolStatusUpdate` / `BatchStatusItem` carry optional `zoho_*_number`); the WorkOrderDialog's status and Update-All modals prompt for it. The legacy per-tool `zoho_ref` was split into those two fields by `scripts/migrate_zoho_ref.py` (dry run by default, `--apply` to write).

### Work Order Number Generation (ATOMIC)
```python
# Repair jobs get WO-YYYY-XXXX numbers (separate counter from REQ-YYYY-XXXX)
work_order_number = await get_next_work_order_number()  # Returns "WO-2026-0001"

# Backend: app/database.py:get_next_work_order_number()
# Uses counters collection with atomic increment (separate from request counter)
# Format: WO-2026-0001, WO-2026-0002, etc. (resets yearly)
```

### Parts Library (3-Level Hierarchy)
```
library_brands → library_models → library_parts
```
- `CompatGroup` links parts across brands (cross-brand interchangeable parts)
- `/api/parts-library/compatible-parts/{model_id}` returns parts that fit a model, including cross-brand matches
- Route order rule applies here too: specific paths before `/{id}` parameterized routes
- Models support diagram image uploads
- **Deleting a model retires its name.** The delete is a soft delete (`active: false`, refused while parts are still attached). For that brand the name is then *retired*: `GET /api/repairs/models` (the tool form's past-job suggestions) drops it via `_retired_model_names` (unless an active model with the same name exists again), and `syncPartsToLibrary` lists models with `active_only=false` and never re-creates an inactive match — a job that still names it saves with its parts unattached. Adding the model back in the library is the one way to bring it back. The tool form refetches library + past-job suggestions when a model field gets focus (`refreshModelSuggestions`), so a deletion in another tab shows at once.
- **One part, many models, any brand.** A part is ONE inventory record (`part_number` unique per brand, one `quantity_on_hand`) whose `model_ids` may span brands; `brand_id` only says whose numbering the part uses. `LibraryPartResponse.models[]` carries `{id, name, brand_id, brand_name, component}` per fit (`model_names` kept for older readers). Fits change through `POST/DELETE /api/parts-library/parts/{id}/models/{model_id}` (`$addToSet` / `$pull`). Creating a number that already exists under the brand returns **409** with `detail: {message, existing_part}` so `PartFormModal` can offer "Use the existing part" (attaches it to the chosen models) instead of a twin with its own stock — never work around a duplicate with `-A/-B` suffixes. The part form has a "Fits Models" picker across brands (`searchModels`), a model's Parts view an "Add existing" button (`AttachExistingPartModal`), and deleting a part listed under several models asks remove-from-this-model vs delete (`RemovePartModal`). `syncPartsToLibrary` (ToolForm) links a 409's existing part and attaches the job's models to every library-linked part not yet listed under them, so the library learns fits from jobs; it resolves to the indexes of the tools whose parts got a `library_part_id`, and every save path (edit tool, Parts dialog, add tool, new-job wizard) goes through `linkSavedPartsToLibrary(jobId, toolIds, forms)`, which runs the sync in the background and then writes those ids back to the job with a parts-only `updateTool` (the sync used to mutate a discarded form, so typed parts never became library-linked). `apiDetailMessage(err)` reads a string or `{message}` detail.

### Parts Sourcing System
- Router: `routers/sourcing.py` (prefix: `/api/parts-sourcing`)
- Service: `services/sourcing_email_service.py`
- Model: `models/sourcing_request.py`
- Workflow: Parts with `needs_sourcing=True` appear in the sourcing queue. Admin can send bulk supplier emails via Resend, which sets `sourcing_emailed=True` on each part. History stored in `sourcing_logs`.
- Sourcing email template is configurable via admin settings (`business_settings.sourcingEmailTemplate`)

### Service Agreement System
- Router: `routers/service_agreement.py` (prefix: `/api/service-agreement`)
- Public `GET /api/service-agreement/` returns current terms; admin `PUT /api/service-agreement/` updates them
- Stores: warranty terms, air supply requirements, general service terms
- Single document in `service_agreement` collection
- Used by `PrintWorkOrder.jsx` to print terms on work orders

### Hathorn Camera Intake (Repair Tracker)
- Trigger: tool brand matches `/hathorn/i` (hardcoded). A Hathorn tool hides the generic Model Number + Serial Number fields; identity lives on three component pairs — `camera_head_model/_serial`, `controller_model/_serial`, `reel_model/_serial` — because customers bring any mix (reel only, head only…). Backend `require_identity` validator: non-Hathorn needs `model_number`; Hathorn needs ≥1 component field.
- Option lists (Included With Unit, Condition At Intake, Final Test Checklist) come from `camera_intake_config` via `GET/PUT /api/camera-intake-config/` (staff read / admin write), edited in Admin Settings → Camera Intake. Frontend caches one fetch per page load (`utils/cameraIntake.js`); defaults live in `app/models/camera_intake.py` + mirrored in that util.
- Ready gate: a Hathorn tool can't move to `ready` until every configured final-checklist item is ticked (`hathorn_ready_blockers` in models/repair.py; enforced in single + batch status routes, list re-read from DB per request). Empty configured list = gate off.
- Parts library: component models are matched/auto-created as library models (`syncPartsToLibrary`), suggested parts merge across all filled component models, and `model-repair-counts` credits each component model. `toolDisplayTitle()` (ToolForm) renders titles when `model_number` is null.
- Library models carry `component` (`camera_head | controller | reel`, `MODEL_COMPONENTS` + `validate_component` in `models/parts_library.py`; null for every other brand). The Parts Library model form (`PartsLibraryTab.jsx::ModelFormModal`) requires it when the brand matches `/hathorn/i` (`isHathornBrand`) and defaults the category to DRAIN CAMERA; Hathorn model cards show the component badge or an amber "Component not set", and the Models view gets filter chips (Camera heads / Controllers / Reels / Component not set) so untagged models from before the field existed can be tagged via Edit. ToolForm's three component dropdowns merge the past-job values for that field with the library models tagged as that component (`componentOptions`), and `syncPartsToLibrary` creates component models with their tag and stamps it on an untagged existing match (best effort).
- Other Hathorn fields: rod lengths (received/cut/remaining), odometer in/out (`counter_at_intake/_after_repair`), all printed on the tool tag + work order. Serial-history (`GET /api/repairs/serial-history`) matches component serials for returning-unit badges.

### Tool History (returning units)
- A tool that has been on the bench before is recognised by serial: `GET /api/repairs/serial-history?serials=…&brand=…&exclude_job=…` matches the general serial and the three Hathorn component serials (house serials are stamped on unserialized tools at intake, so a serial match is a **confirmed** visit). `detail=true` adds what was done on each visit — `remarks`, `diagnostics`, `parts`, `labour_hours`, `assigned_technician`, `warranty`, and `invoiced_amount` for admins only — and lifts the cap to 50. With `models=` (comma list of the tool's model numbers) plus a customer identifier (`customer_id` / `company` / `email`), the same customer's earlier tools of that brand and model that did NOT match a serial come back separately as `possible` (jobs from before house serials, mistyped serials). Response: `{matches, possible}`, each row with `match: serial | customer_model`.
- Frontend: `utils/toolHistory.js` — `fetchToolHistory(tool, who, excludeJobId)` (always detail mode; `who` is the job or the new-job form), `fetchJobHistory(job)` (tool_id → `{count, warranty, matches, possible}`; tools with nothing found are omitted), `repeatSignals(tool, matches)` (same finding code as an earlier visit; a part on this visit already replaced before; a part replaced on ≥2 earlier visits), `visitSummary`, `daysSince`, `WARRANTY_DAYS` (90, the service agreement's 3 months).
- Work order dialog: `returningMap` holds the job's history; the tool card's chip reads "Visit N" (red "Warranty window" when the last completion is within 90 days) and the **History** button (between Parts and Edit; "(N)" confirmed, "(?)" possible-only) opens `shared/ToolHistoryDialog.jsx` — the visit number and warranty clock, the repeat signals, then one card per confirmed visit (work order link that swaps the open job via `?job=`, dates, outcome pill, reported problem, findings with codes, parts, labour, technician, invoiced for admins) and a separate amber "Possibly this unit" group. The intake banner in `ToolForm` (serials typed, or customer + model in the new-job wizard) shows a "Found: … · Parts: …" line per visit and the possible work orders. Print: `openPrintWorkOrder(job, contact, agreement, { history })` adds a Previous Visits block (latest 3) to a returning tool, and `openPrintToolTag(job, tool, idx, { returning })` stamps RETURNING beside WARRANTY; the jobs list, customer profile and new-job print paths fetch the history first.

### Tools for Sale (Products)
- Public page: `/products` (`/tools-for-sale` redirects there). Managed in Admin Settings → Tools for Sale.
- Routers: `routers/products.py` (`/api/products`, admin-guarded writes) and `routers/product_quotes.py` (`/api/product-quotes`)
- **No prices anywhere** — the page is quote-only, so distributor cost stays private and rates can flex by customer. `sku` shows publicly as "Item #".
- `ProductCategory`: `air_tools | hydraulic | lifting` — separate enum from `ToolCategory` (tools we repair)
- Quote requests get `PQ-YYYY-XXXX` via `get_next_product_quote_number()`, rate limited 5/hour, and are **saved before the email** so a mail failure never loses a lead
- Seed/refresh the catalogue: `python scripts/seed_products.py` (`--dry-run`, `--new-only`). Reads `scripts/data/products_seed.json`, matches by SKU so it is safe to re-run; product photos already live in Spaces under `products/`.

### CRUD Pattern
- **GET /** - List all (with `active_only` param)
- **POST /** - Create (tools require `category` field)
- **GET /{id}** - Get by ID
- **PUT /{id}** - Update (partial with `exclude_unset=True`)
- **DELETE /{id}** - Soft delete (`active=False`)

### Page Content Pattern (Singleton Documents)
- **GET/PUT /api/home-content/** - HomePage sections (hero, quick facts, testimonials, etc.)
- **GET/PUT /api/industries-content/** - IndustriesPage (hero + industries array with tool badges)
- Single document per collection, `upsert=True` for updates
- Frontend fetches with fallback to `config/business.js`

## Environment Variables

### Backend (`backend/.env`)
```env
MONGODB_URL=mongodb+srv://<user>:<pass>@<cluster>.mongodb.net/<db>?retryWrites=true&w=majority&tls=true
DATABASE_NAME=cnstoolsandrepair_db_dev
CORS_ORIGINS=http://localhost:5173,http://localhost:3000
RESEND_API_KEY=<key>
NOTIFICATION_EMAIL=cnstoolrepair@gmail.com
JWT_SECRET_KEY=<generate_with_secrets.token_urlsafe(32)>
JWT_ALGORITHM=HS256
JWT_EXPIRATION_HOURS=8
MAX_FILE_SIZE=10485760
ALLOWED_EXTENSIONS=jpg,jpeg,png,webp,pdf
# Digital Ocean Spaces (set USE_SPACES=true in production)
USE_SPACES=false
SPACES_REGION=nyc3
SPACES_BUCKET=cnstoolsandrepair-photos
SPACES_KEY=<key>
SPACES_SECRET=<secret>
SPACES_ENDPOINT=https://nyc3.digitaloceanspaces.com
# Parts sourcing emails
EMAIL_LOGO_URL=<spaces-url-to-logo>
SOURCING_FROM_EMAIL=purchasing@cnstoolrepair.com
SOURCING_FROM_NAME=CNS Tool Repair Purchasing
```

### Frontend (optional `.env`)
```env
VITE_API_URL=http://localhost:8000
```

## Admin Interface

- **Routes**: `/admin/login`, `/admin/settings`, `/admin/repair-tracker`, `/workspace` + `/workspace/login` (Workspace — staff entrance; `/admin/workspace` redirects there), `/sales/login`, `/sales/dashboard` (all hidden, no nav links)
- **Auth**: JWT-based (email + password), 8-hour expiration, httpOnly cookie
- **Roles**: `admin` (everything) · `staff` (Repair Tracker + Workspace + sales routes; no CMS, no account management) · `technician` (Repair Tracker + Workspace only — no sales area) · `sales` (sales area only, rep-scoped). Backend guards: `require_admin`, `require_staff_or_admin` (staff/technician/admin), `require_sales_or_admin` (sales/staff/admin — NOT technician). Frontend guard: `components/RequireRole.jsx`.
- **User creation**: admins via `python scripts/create_admin.py` or Admin Settings → Users & Accounts (`/admin/settings?tab=users` — one table for all four roles). Admins can switch ANY account to any role, including across the shop/sales boundary, via `PATCH /api/auth/users/{id}/role` (guards: no self-change, last active admin keeps admin). The Workspace has no Staff section — the sidebar's Account pill opens `workspace/AccountModal.jsx` (push notifications for this device + the own-password change); the sales dashboard has no account management.
- **Needs Attention panel** (Workspace → All Tasks, below the board): live to-do queues DERIVED from repair tool statuses + due route follow-ups via `GET /api/repairs/attention` — never stored as task rows, so they can't drift from the tracker. Rows are work orders (multi-tool jobs collapse to one row). Six queues in shop priority order: Ready for pickup (`ready`+`invoiced`), Approved — order parts / start repair (`approved`), Waiting for approval (`quoted`), Stuck (stalled jobs in statuses WITHOUT their own queue — diagnosed/parts_pending/in_repair — so nothing lists twice; displayed queues show stuckness as red ages), Needs diagnosis (`received`), Follow-ups due. Queue rows escalate into real assigned tasks via TaskFormModal's `defaultTitle`/`defaultWorkOrder` props. Stuck = no status change in `business_settings.stale_days` (same threshold as the tracker dashboard). Attention items also carry `contact`/`phone` (rows render tap-to-call links), and every task response with a `repair_id` gets a read-time `job` join — company, contact, phone, tool label, live tool statuses (`_attach_job_context` in routers/tasks.py, never stored) — rendered on task cards, the task list, and the detail modal via `workspace/JobContextLine.jsx`.
- **Activity tracker** (Workspace → Calendar): `GET /api/activity?from&to` (staff, shop-local inclusive dates, ≤400 days) merges who-did-what from the primary records — job creation (`created_by`), tool arrivals + status changes (`status_history[].by`, stamped since 2026-09-13; older entries have no actor), tasks created/completed, customers created, online requests, work-order emails — with the `activity_log` collection, which holds ONLY events that have no record of their own: tool/work-order/customer edits (field diffs via `services/activity_service.py`), deletions, photo add/remove. Never write status changes to activity_log. The calendar shows per-day group chips (received / status / tasks / edits), the day modal lists the log, and the Report button prints Day/Week/Month/Year via `workspace/PrintActivityReport.jsx` (year = summary + month table; the daily log is opt-in past 62 days). The Shop Feed is deliberately excluded (it's communication, not operations).
- **Activity by person** (Workspace → Calendar → People, `workspace/ActivitySection.jsx` switches Calendar / People, `?view=people`): the same events grouped by who did them. `GET /api/activity/people?from&to` returns one card per shop account (admin/staff/technician) with counts (`_PERSON_COUNT_KEYS`: total, jobs_created, tools_received, status_changes, ready, completed, tasks_created, tasks_completed, edits, library, money, admin) and the last action; actors are matched by `user_id`, falling back to the display name for older name-only entries; `unattributed` counts events with no name (admins only). **Visibility: admins see everyone, anyone else only their own card**, and `GET /api/activity?actor=<user_id>` (the person's timeline, the report's Person filter) refuses any other id with 403 for non-admins. Both routes share `_collect_events` with the calendar; kinds starting with `_ADMIN_ONLY_PREFIXES` (`bill_`, `payment_`, `settings_`, `account_`, `password_`) are dropped for non-admins. `workspace/PeopleActivityView.jsx` (cards → timeline paged in the browser with `PaginationBar` like the Cash Flow lists, back to page 1 on a period, person or search change; search, CSV of every matching row via `utils/accounting.js` helpers, print via `openPrintActivityReport({subject})`), the calendar's day modal gets a person select when more than one person acted, `ActivityReportModal` a Person select (`staff` prop). **Now logged too** via `record_activity`: Parts Library changes (`brand_*`, `model_*`, `part_added/edited/retired`, `part_fits_changed`, `stock_adjusted` — group `library`), business settings saves (`settings_changed`, one line per changed top-level key via `_settings_changes` in routers/settings.py), account changes (`account_created/edited/deactivated/reactivated/role_changed`, `password_changed` — `_log_account` in routers/auth.py) and diagnosis codes (`code_added/edited/retired/restored`); groups `library` and `admin` in `constants/activity.js`. Sign-ins are deliberately not logged.
- **Web Push** (staff phones, no messaging app): `frontend/public/sw.js` (push + notificationclick only — NO fetch handler, nothing cached) and `workspace.webmanifest` (start_url `/workspace`, `display: standalone` — required for push on iOS 16.4+, where the Workspace must be added to the Home Screen first). `utils/push.js` swaps the manifest link + adds the home-screen metas while the Workspace is mounted and handles subscribe/unsubscribe; `routers/push.py` (`/api/push/public-key|me|subscribe|test`, staff) stores one row per device in `push_subscriptions` keyed by endpoint. `services/push_service.py::send_push` runs from FastAPI `BackgroundTasks`, is best effort, and prunes endpoints the push service reports gone (404/410). Triggers: task assigned to someone else (create/update), new online repair request (all devices), tool → `ready` (all devices except the actor; the batch route sends ONE summary push). VAPID keys come from `scripts/generate_vapid_keys.py` into `.env` (`VAPID_PUBLIC_KEY`/`VAPID_PRIVATE_KEY`/`VAPID_CLAIMS_EMAIL`); push stays off while they're empty. In production they live in the droplet's root `.env` and reach the container only through the explicit `environment:` list in `docker-compose.prod.yml` — every new backend env var must be added there too, or the container never sees it. `nginx.prod.conf` serves `/sw.js` and `/workspace.webmanifest` with `no-cache` (exact-match locations, outside the 1-year immutable asset rule). Rotating the keys invalidates every device subscription. Payloads carry WO numbers, tool labels and customer/company names only — never phone numbers or emails.
- **Cash Flow** (Workspace → Cash Flow, **admin only**): the shop's money in and out, kept as an operational record — Zoho Books stays the accounting system, and `zoho_bill_number` / `zoho_invoice_number` on these records are cross-references, never gates. The sidebar pill and section are hidden for other roles (`sectionsForRole` in `constants/workspace.js`; a non-admin `?section=cash-flow` lands on My Tasks) and every `/api/bills` and `/api/payments` route is `require_admin`. **Money out = bills** (`bills`, `BILL-YYYY-XXXX`, `models/bill.py`, `routers/bills.py`): supplier bills and counter receipts, with optional lines linked to work orders (`request_number` snapshotted via tasks' `_resolve_repair`, `line_total` computed server-side). Lifecycle `unpaid → paid | disputed | void`, `paid → unpaid` (undo, payment fields cleared and noted), `void → unpaid` (`ALLOWED_BILL_TRANSITIONS`); status moves ONLY through `PATCH /api/bills/{id}/status` and every move is appended to `status_history` (same `{status, timestamp, notes, by}` shape as repair tools). **Overdue is derived** (`unpaid` and `due_date < today`), never stored; void bills are excluded from every count and total; money totals are per-currency maps (CAD/USD are never summed). A receipt paid on the spot is logged straight in as `paid`. Attachments (photo/PDF, ≤10) upload PRIVATE (`bills` is in `PRIVATE_FOLDERS`) and are viewed only through the admin-only `GET /api/bills/{id}/attachments/view?url=` (`stored_file_redirect`, shared with `/api/photos/view`, which is staff-wide and therefore never used for receipts). **Money in = payments** (`payments`, `PAY-YYYY-XXXX`, `models/payment.py`, `routers/payments.py`): what a customer actually paid, entered when the money lands — received-only by design (a waiting invoice stays an `invoiced` tool on the tracker; no second receivable to keep in sync), optional work-order link. Activity tracker: `bill_logged` / `bill_paid` / `bill_status_changed` and `payment_received` are DERIVED from the records inside `list_activity` (admin only — never written to `activity_log`); only `bill_edited` / `bill_deleted` / `payment_edited` / `payment_deleted` go to `activity_log` via `record_activity(bill=… | payment=…)`, and those rows are skipped for non-admins on read, as are the `bills_logged` / `bills_paid` / `payments_received` summary keys. Indexes are script-only: `scripts/create_indexes.py::create_bills_indexes` (bills + payments) — run it after deploying (`docker exec cns-backend-prod python scripts/create_indexes.py --allow-production`). Frontend: `workspace/CashFlowSection.jsx` — its `TabHeader` carries the Money Out / Money In / Profit & Loss / Journal switcher (`?view=`; short labels below `lg` — beside the sidebar rail a tablet's main column is ~460px — and its own row under the title on phones) and the Log a bill / Log a payment button, then ONE "this month" overview card (cells In / Out / Net / Unpaid bills, hairlines drawn by the grid, two by two until `lg`), then the active view, each of which opens with the same `TabHeader` filter-row toolbar (filters left, actions right; `PeriodPicker` drops its dates under the presets when the row is narrow) — never a second row of tiles under the overview; the P&L and Journal figures use `workspace/StatTile.jsx` (`StatTile` + `StatRow`, the five-figure row: 2+2+1 on phones, 3+2 at `lg`, five across from `xl`). Width rule for the lists: the P&L table and one-line journal rows wait for `lg` (narrower columns get the cards / stacked rows), the P&L parts-labour-other breakdown and the journal search beside its chips wait for `xl`. `?chip=` picks the bills list and is what the Unpaid cell, the sidebar overdue alert and the attention link set. The section hosts `BillsView.jsx` (chips Unpaid / Overdue / Disputed / Paid / All, `BillFormModal.jsx`, `BillDetailModal.jsx`) and `PaymentsView.jsx` (`PaymentFormModal.jsx`); calendar day-log entries deep-link with `?section=cash-flow&bill=<id>` / `&payment=<id>` through the shared `workspace/CashFlowChip.jsx` pill (skipped for deletions); `utils/money.js::formatMoney` is the one currency formatter. **Sync with the rest of the app:** the work order dialog (`admin/shared/WorkOrderDialog.jsx`, admin only via `utils/useCurrentUser.js`, whose cache resets on the `AUTH_CHANGED_EVENT` that `authAPI.login/logout` dispatch) reads the job's bills and payments live from `/api/bills?repair_id=` + `/api/payments?repair_id=` (`utils/useJobMoney.js`) for the Job accounting block described below. Bills are logged ONLY in Cash Flow — each bill line carries `kind` (part | shipping | outsourced | other) and an optional `tool_id` (validated against the work order's tools by `_prepare_lines`, `tool_label` snapshotted) that say what it was for — while the dialog itself only adds an extra charge on a tool (`AddExtraChargeModal.jsx`), an additional expense (`AddExpenseModal.jsx` → a bill with one non-part line linked to the job/tool) or a customer payment. `GET /api/repairs/attention` adds a `bills_due` bucket (unpaid, overdue or due within 7 days; admin only, empty for other roles) that `AttentionPanel.jsx` renders after the follow-ups.
- **Profit & Loss and the money journal** (Workspace → Cash Flow, views `pnl` and `journal` beside Money Out / Money In; **admin only**, `routers/accounting.py` at `/api/accounting`, every route `require_admin`): both are DERIVED at read time from the primary records, never stored. `GET /api/accounting/pnl?from&to` (shop-local inclusive dates, ≤400 days) returns the jobs with a tool whose `date_completed` falls in the period plus every non-void bill and payment of those jobs; `GET /api/accounting/journal?from&to` returns the jobs with an `invoiced`/`completed` status entry in range, bills by `bill_date` / `paid_date` / status timestamps, payments by `received_date` / `created_at`, and the `activity_log` rows that touched money (`tool_edited` kept only for the money fields in `_MONEY_FIELD_PREFIXES`, plus bill/payment edits and deletions). The maths stays in the frontend: `utils/accounting.js::pnlRows` runs `jobAccounting` per job (so a repair's profit is the figure on its card) and emits one row per tool completed in the period — **a repair counts on the day its tool was marked Completed**, paid or not (the shop's call; payment shows in Money In) — with the job's shared expenses (bill lines and dialog expenses with no tool) split evenly, cents-exact (`splitEvenly`), across the job's counted tools — never heaped on one tool, and never shared with declined/BER/abandoned tools; `journalEntries` builds the chronological ledger (invoice issued = pre-tax revenue from `toolCharges`, repair completed, payment received, bill logged / paid / status, money edits) with a running cash balance (received − bills paid) and period totals; `presetRange` (Today / This week Mon–Sun / This month / Custom via `workspace/PeriodPicker.jsx`), `toCsv` / `downloadCsv` (Export CSV on both views), `shopDay` / `shopTime`. Views: `workspace/ProfitLossView.jsx` (headline stats, day-by-day table, rows with `WorkOrderChip`, phone cards) and `workspace/JournalView.jsx` (totals, kind filter chips, search, day-grouped entries whose bill/payment pills deep-link `?section=cash-flow&bill=|payment=` — `CashFlowSection` switches to Money Out / In on those params). Both lists are paged IN THE BROWSER (`PaginationBar`, 10/20/30/50 a page, back to page 1 on every period, filter or search change) rather than at the API: the totals, the day strip and the running cash balance need the whole period, and the maths lives in the browser anyway; CSV and the day close always take every row. The P&L day strip shows 14 days with a show-all toggle, and its total row reads "Period total" once the rows span pages. `workspace/PrintDayClose.jsx::openPrintDayClose({from, to, pnl, journal, win})` prints the Day Close (or Period Close) through the work-order print root; on phones the tab is opened inside the tap (`openCloseTab`) and filled after the second fetch.
- **Job accounting** (top of the work order dialog via `admin/shared/WorkOrderMoney.jsx`, plus `ToolSubtotal.jsx` under each tool's parts list; all maths in `utils/jobAccounting.js`; CAD only — `constants/bills.js` `CURRENCIES = ['CAD']` hides the currency pills): three columns — *Charged to customer* (labour hours × hourly rate + parts at customer price + `extra_charges`; a typed `invoiced_amount` replaces that subtotal as the tool's revenue), *Cost to shop* (labour by whichever terms apply, in order: the tool's flat `labour_cost_override` (a legacy per-tool `labour_cost_rate` carries over as that flat amount in `_migrate_tool_parts`), else the assigned technician's agreed terms on their shop account — `labour_cost_basis` `hourly` (rate × the tool's labour hours) or `per_job` (the flat amount for every tool, whatever the hours) + `labour_cost_rate`; `StaffCreate` / `StaffUpdate` (rate null clears, checked via `model_fields_set`) / `StaffResponse`, returned by `/api/auth/staff` only to admin callers, set in Users & Accounts, matched by the display name the tool stores in `assigned_technician`, with `useJobMoney` building the name → `{basis, rate}` map — else hours × the shop-wide hourly `business_settings.labour_cost_rate`; parts = every part on the tool, whatever its status (mirrors parts charged, so a quote-stage job already shows its expected profit) × `PartItem.cost` — what the shop paid, snapshotted from `parts_library_parts.cost` when the part is picked (`PartLibraryPicker` / ToolForm) or by `_fill_part_costs` on create / add-tool / update-tool when the part is library-linked and has no cost — the cost is managed ONLY in the parts library, never typed on the job or shown on the tool card (a cost added to the library later reaches a job part on its next save), backfilled for older jobs by `scripts/backfill_part_costs.py` (dry run by default, `--apply`); other = non-part bill lines and dialog expenses, lines with no `tool_id` counting for the whole job. Part-kind bill lines are never added to a job — they would count the installed parts twice — so the dialog lists only "Other expenses on this job") and *Profit* (revenue − total cost, margin = profit ÷ revenue) — followed by the payment line: invoiced incl. tax (revenue + `gst_rate`/`pst_rate` from settings per each tool's `tax_status`, computed on the grouped revenue so it rounds like one Zoho invoice), paid by customer (the job's payments), and balance due / paid in full / overpaid. Revenue, cost and profit are pre-tax. A never-entered figure is `null` and renders "—", never 0. Tools whose effective status (last non-`closed` status) is `declined`, `beyond_economical_repair` or `abandoned` keep their own strip but are left out of the job totals (`excludedReason`). Cost, profit, expenses and the payment line are admin-only; everyone sees the charged column. The API enforces the cost side too: public `GET /api/settings/` returns `labourCostRate` only to an admin (`get_optional_user`; `SettingsContext` refetches on `AUTH_CHANGED_EVENT` so an admin's later settings save never writes the blank back), `_build_job_response(job, viewer)` blanks every tool's `labour_cost_rate` for non-admin viewers, and the create / add-tool / update-tool routes ignore that field from non-admins. Parts with no cost are counted (`uncostedParts`) and noted under the statement, since they make parts cost trail parts charged. Settings: Admin Settings → Repair Tracker (Labour Cost Per Hour, GST Rate, PST Rate; defaults 5 % / 7 %).
- **Reported problem vs diagnosis**: a tool's `remarks` is the customer's reported problem, taken at intake (online requests fill it); the shop's findings are `diagnostics[]` — numbered `{id, diagnosis (required), solution (optional), parts (optional)}` entries, three plain texts kept as typed: the `parts` text is a note of what the finding needs and is NOT linked to the tool's Parts list, which is entered separately as before. The tool form's `DiagnosisEditor.jsx` shows the three boxes in one row per finding and always has one entry ready to type into (the blank keeps the id the real entry gets on the first keystroke, so the box never remounts mid-word). The tool card's **Diagnosis** button (between Update Status and Edit) opens the same editor in its own dialog, styled like the edit modal, with the reported problem shown read-only above it — `handleStartDiagnosis` / `handleSaveDiagnosis` in WorkOrderDialog, a diagnostics-only partial `PUT /api/repairs/{job}/tools/{tool}` — so recording a finding never means the full edit form. The card's **Parts** button does the same for the parts list: `ToolForm` with `only="parts"` renders just its Parts section (suggested parts, library autocomplete, sourcing flags, stock badges via the shared `toolToForm` + `enrichPartsWithStock` seed), saved as a parts-only partial update followed by `syncPartsToLibrary` — so the Edit form is for identity, intake and money. A finding typed with a solution or parts but no diagnosis is refused with a toast (`incompleteFinding`) rather than dropped on save, in the dialog and the edit form alike. `id`s are assigned on write by `_ensure_diagnosis_ids` (repairs router) and by the edit form for older entries. Findings show on the tool card and print on the work order with their parts note (`PrintWorkOrder.jsx`); the tool tag prints the findings (`PrintToolTag.jsx`). No status gate depends on them. `activity_service.diff_tool` logs extra-charge and diagnosis changes as one summary line each (a finding from a code is prefixed `[HJ-03]`), and `tax_status` changes by label.
- **Diagnosis codes** (Admin Settings → Diagnosis Codes, admin only; `diagnosis_codes`, `models/diagnosis_code.py`, `routers/diagnosis_codes.py` at `/api/diagnosis-codes` — staff read, admin write, `/next` before `/{id}`): the shop's INTERNAL library of common problems, one code per problem per tool type, holding what the wall chart shows — `title` (symptom), `likely_causes[]`, `technician_checks[]` — plus `solution` (the repair), `parts[{name, quantity}]` (generic names) and `quote_note` (what we tell the customer). Code = `<prefix>-<number>` (HJ-01, two digits minimum); the prefix is suggested from the tool type (`suggest_prefix`: initials, or the first two letters of a one-word type, GENERAL → GEN) and editable, the number is the next free one for the prefix (`_next_number`, retired codes included, so a number is never reused); `code` is unique (index script). Each code sits in one wall-chart **section** (`category`, fixed list in `CATEGORIES`: AIR TOOLS, HYDRAULIC TOOLS, ELECTRIC TOOLS, LIFTING TOOLS, DRAIN CAMERAS, CORDLESS TOOLS, GENERAL) under one tool type within it (IMPACT WRENCH inside AIR TOOLS; a section's generic codes use the type "ANY AIR TOOL" → prefix AT, the "ANY" skipped); `GENERAL` holds the few codes that apply to anything. **Starter library:** `scripts/seed_diagnosis_codes.py` loads `scripts/data/diagnosis_codes_seed.json` (matched by code; default adds only missing codes, `--update` refreshes the seed's fields on existing ones, `--dry-run`; `docker exec cns-backend-prod python scripts/seed_diagnosis_codes.py` in prod) — the shop then adds codes from Admin Settings or from a finding. Delete = retire (`active: false`), restorable; `usage_count` is derived on read from `repairs.tools.diagnostics.code`, never stored. **Wall chart:** `PrintDiagnosisCodes.jsx` prints two ways through the work-order print root — a *wall index* (code + symptom, big type, one tool type per page, portrait) and the *full reference chart* (landscape table: code, symptom, causes, checks, repair, parts, optional quote-note column), groups lettered A, B, C… with General first (`constants/diagnosisCodes.js::groupCodes`). Frontend: `admin/tabs/DiagnosisCodesTab.jsx` + `DiagnosisCodeFormModal.jsx` (list fields typed one per line; narrow inputs swap `w-full` out of INPUT_CLS rather than append a width — cascade trap), `constants/diagnosisCodes.js` (prefix/format/grouping mirrors the backend, `orderForTool` = the tool's type first, then General, then the rest). **Using a code on the tracker:** the "Use code" box at the top of `DiagnosisEditor.jsx` (tool form, Diagnosis dialog, new-job wizard; codes cached per page for 2 min) — type the code however sloppily ("hj3", "hj 03", "HJ-3" all mean HJ-03; `parseCodeQuery` + `codeQueryMatches`; a bare prefix lists that type; Enter picks the exact code or the first result) or search a symptom (8 results, "N more — keep typing"), then an apply panel with the likely causes as tick boxes (ticked ones become the diagnosis text: "Symptom — cause; cause"), the checks as a reminder, the repair, the quote note and the code's parts matched by name to the model's library (`utils/suggestedParts.js`: `fetchSuggestedPartsForTool` — the lookup ToolForm's Suggested Parts box also uses — `matchCodeParts`, `partRowFromMatch`, `isPartListed`). **Apply** adds a finding `{code, diagnosis, solution, parts (note), customer_explanation}` and hands the host the Parts rows in ONE `onApplyCode(nextDiagnostics, rows)` call (two successive updates from one render would lose the first): ToolForm appends them to its parts, the Diagnosis dialog queues them ("Parts to add on save", removable; each row carries `_finding_id`, so removing the finding before saving drops its rows too — stripped by `cleanRow` on save) and sends `parts` with the findings in the same partial update. The new finding scrolls into view (it lands below the fold on a phone); a code already on the tool shows "Already on this tool as finding N" and the button reads "Apply again" (allowed, for a second separate problem). The customer-wording box is shown only on findings that have wording or came from a code — a hand-typed finding gets a "+ What we tell the customer" link — and every box grows with its text (`rowsFor`). When the tool is still `received`, the Diagnosis dialog offers "Move this tool to Diagnosed on save" (checked by default): the findings save first, then `PUT …/status` `diagnosed`; a refused move keeps the findings and reports the error. **Both directions between findings and the library:** a hand-typed finding can be linked to a code afterwards ("Link code" in the finding header, the same `CodeSearch` box: keeps the typed text, stamps the code so it counts, fills only the blank boxes; the chip opens the picker again to change or unlink), and an admin can turn a typed finding into a new code from the tool card ("Save as code" → `DiagnosisCodeFormModal` with `initial` prefilled from the job — tool type, symptom, repair, parts parsed from the parts note, quote wording; on save the finding is stamped with the new code and the page's code cache, `utils/diagnosisCodesCache.js`, is invalidated so the next picker has it). Applied and linked texts stay snapshots on the job: editing a code later never rewrites old findings. A library match becomes a linked row like Suggested Parts (part number, price, cost snapshot, stock badge); an unmatched name becomes a plain pending row; rows already on the tool are skipped and counted. Every finding also has the fourth box "What we tell the customer" (`customer_explanation`, editable per job); the tool card shows the code chip and the wording with a **Copy** button (`copyForQuote` → clipboard for the Zoho quote line) and **Copy all** (numbered) when two or more findings have one. Nothing from a code prints on the work order or tool tag — internal only.
- **Settings tabs** (`/admin/settings`, `?tab=` deep-linkable): Home, Services, Industries, Tools for Sale, Gallery, About, Contact, Global, Repair Tracker (stale threshold, parts markup, labour cost rate, GST/PST rates, work order email template), Camera Intake (Hathorn option lists — see camera_intake_config), Diagnosis Codes (the internal problem-code library + wall chart printing), Users & Accounts (staff/admin + sales rep CRUD — the only account-management surface)
- **Services vs Tools**:
  - Services: Array in settings collection (no IDs)
  - Tools: Separate collection with CRUD API (categorized, soft-delete)
- **Repair Tracker** (`/admin/repair-tracker`): Server-side pagination, batch status updates, work order printing (`PrintWorkOrder.jsx`), tool tag printing (`PrintToolTag.jsx` — 4×3 inch labels with status badge, warranty indicator, and parts list). Inline DOM printing with new-tab fallback for mobile.
- **Parts Library tabs**: Brands → Models → Parts (3-level drill-down), plus Compatibility Groups for cross-brand interchangeable parts

## Development Workflows

### Quote Submission Test (Multi-Tool)
1. Start backend (WSL: `--host 0.0.0.0`) + frontend
2. Navigate to `/repair-request`
3. Fill form: customer info + add multiple tools (collapsible UI)
4. Upload photos (max 5, 10MB each, jpg/png/webp)
5. Verify backend logs: `Email sent. Status: 202`
6. Check `/api/quotes/` for request with `request_number` (e.g., "REQ-2026-0001")
7. Verify photos in `/uploads/quotes/{uuid}.ext`
8. Email should show all tools formatted with brands/models capitalized

### Admin Content Management
1. Create admin: `python scripts/create_admin.py`
2. Login at `/admin/login`
3. Edit content in tabs (page sections, tools, gallery)
4. Tools/brands/quotes: Use `/docs` Swagger UI

### Image Optimization
```bash
cd frontend
node scripts/optimize-images.js  # Generates WebP + JPG (<400KB, 80% quality)
```

## Design System

- **Sections**: `px-6 sm:px-8 lg:px-12 py-16 sm:py-20 lg:py-24`
- **Buttons**: `bg-primary text-white font-black px-8 py-4 rounded-xl uppercase`
- **Icons**: Material Symbols Outlined with `fontVariationSettings: "'wght' 600"`
- **Backgrounds**: Alternating `bg-white`/`bg-slate-100` (light), `bg-slate-900`/`bg-slate-950` (dark)
- **Typography**: `font-black` headings, `uppercase` emphasis
- **Section headers**: Orange label (`text-accent-orange text-xs uppercase tracking-[0.25em]`) + large heading
- **Phone-first (Workspace is used mostly on phones)**: tap targets ≥ 44px below `sm` via `min-h-[44px] sm:min-h-0` / `min-w-[44px] sm:min-w-0` (never a layout blow-up); form controls `text-base sm:text-sm` (iOS zooms the page on focus under 16px — `formStyles.INPUT_CLS`, `ui.FILTER_INPUT`); header action clusters take their own full-width row under the title on phones and dissolve back beside it with `sm:contents`; action-button clusters (tool card row, Job accounting buttons) are a two-column grid of equal, centred buttons on phones and the inline row from `sm` up — `grid grid-cols-2 gap-2 sm:flex sm:flex-wrap`, buttons `justify-center sm:justify-start`, a lone last button spanning both columns via `[&>:last-child:nth-child(odd)]:col-span-2` (`even` when the first button already spans, as Update Status does); modals size with `dvh`, not `vh`. Cascade trap: Tailwind emits `.w-11`/`.h-11` BEFORE `.w-9`/`.h-9`, so appending `w-11` to `ICON_BTN` (which has `w-9`) does nothing — grow icon buttons with `min-w-11 min-h-11` instead.

## Troubleshooting

### ERR_CONNECTION_RESET (WSL)
- **Fix**: Use `--host 0.0.0.0` when starting uvicorn
- **Verify**: `ss -tuln | grep 8000` shows `0.0.0.0:8000`

### Pydantic ValidationError "id field required"
- **Fix**: Convert ObjectId to string, rename `_id` to `id` (see Critical Patterns)

### MongoDB connection failed
- Verify connection string has credentials
- Check Atlas cluster not paused
- Confirm database name: `cnstoolsandrepair_db_dev`

### Email not sending
- Verify `RESEND_API_KEY` in `.env`
- Check backend logs for email send confirmation
- Domain authentication for `cnstoolrepair.com` must be configured in Resend dashboard

## Security Features

**Implemented protections:**
- **Rate limiting**: 5 requests/hour per IP on quote endpoint (slowapi) - prevents DOS attacks
- **CSRF**: `/api/csrf-token` issues a token + cookie (fastapi-csrf-protect), but no route currently validates it and the frontend never fetches it — actual cross-site protection comes from SameSite cookies, CORS, and rate limiting. Wire up validation before treating CSRF as enforced.
- **File validation**: Deep image content verification with Pillow before saving
- **Idempotency**: Duplicate submission prevention with 5-min cache using `idempotency_key`
- **Phone validation**: Strict ###-###-#### format enforcement via Pydantic validator
- **Filename sanitization**: UUID-based filenames prevent path traversal attacks
- **Auto-capitalization**: Tool fields (type/brand/model) auto-capitalize to prevent injection

**File validation** (in `save_upload_file()`): size check (10MB), extension whitelist, deep Pillow image verification — accepts MPO format (iPhone Live Photos map to JPEG).

**Production requirements:**
- Enable `cookie_secure=True` for CSRF (requires HTTPS)
- Migrate idempotency cache to Redis for multi-server deployments
- Configure slowapi Redis storage for distributed rate limiting

## Known Limitations

1. **No password reset** - Manual via MongoDB (connect with Compass, update `users` collection directly)
2. **Local file storage** - Production needs Digital Ocean Spaces/AWS S3 (see DEPLOYMENT_CHECKLIST.md)
3. **No pagination on quotes list** - Returns all (repairs tracker has server-side pagination)
4. **Client-side SEO** - Meta tags via react-helmet-async (SSR/SSG would be better)
5. **No test suite** - pytest + httpx are installed but no tests written yet

## Production Deployment

**⚠️ CRITICAL**: Local file storage (`backend/uploads/`) will lose photos on deployment. Must integrate Digital Ocean Spaces before production. See `DEPLOYMENT_CHECKLIST.md` for:
- Spaces setup checklist
- Environment configuration
- Cost breakdown (~$17/month)
- Code changes required
- Security notes

**Production checklist**:
1. MongoDB Atlas production DB (`cnstoolsandrepair_db_prod`)
2. Set `CORS_ORIGINS` to production domain only
3. Configure DNS + SSL certificate
4. Integrate Digital Ocean Spaces (required)
5. Test quote submission + email end-to-end
6. Submit sitemap to Google Search Console

## Additional Documentation

- `DEPLOYMENT_CHECKLIST.md` - Step-by-step production deployment checklist
- `DEPLOYMENT_DO_DROPLET.md` - Digital Ocean Droplet deployment guide
- `PRODUCTION.md` - General production deployment guide
- `PRODUCTION_ENV_GUIDE.md` - Environment variable configuration guide
- `PRODUCTION_READY.md` - Production launch readiness summary
- `READY_TO_DEPLOY.md` - Production configuration guide
- `SECURITY_CHECKLIST.md` - Pre-deployment security verification
