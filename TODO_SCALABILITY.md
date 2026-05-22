# Scalability TODOs

Future improvements identified from scalability audit (2026-05-21).
Prioritized by impact. Not blocking current operations — the system handles the current business scale fine.

---

## Priority 1 — Critical (Broken in Production)

### [ ] Add Redis for rate limiting and idempotency cache
- **Why**: Both use in-memory Python dicts, but production runs 4 gunicorn workers (separate processes). Rate limits are 4x weaker than intended, and duplicate quote submissions can slip through.
- **Where**: `backend/app/main.py` (slowapi limiter), `backend/app/routers/quotes.py:22` (idempotency_cache)
- **Fix**: Install Redis, configure `slowapi` with `redis://` storage URI, replace `idempotency_cache` dict with Redis keys with TTL
- **Effort**: ~2 hours

### [ ] Refactor `/summary` endpoint to use MongoDB aggregation pipelines
- **Why**: Loads up to 2,900 full documents into memory and processes them in Python loops on every dashboard load. Will timeout at 500+ active jobs.
- **Where**: `backend/app/routers/repairs.py:85-529`
- **Fix**: Replace Python-side iteration with `$group`, `$match`, `$unwind` aggregation stages. Add 60-second TTL cache for results.
- **Effort**: ~4 hours

### [ ] Wrap blocking sync calls in `asyncio.to_thread()`
- **Why**: Synchronous I/O inside async handlers blocks the event loop under concurrent load.
- **Where**:
  - `backend/app/services/file_service.py` — boto3 S3 uploads/deletes, PIL image validation, local file writes
  - `backend/app/routers/auth.py:36` — bcrypt password verification (~100-300ms)
- **Fix**: Use `asyncio.to_thread()` for CPU/IO-bound calls, or switch to `aioboto3` and `aiofiles`
- **Effort**: ~2 hours

---

## Priority 2 — High (Performance Ceilings)

### [ ] Replace regex search with MongoDB text index
- **Why**: Repairs search uses `$regex` with `$options: "i"` across 9 fields — forces full collection scan on every query.
- **Where**: `backend/app/routers/repairs.py:738-749`
- **Fix**: Create a MongoDB text index on searchable fields, replace `$regex` with `$text` query
- **Effort**: ~1 hour

### [ ] Add missing database indexes
- **Where**: `backend/scripts/create_indexes.py`
- **Missing indexes**:
  - `repairs.updated_at` (used in summary endpoint)
  - `repairs.tools.date_completed` (used in summary)
  - `repairs.source_quote_id` (used in duplicate conversion check)
  - Compound index: `tools.status` + `created_at` (common filter+sort combo)
- **Effort**: ~1 hour

### [ ] Add React.lazy() code splitting for admin routes
- **Why**: Entire app (3,400-line admin components, swiper, dnd-kit, qrcode) shipped to every visitor in one bundle.
- **Where**: `frontend/src/App.jsx` — all 12 page imports are static
- **Fix**: Wrap admin routes (`AdminSettings`, `RepairTracker`) and heavy public components in `React.lazy()` + `Suspense`
- **Effort**: ~1 hour

### [ ] Add pagination to remaining list endpoints
- **Why**: `tools`, `brands`, `gallery`, `technicians`, `suppliers` all return every record. Quotes endpoint has no `limit` cap.
- **Where**: Respective routers in `backend/app/routers/`
- **Fix**: Add `skip`/`limit` params with max limit validation (e.g., 200)
- **Effort**: ~2 hours

---

## Priority 3 — Medium (Production Hardening)

### [ ] Tune MongoDB connection pool
- **Why**: 4 workers x 100 default pool = 400 potential connections. Atlas free tier limit is 500.
- **Where**: `backend/app/database.py:15`
- **Fix**: Set `maxPoolSize=25` per worker (4 x 25 = 100 total), add `connectTimeoutMS`, `serverSelectionTimeoutMS`
- **Effort**: ~30 min

### [ ] Configure gunicorn timeout and max-requests
- **Why**: No `--timeout` (default 30s may not be enough for /summary or file uploads). No `--max-requests` means workers never restart (memory leak risk).
- **Where**: `backend/Dockerfile:33`
- **Fix**: Add `--timeout 120 --max-requests 1000 --max-requests-jitter 50`
- **Effort**: ~15 min

### [ ] Reuse boto3 S3 client instead of recreating per call
- **Why**: `get_spaces_client()` creates a new TCP connection for every file operation.
- **Where**: `backend/app/services/file_service.py:22-48`
- **Fix**: Create client once at module level or use a cached singleton
- **Effort**: ~30 min

### [ ] Fix SettingsContext re-render cascade
- **Why**: `value` object recreated every render, causing all `useSettings()` consumers to re-render on any state change.
- **Where**: `frontend/src/contexts/SettingsContext.jsx:115-120`
- **Fix**: Memoize the context value with `useMemo`
- **Effort**: ~15 min

---

## Priority 4 — Low (Nice to Have)

