# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## ⚠️ Security Notice

**IMPORTANT:** This file is committed to git. Never include:
- Real MongoDB credentials or connection strings
- SendGrid API keys
- Passwords or access tokens
- Any sensitive configuration values

All credentials are stored in `backend/.env` which is gitignored.

## Project Overview

**CNS Tools and Repair** - B2B industrial pneumatic tool repair website for Surrey, BC
- **Stack**: FARM (FastAPI + React + MongoDB)
- **Architecture**: Separated backend API + frontend SPA
- **Business Model**: Local on-site service (customers bring tools for diagnosis, no shipping)
- **Target**: Mid to large industrial businesses across 10 sectors: Automotive, Fleet Maintenance, Manufacturing, Metal Fabrication, Construction, Oil & Gas, Aerospace, Marine, Mining, MRO
- **Current Phase**: Development using MongoDB Atlas (cloud database for both dev and production)

## Development Commands

### Backend (FastAPI)
```bash
cd backend
python3 -m venv venv
source venv/bin/activate  # Windows: venv\Scripts\activate
pip install -r requirements.txt

# Start MongoDB (if using local)
sudo systemctl start mongod

# CRITICAL: Must bind to 0.0.0.0 in WSL for Windows browser access
python3 -m uvicorn app.main:app --reload --host 0.0.0.0 --port 8000

# Access API docs
http://localhost:8000/docs
```

**WSL Network Issue**: Always use `--host 0.0.0.0` when running backend in WSL. Binding to 127.0.0.1 will cause `ERR_CONNECTION_RESET` from Windows browsers.

### Frontend (React + Vite)
```bash
cd frontend
npm install
cp .env.example .env  # Optional: Configure VITE_API_URL (defaults to http://localhost:8000)
npm run dev      # Dev server on :5173
npm run build    # Production build to dist/
npm run preview  # Preview production build on :4173
```

### Frontend Image Optimization
```bash
# Optimize new hero images (generates WebP + optimized JPG)
cd frontend
node scripts/optimize-images.js

# Images are optimized to <400KB with 80% quality
# Script outputs: [name]-optimized.jpg and [name]-optimized.webp
# Always use -optimized versions in components
```

### MongoDB (Atlas - Cloud Database)
```bash
# No local MongoDB service needed - using Atlas cloud database

# MongoDB Compass Connection String:
# Copy from backend/.env file (contains credentials - not in git)
# Format: mongodb+srv://<username>:<password>@<cluster>.mongodb.net/<database>?retryWrites=true&w=majority&tls=true

# Database: cnstoolsandrepair_db_dev
```

### Database Migrations
```bash
# Run industry data migration script
cd backend
python scripts/update_industries.py
```

## Architecture Overview

### Request Flow
1. **Client** → React SPA (port 5173/80)
2. **Frontend** → Axios API client (`frontend/src/services/api.js`)
3. **Backend** → FastAPI routers (`backend/app/routers/`)
4. **Database** → MongoDB Atlas (cloud database)
5. **Email** → SendGrid API (quote notifications)
6. **Files** → Local `backend/uploads/` directory

### Backend Architecture (FastAPI)

