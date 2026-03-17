# CLAUDE.md

This file provides guidance to Claude Code when working with this repository.

## ⚠️ Security Notice
**IMPORTANT:** Never include real MongoDB credentials, SendGrid API keys, passwords, or tokens in this file. All credentials are in `backend/.env` (gitignored).

## Project Overview

**CNS Tools and Repair** - B2B industrial pneumatic tool repair website for Surrey, BC
- **Stack**: FARM (FastAPI + React + MongoDB)
- **Architecture**: Backend API + Frontend SPA
- **Business Model**: Local on-site service (customers bring tools for diagnosis)
- **Target**: Mid to large industrial businesses (10 sectors: Automotive, Fleet, Manufacturing, Metal Fabrication, Construction, Oil & Gas, Aerospace, Marine, Mining, MRO)
- **Current Phase**: Development with MongoDB Atlas (cloud database)

## Quick Start

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
npm run dev  # Dev server on :5173
```

### MongoDB Atlas
- Cloud database (no local MongoDB needed)
- Connection string in `backend/.env`
- Dev DB: `cnstoolsandrepair_db_dev`
- View via MongoDB Compass

## Architecture

### Request Flow
Client → React SPA → Axios (`api.js`) → FastAPI routers → MongoDB Atlas → SendGrid (email)

### Backend (FastAPI)
- **Async-first** using Motor driver (all DB ops use `await`)
- **Structure**: `app/main.py` (FastAPI app) → `routers/` (API endpoints) → `services/` (business logic) → `database.py` (MongoDB connection)
- **Key patterns**:
  - ObjectId conversion: `convert_objectid_to_str()` + rename `_id` to `id` before returning to frontend
  - File uploads: `multipart/form-data` with `UploadFile`, saved to `uploads/` with UUID filenames
  - Email: Non-blocking SendGrid notifications (don't block quote creation)
  - Middleware: Request logging, CORS, static file serving (`/uploads`)

### Frontend (React)
- **React Router v6** with component-based architecture
- **State**: ThemeContext (dark mode), SettingsContext (business settings), React Hook Form (forms)
- **Design**: Tailwind CSS, Russo One logo font, Montserrat body, Material Symbols icons
- **Colors**: Primary blue #1152d4, Accent orange #f97316
- **SEO**: react-helmet-async, sitemap.xml, robots.txt, Open Graph tags, structured data
- **Vite**: Proxies `/api` and `/uploads` to backend (no CORS issues in dev)

### Database Schema
```javascript
// quotes - Customer quote requests with photos
// tools_catalog - Repairable tools (categorized: air_tools, electric_tools, lifting_equipment)
// brands - Brand logos for carousel
// industries_page_content - Industries page content (singleton document with hero + industries array)
// settings - Business settings (singleton document)
// gallery - Photo gallery
// users - Admin authentication
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

### Tools API Route Order (CRITICAL)
```python
# /by-category MUST be defined BEFORE /{id} to avoid matching "by-category" as an ID
@router.get("/by-category")  # Returns {"air_tools": [...], "electric_tools": [...], ...}
@router.get("/{id}")
```

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
SENDGRID_API_KEY=<key>
SENDGRID_FROM_EMAIL=noreply@cnstoolsandrepair.com
NOTIFICATION_EMAIL=cnstoolsandrepair@gmail.com
JWT_SECRET_KEY=<generate_with_secrets.token_urlsafe(32)>
JWT_ALGORITHM=HS256
JWT_EXPIRATION_HOURS=8
MAX_FILE_SIZE=5242880
ALLOWED_EXTENSIONS=jpg,jpeg,png,webp
```

### Frontend (optional `.env`)
```env
VITE_API_URL=http://localhost:8000
```

## Admin Interface

- **Routes**: `/admin/login`, `/admin/settings` (hidden, no nav links)
- **Auth**: JWT-based (email + password), 8-hour expiration
- **User creation**: `python scripts/create_admin.py`
- **Settings tabs**: Home, Services, Industries, Gallery, About, Contact, Global
- **Services vs Tools**:
  - Services: Array in settings collection (no IDs)
  - Tools: Separate collection with CRUD API (categorized, soft-delete)

## Development Workflows

### Quote Submission Test
1. Start backend (WSL: `--host 0.0.0.0`) + frontend
2. Navigate to `/quote`, fill form, upload photos
3. Verify backend logs: "Email sent! Status code: 202"
4. Check `/api/quotes/` and `/uploads/{filename}`

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
- Verify `SENDGRID_API_KEY` in `.env`
- Check logs for "Email sent! Status code: 202"
- Free tier: 100 emails/day limit

## Security Features

**Implemented protections:**
- **Rate limiting**: 5 requests/hour per IP (slowapi) - prevents DOS attacks
- **CSRF protection**: Token-based validation (fastapi-csrf-protect)
- **File validation**: Deep image content verification with Pillow
- **Idempotency**: Duplicate submission prevention with 5-min cache
- **Phone validation**: Strict ###-###-#### format enforcement
- **Filename sanitization**: Path traversal attack prevention

**Production requirements:**
- Enable `cookie_secure=True` for CSRF (requires HTTPS)
- Migrate idempotency cache to Redis for multi-server deployments
- Configure slowapi Redis storage for distributed rate limiting

## Known Limitations

1. **No password reset** - Manual via MongoDB (see AUTH_SETUP_GUIDE.md)
2. **Local file storage** - Production needs Digital Ocean Spaces/AWS S3 (see DEPLOYMENT.md)
3. **No pagination** - Quote list returns all (add for >1000 quotes)
4. **Client-side SEO** - Meta tags via react-helmet-async (SSR/SSG would be better)

## Production Deployment

**⚠️ CRITICAL**: Local file storage (`backend/uploads/`) will lose photos on deployment. Must integrate Digital Ocean Spaces before production. See `DEPLOYMENT.md` for:
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

- `AUTH_SETUP_GUIDE.md` - Admin authentication setup
- `DEPLOYMENT.md` - Production deployment guide (Digital Ocean Spaces integration)
- `OG_IMAGE_GUIDE.md` - Social media preview image creation