- [ ] Add `vite-plugin-compression` for gzip/brotli pre-compression
- [ ] Add responsive images (`srcSet`) for gallery and hero
- [ ] Add service worker for static asset caching
- [ ] Break up RepairJobsTab (3,400 lines, 40+ useState) into smaller components
- [ ] Move static file serving from FastAPI to nginx in production
- [ ] Add `bulkWrite` for batch status updates instead of per-tool `update_one`
- [ ] Add bundle analyzer (`rollup-plugin-visualizer`) to monitor bundle size

---

## Future Feature Roadmap

Feature ideas identified from business analysis (2026-05-21).
Ordered by business impact. None are urgent — these are growth features.

---

### ⭐ Top 3 Recommended (Build These First)

#### [ ] Customer Repair Status Tracking Page
- **What**: Public page at `/track/REQ-2026-0042` — customers see their job status without calling
- **Why**: Eliminates "is my tool ready?" phone calls. QR code on the printed tool tag already exists, just needs a URL target
- **Effort**: Low — repair data and tool tags already exist, needs a public read-only endpoint + simple page
- **Depends on**: Nothing new in backend (status is already tracked)

#### [ ] Automated Customer Email Notifications
- **What**: Send customers an email when their repair status changes (diagnosed, quoted, ready for pickup). Configurable per-status from admin settings.
- **Why**: Customers feel informed without manual effort. Reduces follow-up calls. Builds trust.
- **Effort**: Low-medium — Resend is already integrated (`services/resend_client.py`), just needs trigger logic in `routers/repairs.py` on status update + email templates
- **Depends on**: Nothing new

#### [ ] CSV / PDF Data Export
- **What**: Export repair jobs, parts costs, and completed job summaries by date range. At minimum a CSV download from the repair tracker.
- **Why**: End-of-month accounting, tax time, supplier negotiations. Currently no way to extract data without MongoDB access.
- **Effort**: Low — query already exists in `routers/repairs.py`, needs export endpoint + frontend download button

---

### Tier 1 — High Business Impact

#### [ ] Quote / Invoice PDF Generation
- **What**: Generate a branded PDF quote when a job is in "quoted" status, and an invoice when "invoiced". Itemized parts + labour + service agreement terms.
- **Why**: `price`, `labour_hours`, `hourly_rate` are already tracked per tool — just need to render them into a customer-facing document
- **Depends on**: Service agreement system (already built), parts pricing per tool (already tracked)

#### [ ] Zoho Books API Integration (Two-Way Sync)
- **What**: Auto-create invoices in Zoho Books when a job hits "invoiced" status. Pull payment status back into the repair tracker.
- **Why**: Eliminates double data entry. The `zoho_ref` field is already a manual reference — this makes it live.
- **Effort**: Medium — needs Zoho API OAuth setup and sync logic
- **Depends on**: Invoice PDF generation (above) would complement this

---

### Tier 2 — Operational Efficiency

#### [ ] Technician Calendar / Workload View
- **What**: Visual calendar or kanban board showing each technician's assigned tools, estimated completion dates, and workload
- **Why**: `assigned_technician` and `estimated_completion` are already tracked per tool. A visual view replaces scrolling a table.
- **Effort**: Medium — needs a new frontend view (e.g., react-big-calendar or similar)

#### [ ] Recurring Customer Maintenance Reminders
- **What**: Flag customers for follow-up after X months since last completed repair. Send automated "time for a service?" emails.
- **Why**: Turns one-time repairs into recurring business. B2B industrial tools need regular maintenance.
- **Effort**: Medium — needs a scheduled job (cron or background task) + customer last-repair-date query

#### [ ] Parts Inventory / Stock Tracking
- **What**: Track common parts in stock (separate from per-job parts). Decrement stock when a part is added to a job. Low-stock alerts.
- **Why**: Parts library already has brands, models, and part numbers — adding `quantity_on_hand` closes the loop
- **Effort**: Medium — needs new inventory collection + UI in parts library admin tab

---

### Tier 3 — Nice to Have

#### [ ] SMS Notifications (Twilio or similar)
- **What**: Text customers when their tool is ready for pickup
- **Why**: Industrial customers are often on the floor, not checking email. SMS has far higher open rate.
- **Effort**: Low-medium — needs Twilio account + send logic alongside existing Resend email triggers

#### [ ] Before / After Photo Comparison
- **What**: Side-by-side photo view of tool before and after repair, attached to the completed job record
- **Why**: Builds trust, useful for warranty disputes, good content for gallery/social media
- **Effort**: Low — photos per tool are already uploaded and stored, needs a UI comparison view

#### [ ] Customer Portal with Login
- **What**: Let repeat customers log in to see all past and current repairs, download invoices, and submit new requests pre-filled with their info
- **Why**: Large B2B customers (fleet, manufacturing) send multiple tools regularly — a portal makes you stickier
- **Effort**: High — needs customer auth system (separate from admin JWT), portal UI, scoped API access

#### [ ] Multi-Location Support
- **What**: Separate job queues, technicians, and inventory per physical location
- **Why**: Relevant if expanding to a second shop
- **Effort**: High — requires architectural changes to most collections (location scoping)
- **Note**: Keep this in mind for schema decisions going forward to avoid costly migrations later
