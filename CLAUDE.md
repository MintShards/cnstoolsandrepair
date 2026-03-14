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

# Create .env from example
cp .env.example .env  # Edit with your MongoDB Atlas credentials

# CRITICAL: Must bind to 0.0.0.0 in WSL for Windows browser access
python3 -m uvicorn app.main:app --reload --host 0.0.0.0 --port 8000

# Alternative: Use default binding (works on macOS/Linux, NOT WSL)
python3 -m uvicorn app.main:app --reload

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
# Tool category migration - COMPLETED (script removed)
# All tools now have category field (air_tools, electric_tools, lifting_equipment)
# New tools created via Admin UI automatically include category

# Industry data migration
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

**Homepage ToolsPreview section:**
- Dynamically fetches first 8 active tools from Tools We Repair API (`toolsAPI.list(true).slice(0, 8)`)
- Changes made in Admin Settings → Services Page → Tools We Repair automatically appear on homepage
- Full tool list displayed on Services page, homepage shows preview of first 8 only
- Component manages its own loading state with skeleton UI

**Services page structure (6-section design):**
1. **Our Services**: Flexbox grid with service cards (5 services, centered 5th card on mobile)
2. **ExperienceBadge**: "Professional Service • Factory-Trained Technicians" trust indicator (standalone section)
3. **Tools We Repair**: 3-column categorized tool display (Air Tools, Electric Tools, Lifting Equipment)
   - Uses `/api/tools/by-category` endpoint for categorized data
   - Color-coded columns: Blue (Air), Amber (Electric), Purple (Lifting)
   - Material Symbol icons per category: `air`, `bolt`, `precision_manufacturing`
4. **BrandsCarousel**: Swiper carousel with brand logos
5. **HowItWorks**: 4-step workflow with dynamic content
6. **DualCTA**: Dual call-to-action (Request Quote + Call Now)
7. **Background alternation** (Services page only, independent from homepage):
   - Light theme: white → slate-100 → white → slate-100 → white → slate-100
   - Dark theme: slate-950 → slate-900 → slate-950 → slate-900 → slate-950 → slate-900
   - Components accept `backgroundColor` prop for page-specific overrides

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