**Async-first design** using Motor (async MongoDB driver):
- **app/main.py**: FastAPI app with lifespan context manager for DB connection, CORS middleware, request logging
- **app/database.py**: MongoDB connection singleton (global `client` and `database` variables)
- **app/config.py**: Pydantic Settings for environment variables
- **app/models/**: Pydantic schemas for validation (Quote, Tool, Brand, Industry, Settings, Gallery, Auth)
- **app/routers/**: API endpoints grouped by resource (quotes, tools, brands, industries, contact, gallery, settings, auth)
  - All routers use `/api/{resource}` prefix pattern (e.g., `/api/quotes/`, `/api/tools/`)
  - Routers included in main.py via `app.include_router()`
  - Each router handles CRUD operations for its resource
- **app/services/**: Business logic (email_service.py, file_service.py)
- **app/utils/**: Helpers (ObjectId → string conversion for JSON serialization)
- **scripts/**: Database migration scripts (update_industries.py)

**Critical patterns:**
- All MongoDB operations use `await` (Motor is async)
- **MongoDB ObjectId handling**: MUST convert `_id` to string AND rename to `id` for Pydantic response models
  ```python
  # Correct pattern (from app/routers/quotes.py):
  created_quote = await db.quotes.find_one({"_id": result.inserted_id})
  created_quote = convert_objectid_to_str(created_quote)

  # Use _id for domain models (e.g., Quote for email)
  quote_obj = Quote(_id=created_quote["_id"], ...)

  # Rename _id to id for response models
  created_quote["id"] = created_quote.pop("_id")
  return QuoteResponse(**created_quote)
  ```
- File uploads handled as `multipart/form-data` with `UploadFile` type
- Uploaded files saved to `uploads/` with UUID filenames
- Email notifications are non-blocking with error handling (don't block quote creation on email failure)
- **Middleware stack** (app/main.py):
  - Request logging middleware: Logs all incoming requests and response status codes
  - CORS middleware: Configures allowed origins from environment variables
  - Static file serving: `/uploads` directory mounted for file access
  ```python
  # Request logging pattern
  @app.middleware("http")
  async def log_requests(request: Request, call_next):
      print(f"Incoming request: {request.method} {request.url}")
      response = await call_next(request)
      print(f"Response status: {response.status_code}")
      return response
  ```

### Frontend Architecture (React)

**React SPA with component-based architecture**:
- **src/App.jsx**: React Router v6 setup with all routes
- **src/components/layout/**: Header, Footer, BottomNav (mobile-first navigation)
- **src/components/sections/**: Reusable page sections (Hero, HowItWorks, IndustriesServed, Testimonials, BrandsCarousel, ToolsPreview, QuickFacts, MapLocation, StickyQuoteCTA)
- **src/pages/**: Full page components (Home, About, Services, Quote, Contact, etc.)
- **src/services/api.js**: Centralized Axios client with API methods
- **src/config/business.js**: Business configuration fallback (contact info, hours, map links, service claims)
- **scripts/optimize-images.js**: Hero image optimization script (Sharp-based, generates WebP + JPG)

**Design system:**
- Tailwind CSS with custom config (primary: #1152d4 blue, accent: #f97316 orange)
- Russo One font for logo (industrial branding), Montserrat for body text
- Material Symbols Outlined icons (fontVariationSettings: 'wght' 600)
- Dark mode support via Tailwind's `dark:` classes
- Mobile-first responsive design with bottom navigation bar
- Consistent spacing: `px-6 sm:px-8 lg:px-12` for sections, `py-16 sm:py-20 lg:py-24` for vertical spacing
- Industrial aesthetic: uppercase headings, bold typography, strong contrast

**State Management:**
- **ThemeContext** (`contexts/ThemeContext.jsx`): Global theme state (light/dark mode)
  - Persists theme preference to localStorage
  - Applies `dark` class to document root for Tailwind dark mode
  - Provides `{ theme, setTheme, toggleTheme }` via `useTheme()` hook
  - Used by: ThemeToggle component
- **SettingsContext** (`contexts/SettingsContext.jsx`): Global business settings state
  - Fetches from backend `/api/settings/` on mount
  - Falls back to `config/business.js` when API unavailable
  - Provides `{ settings, loading, error, refreshSettings }` via `useSettings()` hook
  - Used by: Hero, Header, Footer, Contact, MapLocation, QuickFacts, BrandsCarousel
- **Local state**: React Hook Form (Quote page), localStorage (admin auth), useState (UI toggles)

**Vite Development Server:**
- Port 5173 with HMR (Hot Module Replacement)
- Proxies `/api/*` and `/uploads/*` to backend (http://localhost:8000)
- Configuration in `vite.config.js`:
  ```javascript
  proxy: {
    '/api': { target: 'http://localhost:8000', changeOrigin: true },
    '/uploads': { target: 'http://localhost:8000', changeOrigin: true }
  }
  ```
- No CORS issues in development due to proxy

**SEO implementation:**
- `react-helmet-async` for page-specific meta tags (installed and configured)
- Each page has unique title, description, keywords, and canonical URL
- HelmetProvider wraps entire app in `App.jsx` with default fallback meta tags
- `index.html` contains only static tags (charset, viewport) - all SEO tags managed by Helmet
- Meta tags are JS-injected (Google can read, but SSR/SSG would be better for first-pass indexing)
- Schema.org LocalBusiness structured data in `index.html` for local SEO
- **Open Graph tags** for Facebook/LinkedIn sharing (7 pages)
- **Twitter Card tags** for Twitter sharing (7 pages)
- **Sitemap.xml** in `public/` for search engine discovery
- **Robots.txt** for crawler guidance
- **OG Image**: Placeholder URL configured (`og-image.jpg`), actual 1200x630px image needed before production (see `OG_IMAGE_GUIDE.md`)

**Quote form specifics:**
- React Hook Form for validation
- React Dropzone for drag-drop photo upload (max 5 photos, 5MB each)
- FormData submission for multipart/form-data
- Photo previews with remove functionality
- Success/error status display after submission

**Hero section image handling:**
- Original images optimized via `scripts/optimize-images.js` (Sharp library)
- Generates WebP (modern browsers) + JPG (fallback) versions
- Component uses `image-set()` CSS for automatic format selection
- Unified gradient overlay for both themes: `rgba(15, 23, 42, 0.95)` → `rgba(15, 23, 42, 0.65)`
- Strong gradient ensures white text contrast in both light and dark themes
- All text elements have drop-shadow for readability: `drop-shadow-[0_4px_12px_rgba(0,0,0,0.9)]`
- Industries badge hardcoded: "Automotive • Fleet • Manufacturing • Construction"

### Database Schema

**MongoDB Collections:**

```javascript
// quotes - Customer quote requests
{
  _id: ObjectId,
  company_name: String,
  contact_person: String,
  email: String,
  phone: String,
  tool_type: String,
  tool_brand: String,
  tool_model: String,
  quantity: Number,
  problem_description: String,
  urgency_level: Enum["low", "medium", "high"],
  photos: [String],  // Array of filenames
  status: Enum["pending", "reviewed", "quoted", "approved", "rejected"],
  created_at: DateTime,
  updated_at: DateTime
}

// tools_catalog - Repairable tools (dynamic content)
{
  _id: ObjectId,
  name: String,
  category: String,
  description: String,
  image_url: String,
  active: Boolean
}

// brands - Brand logos/info (dynamic content)
{
  _id: ObjectId,
  name: String,
  logo_url: String,
  display_order: Number,
  active: Boolean
}

// industries - Industries served (dynamic content, soft-delete pattern)
{
  _id: ObjectId,
  name: String,  // e.g., "Automotive Repair & Body Shops"
  description: String,  // SEO-friendly description
  icon: String,  // Material Symbol icon name (e.g., "directions_car")
  active: Boolean  // false = soft-deleted, true = visible
}

// settings - Business settings (singleton document)
{
  _id: ObjectId,
  phone: String,
  email: String,
  address: Object,  // {street, city, province, postalCode, country}
  hours: Object,  // {weekdays, weekend, timezone}
  map: Object,  // {embedUrl, directionsUrl}
  social: Object,  // {facebook, linkedin, instagram}
  updated_at: DateTime
}

// gallery - Photo gallery (for homepage/about page)
{
  _id: ObjectId,
  title: String,
  description: String,
  image_url: String,
  category: String,
  display_order: Number,
  active: Boolean
}
```

## Critical Configuration

### Environment Variables

**Backend** (`backend/.env`):
```env
# MongoDB - Atlas Development
MONGODB_URL=mongodb+srv://<username>:<password>@<cluster>.mongodb.net/<database>?retryWrites=true&w=majority&tls=true
DATABASE_NAME=cnstoolsandrepair_db_dev

# CORS - Allow local frontend
CORS_ORIGINS=http://localhost:5173,http://localhost:3000

# Email Configuration - SendGrid (see "Email Configuration" section below for setup details)
SENDGRID_API_KEY=<your_sendgrid_api_key>
SENDGRID_FROM_EMAIL=noreply@cnstoolsandrepair.com
NOTIFICATION_EMAIL=cnstoolsandrepair@gmail.com

# File Upload Settings
MAX_FILE_SIZE=5242880  # 5MB
ALLOWED_EXTENSIONS=jpg,jpeg,png,webp
UPLOAD_DIR=uploads

# Environment
ENVIRONMENT=development
```

**Frontend** (optional `.env`):
- `VITE_API_URL`: Backend URL (defaults to http://localhost:8000)

### CORS Configuration

Backend CORS is configured in `app/main.py`:
- Development: `http://localhost:5173,http://localhost:3000`
- Production: Must set `CORS_ORIGINS` env var to production domain only

### MongoDB Connection

**Development (MongoDB Atlas):**
- Cloud-hosted MongoDB cluster (see `backend/.env` for connection details)
- Database: `cnstoolsandrepair_db_dev`
- Connection string format: `mongodb+srv://<username>:<password>@<cluster>.mongodb.net/<database>?retryWrites=true&w=majority&tls=true`
- Access via MongoDB Compass: Copy `MONGODB_URL` from `backend/.env` file

**Production (MongoDB Atlas):**
- Same Atlas cluster, different database
- Database: `cnstoolsandrepair_db_prod`
- Connection string: Update database name in connection string
- Configure via `.env.production` template

**Technical Details:**
- Uses async Motor driver (not sync PyMongo)
- Connection established on FastAPI app startup via lifespan context manager
- Database instance accessed via `get_database()` function (singleton pattern)
- All queries must use `await`

**Setup Files:**
- Development: Copy `backend/.env.example` to `backend/.env`
- Production: Use `backend/.env.production` template with Atlas credentials

## Data Management

**Limited Admin UI** - Basic admin interface exists at `/admin/settings` (see Admin Interface section below), but most content management is API-only via FastAPI Swagger docs at `/docs`:

### Adding Initial Data
```bash
# Start backend, navigate to http://localhost:8000/docs

# Add tools via POST /api/tools/
{
  "name": "Impact Wrenches",
  "category": "impact_tools",
  "description": "High-torque pneumatic impact wrenches",
  "image_url": "placeholder-tool.jpg",
  "active": true
}

# Add brands via POST /api/brands/
{
  "name": "Ingersoll Rand",
  "logo_url": "placeholder-logo.png",
  "display_order": 1,
  "active": true
}

# Add industries via POST /api/industries/
{
  "name": "Automotive",
  "description": "Auto repair shops and manufacturing",
  "icon": "directions_car",
  "active": true
}
```

### Viewing Quote Submissions
- GET `/api/quotes/` - List all quotes
- GET `/api/quotes/{id}` - View specific quote with photo URLs
- Photos accessible at `/uploads/{filename}`

## Email Configuration

**Current Implementation**: SendGrid API (configured, replaces SMTP)

Email service uses SendGrid Python SDK (not SMTP):
- Install: `pip install sendgrid` (already in requirements.txt)
- Configuration in `backend/.env`: `SENDGRID_API_KEY`, `SENDGRID_FROM_EMAIL`, `NOTIFICATION_EMAIL`
- Free tier: 100 emails/day
- Service file: `app/services/email_service.py`

Email service in `app/services/email_service.py`:
```python
from sendgrid import SendGridAPIClient
from sendgrid.helpers.mail import Mail

# Sends email notification to team when quote submitted
async def send_quote_notification(quote: Quote) -> bool
```

**Setup**:
1. Sign up at https://sendgrid.com (free tier: 100 emails/day)
2. Get API key from SendGrid dashboard
3. Add to `backend/.env`:
   - `SENDGRID_API_KEY=<your_key>`
   - `SENDGRID_FROM_EMAIL=noreply@cnstoolsandrepair.com`
   - `NOTIFICATION_EMAIL=cnstoolsandrepair@gmail.com`
4. Verify domain at Hostinger (DNS records for SPF/DKIM)

## File Upload Handling

**Backend flow:**
1. Quote form submitted as `multipart/form-data`
2. `file_service.py` validates file type/size, saves to `uploads/` with UUID filename
3. Filenames stored in MongoDB quote document
4. FastAPI serves files via `/uploads` static mount

**Limitations:**
- Local file storage (not cloud storage)
- No image optimization/compression
- Max 5 photos, 5MB each (configurable in `app/config.py`)

**Future enhancement:** Replace with Digital Ocean Spaces or AWS S3

## API Design Patterns

### CRUD Pattern (Tools, Brands, Industries)
- **GET /** - List all (with `active_only` query param)
- **POST /** - Create new
- **GET /{id}** - Get by ID
- **PUT /{id}** - Update (partial updates with `exclude_unset=True`)
- **DELETE /{id}** - Soft delete (sets `active=False`, doesn't remove from DB)

### Quote Endpoint Pattern
- **POST /api/quotes/** - Create with `multipart/form-data` (photos + form fields)
- Uses Form() parameters, not JSON body
- Returns created quote immediately
- Email notification sent async (doesn't block response)

## Deployment Architecture

### Docker Compose (Local Development)
- **backend**: Port 8000, hot reload enabled, uploads volume mounted
- **frontend**: Port 80, Nginx serving React build, proxies `/api` to backend

### Production (Digital Ocean)
- **Option 1**: App Platform (recommended) - GitHub auto-deploy, managed SSL
- **Option 2**: Droplet + Docker Compose + Nginx + Let's Encrypt

**Production checklist:**
1. MongoDB Atlas production cluster (separate from dev)
2. Set `CORS_ORIGINS` to production domain only (`https://cnstoolsandrepair.com`)
3. **SEO URLs**: Current domain is `cnstoolsandrepair.com` (production-ready, no changes needed unless using different domain)
   - If different domain needed: Update 7 pages (canonical + og:url + twitter:url), `public/sitemap.xml`, `public/robots.txt`
4. Configure DNS (Hostinger → hosting provider nameservers)
5. Set up SSL certificate (Let's Encrypt or hosting provider managed SSL)
6. Add initial tools/brands/industries data via `/docs` API endpoints
7. Test quote submission and email notification end-to-end
8. Submit `sitemap.xml` to Google Search Console: `https://cnstoolsandrepair.com/sitemap.xml`
9. **Optional**: Create custom OG image (1200x630px image at `frontend/public/og-image.jpg` - site works without it, shows title/description only)

## Important Patterns & Conventions

### Frontend Content Strategy
- **Homepage IndustriesServed component**: Shows 6 featured industries (hardcoded in component)
- **Backend industries API**: Returns all 10 active industries for full Industries page
- **Frontend fallback config**: `frontend/src/config/business.js` provides fallback data when Settings API unavailable
- **Testimonials**: Production warnings in place - replace with real client testimonials before launch

### Backend Data Patterns
- **Soft delete**: CRUD endpoints set `active: false` instead of removing documents
- **ObjectId conversion**: Always convert `_id` to string and rename to `id` before returning to frontend
- **Async everywhere**: All database operations use `await` with Motor driver
- **File uploads**: Multipart form data with `UploadFile` type, saved with UUID filenames

### Admin Interface
- **Hidden routes** (no navigation links): `/admin/login`, `/admin/settings`
- **Authentication**: Basic localStorage token (⚠️ demonstration-only, replace with JWT for production)
- **Protected routes**: `ProtectedAdminRoute` component checks `localStorage.getItem('adminToken')`
- **Settings management**: Update business info, contact details, hours, social media via UI
- **Current token**: `temp-admin-token` (hardcoded in AdminLogin component)
- **Security note**: No backend session validation - strengthen auth before production deployment

## Known Limitations

1. **Basic authentication** - Auth router exists but endpoints are mostly public (strengthen for production)
2. **No rate limiting** - Can be added with FastAPI middleware (e.g., slowapi)
3. **Local file storage** - Photos stored in `backend/uploads/` (consider cloud storage like Digital Ocean Spaces/AWS S3 for production)
4. **No pagination** - Quote list returns all quotes (add pagination for scale beyond ~1000 quotes)
5. **Limited admin UI** - Only business settings editable via `/admin/settings`; tools/brands/industries require API/Swagger docs access
6. **Quote photo upload optimization** - User-uploaded quote photos stored as-is without compression/resizing (hero images ARE optimized via frontend/scripts/optimize-images.js; consider adding client-side compression for quote uploads)
7. **Client-side SEO only** - Meta tags injected via react-helmet-async (works for Google crawlers, but SSR/SSG would be ideal for first-pass indexing)
8. **OG image placeholder** - Social media preview image URL configured but file not created yet (1200x630px needed at `frontend/public/og-image.jpg`)

## Testing Quote Workflow

1. Verify MongoDB Atlas connection (no local MongoDB needed)
2. Start backend: `cd backend && python3 -m uvicorn app.main:app --reload --host 0.0.0.0 --port 8000`
3. Start frontend: `cd frontend && npm run dev`
4. Navigate to http://localhost:5173/quote
5. Fill form with valid data
6. Upload 1-5 photos (JPG/PNG, max 5MB each)
7. Submit form
8. Backend terminal should show:
   ```
   Incoming request: POST http://localhost:8000/api/quotes/
   Email sent! Status code: 202
   Response status: 201
   ```
9. Verify email notification received at `NOTIFICATION_EMAIL`
10. Check http://localhost:8000/api/quotes/ for created quote
11. Verify photos accessible at http://localhost:8000/uploads/{filename}

## Troubleshooting

**MongoDB connection failed:**
- Atlas: Verify connection string includes credentials and cluster address
- Check network connectivity (Atlas requires internet access)
- Verify MongoDB Atlas cluster is not paused (free tier auto-pauses after inactivity)
- Confirm database name is correct (`cnstoolsandrepair_db_dev`)
- Alternative: Use local MongoDB (`mongodb://localhost:27017/`) if Atlas is unavailable

**ERR_CONNECTION_RESET on API requests (WSL):**
- **Root cause**: Backend bound to 127.0.0.1 instead of 0.0.0.0
- **Fix**: Always use `--host 0.0.0.0` when starting uvicorn
- **Verify**: `ss -tuln | grep 8000` should show `0.0.0.0:8000`, not `127.0.0.1:8000`

**Pydantic ValidationError "id field required":**
- **Root cause**: Returning MongoDB document with `_id` instead of `id`
- **Fix**: Convert ObjectId to string, then rename field:
  ```python
  created_quote = convert_objectid_to_str(created_quote)
  created_quote["id"] = created_quote.pop("_id")
  return QuoteResponse(**created_quote)
  ```

**Email not sending:**
- Verify `SENDGRID_API_KEY` is set in `.env`
- Check backend console for "Email sent! Status code: 202"
- Email failures don't block quote creation (non-blocking)
- SendGrid free tier: 100 emails/day limit

**Photos not uploading:**
- Verify `backend/uploads/` directory exists and is writable
- Check file size limits (5MB default)
- Confirm allowed extensions (jpg, jpeg, png, webp)
- Review browser console for frontend errors

**CORS errors:**
- Ensure `CORS_ORIGINS` in `.env` includes frontend URL (http://localhost:5173)
- Check browser network tab for preflight OPTIONS request
- Verify backend is running and accessible

## Design System Guidelines

**Logo:**
- "CNS" text in Russo One font, accent orange (#f97316)
- "TOOLS AND REPAIR" in default text color, uppercase, smaller size
- Logo component in `frontend/src/components/layout/Header.jsx`

**Component patterns:**
- Icons: Material Symbols Outlined with `fontVariationSettings: "'wght' 600"`
- Buttons: `bg-primary text-white font-black px-8 py-4 rounded-xl shadow-xl shadow-primary/30 uppercase`
- Cards: `rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm`
- Sections: `px-6 sm:px-8 lg:px-12 py-16 sm:py-20 lg:py-24`
- Typography: `font-black` for headings, `font-bold` for subheadings, `uppercase` for emphasis
- Section headers: Small orange label (text-accent-orange text-xs uppercase tracking-[0.25em]) above large heading

**Color palette:**
- Primary (#1152d4): CTAs, active states, interactive icons
- Accent Orange (#f97316): Logo "CNS" text, highlights, badges, section labels
- Slate grays: Body text, borders, backgrounds
- Background patterns (alternating for visual separation):
  - Light theme: `bg-white` alternates with `bg-slate-100` (6% brightness difference)
  - Dark theme: `bg-slate-900` alternates with `bg-slate-950`
  - Footer: `bg-slate-100` (light) / `bg-slate-950` (dark)

**Responsive breakpoints:**
- Mobile-first approach (base styles for mobile)
- `sm:` tablet (640px+)
- `lg:` desktop (1024px+)
- Bottom nav visible on mobile, hidden on desktop