// tools_catalog - Repairable tools (dynamic content with categories)
{
  _id: ObjectId,
  name: String,
  icon: String,  // Material Symbol icon name (e.g., "build", "hardware")
  description: String,
  category: Enum["air_tools", "electric_tools", "lifting_equipment"],  // Required field
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

// industries - Industries served (legacy collection, soft-delete pattern)
{
  _id: ObjectId,
  name: String,  // e.g., "Automotive Repair & Body Shops"
  description: String,  // SEO-friendly description
  icon: String,  // Material Symbol icon name (e.g., "directions_car")
  active: Boolean  // false = soft-deleted, true = visible
}

// industries_page_content - Industries page content (singleton document)
{
  _id: ObjectId,
  hero: {
    label: String,       // e.g., "Who We Serve"
    heading: String,     // e.g., "Industries We Support"
    description: String  // Hero description text
  },
  industries: [
    {
      name: String,
      description: String,
      icon: String,           // Material Symbol icon name
      toolBadges: [String],   // Array of tool types (e.g., ["Impact Wrenches", "Grinders"])
      display_order: Number
    }
  ],
  updated_at: DateTime
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

// users - Admin users (authentication)
{
  _id: ObjectId,
  email: String,  // Unique email address (indexed)
  password_hash: String,  // Bcrypt hashed password
  role: String,  // "admin" for admin users
  is_active: Boolean,  // true = active, false = disabled
  created_at: DateTime
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

# JWT Authentication (NEW - see AUTH_SETUP_GUIDE.md)
# Generate with: python -c "import secrets; print(secrets.token_urlsafe(32))"
JWT_SECRET_KEY=<your_jwt_secret_key_here>
JWT_ALGORITHM=HS256
JWT_EXPIRATION_HOURS=8
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
  "category": "air_tools",  // Required: air_tools, electric_tools, or lifting_equipment
  "icon": "build",  // Material Symbol icon name
  "description": "High-torque pneumatic impact wrenches",
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
- **GET /by-category** - Get tools grouped by category (air_tools, electric_tools, lifting_equipment)
  - **IMPORTANT**: This route MUST be defined before `/{id}` in router to avoid matching "by-category" as an ID
  - Returns `{"air_tools": [...], "electric_tools": [...], "lifting_equipment": [...]}`
- **POST /** - Create new (tools require `category` field)
- **GET /{id}** - Get by ID
- **PUT /{id}** - Update (partial updates with `exclude_unset=True`)
- **DELETE /{id}** - Soft delete (sets `active=False`, doesn't remove from DB)

### Quote Endpoint Pattern
- **POST /api/quotes/** - Create with `multipart/form-data` (photos + form fields)
- Uses Form() parameters, not JSON body
- Returns created quote immediately
- Email notification sent async (doesn't block response)

### Page Content Pattern (Singleton Documents)
Three singleton document collections for dynamic page content management:
- **GET/PUT /api/home-content/** - HomePage sections (hero, quick facts, why choose us, how it works, testimonials, service area)
- **GET/PUT /api/industries-content/** - IndustriesPage sections (hero, industries array with tool badges)
- Future: Services page content API (currently services stored in settings collection)

**Pattern characteristics:**
- Single document per collection (not array of documents)
- GET returns existing document or default content if none exists
- PUT updates/creates singleton document with `update_one(..., upsert=True)`
- Frontend components fetch from these APIs on mount with fallback to config
- Admin UI manages via dedicated tabs with accordion-style editors

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
- **Homepage IndustriesServed component**: Shows first 3 industries dynamically from Industries Content API
- **Industries page**: Displays all industries from Industries Content API with dark theme (bg-slate-900)
  - Hero and Industries Grid combined in ONE section
  - Custom Service Area section with bg-slate-950 (only on Industries page)
  - Tool badges displayed as rounded pills for each industry
- **Page content architecture**: Three singleton document patterns for dynamic content management
  - **Home Content API** (`/api/home-content/`): HomePage sections (hero, quick facts, why choose us, how it works, testimonials, service area)
  - **Services Content API** (`/api/services-content/`): ServicesPage sections (services list in settings, tools in separate collection)
  - **Industries Content API** (`/api/industries-content/`): IndustriesPage sections (hero, industries array with tool badges)
- **Frontend fallback config**: `frontend/src/config/business.js` provides fallback data when Settings API unavailable
- **Testimonials**: Production warnings in place - replace with real client testimonials before launch

### Backend Data Patterns
- **Soft delete**: CRUD endpoints set `active: false` instead of removing documents
- **ObjectId conversion**: Always convert `_id` to string and rename to `id` before returning to frontend
- **Async everywhere**: All database operations use `await` with Motor driver
- **File uploads**: Multipart form data with `UploadFile` type, saved with UUID filenames

### Admin Interface
- **Hidden routes** (no navigation links): `/admin/login`, `/admin/settings`
- **Authentication**: JWT-based authentication with email + password (production-ready)
- **Protected routes**: `ProtectedAdminRoute` component validates JWT token with backend
- **Settings management**:
  - **Home Page**: Hero, QuickFacts, Why Choose Us, How It Works, Testimonials, Service Area (managed via `/api/home-content/`)
  - **Services Page**: Services list (settings-based) + Tools catalog (separate tools_catalog collection)
  - **Industries Page**: Hero section + Industries array with tool badges (managed via `/api/industries-content/`)
    - Each industry has: name, description, icon, tool badges array
    - Homepage "Who We Serve" section shows first 3 industries from this API
    - Industries page shows all industries with dark theme
  - **Gallery Page**: Photo gallery management
  - **About Page**: Company information
  - **Contact Page**: Contact details and hours
  - **Global Settings**: Business info, social media, brands
- **Services vs Tools architecture**:
  - **Services**: Stored in settings collection as array, managed via settings API, no individual IDs
  - **Tools**: Separate `tools_catalog` collection with individual documents, full CRUD via tools API, soft-delete with `active` field
  - Both managed in ServicesTab component (`frontend/src/components/admin/tabs/ServicesTab.jsx`) with independent state
  - ServicesTab handles its own save logic - no props passed from AdminSettings.jsx parent
- **User creation**: Run `python scripts/create_admin.py` to create admin users
- **Security features**:
  - Bcrypt password hashing
  - JWT tokens with 8-hour expiration
  - Bearer token authentication
  - Automatic token refresh on 401 errors
  - Role-based access control (admin role required)
- **Setup guide**: See `AUTH_SETUP_GUIDE.md` for complete setup instructions

## Known Limitations

1. **No rate limiting** - Can be added with FastAPI middleware (e.g., slowapi) to prevent brute-force login attempts
2. **No password reset** - Manual password reset requires MongoDB access (see AUTH_SETUP_GUIDE.md)
3. **Local file storage** - Photos stored in `backend/uploads/` (consider cloud storage like Digital Ocean Spaces/AWS S3 for production)
4. **No pagination** - Quote list returns all quotes (add pagination for scale beyond ~1000 quotes)
5. **Limited admin UI** - Most content editable via `/admin/settings` tabs; quote management requires API/Swagger docs access
6. **Quote photo upload optimization** - User-uploaded quote photos stored as-is without compression/resizing (hero images ARE optimized via frontend/scripts/optimize-images.js; consider adding client-side compression for quote uploads)
7. **Client-side SEO only** - Meta tags injected via react-helmet-async (works for Google crawlers, but SSR/SSG would be ideal for first-pass indexing)
8. **OG image placeholder** - Social media preview image URL configured but file not created yet (1200x630px needed at `frontend/public/og-image.jpg`)

## Testing Workflows

### Quote Submission Workflow
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

### Admin Authentication Workflow
1. Create admin user: `cd backend && python scripts/create_admin.py`
2. Navigate to http://localhost:5173/admin/login
3. Login with admin credentials
4. Access admin settings at http://localhost:5173/admin/settings
5. JWT token stored in localStorage (expires in 8 hours)
6. Token automatically refreshed on 401 errors

### Content Management Workflow
1. **Via Admin UI**: Navigate to `/admin/settings` tabs (Home, Services, Industries, Gallery, About, Contact, Global)
2. **Via API Docs**: Navigate to `/docs` for tools, brands, quotes management (requires authentication)
3. **Page Content Management** (Admin UI):
   - **Home tab**: Edit hero, quick facts, why choose us, how it works, testimonials, service area
   - **Services tab**: Edit services list (settings array) + manage tools (separate collection with categories)
   - **Industries tab**: Edit hero section + industries array with tool badges for each industry
   - All managed via singleton document pattern with nested arrays
4. **Tools**: Use `/api/tools/` endpoints (category required: air_tools, electric_tools, lifting_equipment)
5. **Services**: Edit via Admin UI → Services tab (stored in settings collection as array)

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

### Component Architecture Patterns
- **Reusable sections** accept `backgroundColor` prop for page-specific overrides (BrandsCarousel, HowItWorks, DualCTA)
- **Shared components** use default backgrounds from design system, overridden only when needed
- **Example**: Services page overrides backgrounds to create independent alternation pattern from homepage

### Logo
- "CNS" text in Russo One font, accent orange (#f97316)
- "TOOLS AND REPAIR" in default text color, uppercase, smaller size
- Logo component in `frontend/src/components/layout/Header.jsx`

### Component patterns
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

## Production Deployment Checklist

**⚠️ CRITICAL: Complete before going live**

The current development setup uses **local filesystem storage** (`backend/uploads/`) which will **lose all uploaded photos** on production deployment (App Platform container restarts, new deployments). This affects both:
- **Gallery photos** (uploaded via admin panel)
- **Quote request photos** (uploaded by customers)

### Required: Digital Ocean Spaces Integration

**Why Spaces is required:**
- Production containers have ephemeral filesystems (data lost on restart/deploy)
- Local uploads don't survive App Platform deployments
- Quote photo URLs in emails would be broken
- Gallery photos would disappear after each deployment

**Cost:** $5/month (250GB storage + 1TB bandwidth included)

### Deployment Options

#### Option 1: App Platform + Spaces (RECOMMENDED)

**Architecture:**
```
Digital Ocean App Platform ($12/month)
├─ Backend (FastAPI container)
├─ Frontend (React static site)
└─ Auto-deploy from GitHub

Digital Ocean Spaces ($5/month)
└─ Permanent image storage (gallery + quotes)

MongoDB Atlas (Free tier)
└─ Database (already configured)

Total: ~$17/month
```

**Pros:**
- Fully managed platform (no server maintenance)
- Auto-deploy on GitHub push
- Automatic SSL certificates
- Built-in monitoring and logs
- Zero DevOps knowledge required

**Setup:**
1. Create Spaces bucket: `cnstoolsandrepair-photos`
2. Generate Spaces access keys
3. Update backend code (see implementation section below)
4. Create App Platform app from GitHub repo
5. Configure environment variables
6. Deploy automatically

#### Option 2: Droplet + Spaces

**Architecture:**
```
Digital Ocean Droplet ($6-12/month)
├─ Ubuntu server
├─ Docker Compose
├─ Nginx reverse proxy
└─ Manual Let's Encrypt SSL

Digital Ocean Spaces ($5/month)
MongoDB Atlas (Free tier)

Total: ~$11-17/month
```

**Pros:**
- More control over server configuration
- Slightly cheaper ($6 vs $12 for hosting)

**Cons:**
- Manual server setup and maintenance
- Manual SSL certificate renewal
- Manual deployments (git pull + restart)
- Requires DevOps knowledge

### Spaces Implementation Checklist

- [ ] **Create Spaces Bucket**
  - Login to Digital Ocean dashboard
  - Create → Spaces → Choose NYC3 region
  - Name: `cnstoolsandrepair-photos`
  - Set permissions: Public read, private write
  - Generate access keys (save securely)

- [ ] **Update Backend Code**
  - [ ] Install `boto3` library: `pip install boto3`
  - [ ] Update `backend/app/services/file_service.py` to upload to Spaces
  - [ ] Organize folders: `gallery/` and `quotes/`
  - [ ] Update delete endpoint to remove from Spaces
  - [ ] Test locally with Spaces credentials

- [ ] **Migrate Existing Files**
  - [ ] Upload current `backend/uploads/` files to Spaces `gallery/` folder
  - [ ] Update MongoDB records with full Spaces URLs
  - [ ] Test image access from Spaces URLs

- [ ] **Environment Configuration**
  ```env
  # Add to backend/.env.production
  SPACES_REGION=nyc3
  SPACES_BUCKET=cnstoolsandrepair-photos
  SPACES_KEY=<your_spaces_access_key>
  SPACES_SECRET=<your_spaces_secret_key>
  SPACES_ENDPOINT=https://nyc3.digitaloceanspaces.com

  # Update for production
  MONGODB_URL=<atlas_production_connection_string>
  DATABASE_NAME=cnstoolsandrepair_db_prod
  CORS_ORIGINS=https://cnstoolsandrepair.com
  ENVIRONMENT=production
  ```

- [ ] **Test Production Setup**
  - [ ] Upload test photo via admin panel → verify in Spaces
  - [ ] Submit test quote with photo → verify email has working Spaces URL
  - [ ] Delete photo via admin panel → verify removed from Spaces
  - [ ] Check public gallery page displays Spaces images

- [ ] **Deploy to Digital Ocean**
  - [ ] If App Platform: Create app, connect GitHub, set env vars
  - [ ] If Droplet: SSH setup, Docker install, Nginx config, SSL cert
  - [ ] Update DNS (Hostinger → Digital Ocean nameservers)
  - [ ] Test production URL end-to-end

### File Organization in Spaces

```
cnstoolsandrepair-photos/
├── gallery/              # Gallery page photos (admin uploads)
│   ├── uuid1.jpg
│   ├── uuid2.png
│   └── uuid3.webp
│
└── quotes/               # Customer quote request photos
    ├── uuid4.jpg
    ├── uuid5.png
    └── uuid6.jpg
```

### Implementation Code Changes Required

**Backend changes:**
1. `app/services/file_service.py` - Replace local save with Spaces upload
2. `app/routers/gallery.py` - Delete from Spaces instead of local disk
3. `app/routers/quotes.py` - Already uses file_service (automatic)
4. `app/config.py` - Add Spaces settings
5. `requirements.txt` - Add `boto3`

**Frontend changes:**
- Minimal: Images already use URLs from database (automatic switch to Spaces URLs)

**Email template changes:**
- Quote notification emails will show clickable Spaces URLs instead of broken local paths

### Cost Breakdown

| Service | Development | Production | Notes |
|---------|-------------|------------|-------|
| **Hosting** | $0 (local) | $12/month | App Platform Starter |
| **Image Storage** | $0 (local) | $5/month | Spaces 250GB |
| **Database** | $0 | $0 | MongoDB Atlas free tier |
| **SSL Certificate** | N/A | $0 | Included with App Platform |
| **Domain** | N/A | ~$15/year | cnstoolsandrepair.com |
| **Total** | $0 | **~$17/month** | Plus domain annual fee |

### Storage Estimates

**Year 1 projections:**
- Gallery photos: 27 current + ~10 new/year = ~70MB
- Quote photos: ~100 quotes/year × 2 photos × 2MB = ~400MB
- **Total: ~470MB** (well under 250GB Spaces limit)

**Spaces pricing:**
- 250GB storage included in $5/month
- 1TB bandwidth included
- Additional: $0.02/GB storage, $0.01/GB bandwidth

### Security Notes

**Quote photo privacy:**
- Current implementation: Public URLs with UUID filenames (security through obscurity)
- UUIDs are hard to guess: `7eabdf02-4413-406c-bcd0-2c3f5a49f901.jpg`
- Alternative: Implement signed URLs with expiration (more complex, not needed initially)

**Spaces permissions:**
- Gallery folder: Public read (photos shown on public gallery page)
- Quotes folder: Public read (required for email links to work)
- Both folders: Private write (only backend can upload/delete)

### Pre-Production Testing

Before going live, verify:
1. ✅ All pages complete and tested
2. ✅ Admin authentication working
3. ✅ Quote form with photo upload tested
4. ✅ Gallery admin UI tested
5. ✅ Email notifications working
6. ✅ Spaces integration tested locally
7. ✅ Production environment variables configured
8. ✅ Domain DNS configured
9. ✅ SSL certificate working
10. ✅ End-to-end user flow tested on production URL

### Rollback Plan

If production deployment issues occur:
1. Keep local development environment running
2. Spaces data is persistent (no data loss)
3. MongoDB Atlas backups available (point-in-time recovery)
4. Can redeploy from git commit history
5. Local `uploads/` backup before migration (safety net)
