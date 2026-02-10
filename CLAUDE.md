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
- **Target**: Mid to large industrial businesses in automotive, railway, construction
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
cp .env.example .env  # Configure VITE_API_URL
npm run dev      # Dev server on :5173
npm run build    # Production build
npm run preview  # Preview production build
```

### MongoDB (Atlas - Cloud Database)
```bash
# No local MongoDB service needed - using Atlas cloud database

# MongoDB Compass Connection String:
# Copy from backend/.env file (contains credentials - not in git)
# Format: mongodb+srv://<username>:<password>@<cluster>.mongodb.net/<database>?retryWrites=true&w=majority&tls=true

# Database: cnstoolsandrepair_db_dev
```

## Architecture Overview

### Request Flow
1. **Client** → React SPA (port 5173/80)
2. **Frontend** → Axios API client (`frontend/src/services/api.js`)
3. **Backend** → FastAPI routers (`backend/app/routers/`)
4. **Database** → MongoDB (local dev: localhost:27017, production: MongoDB Atlas)
5. **Email** → SendGrid API (quote notifications)
6. **Files** → Local `backend/uploads/` directory

### Backend Architecture (FastAPI)

**Async-first design** using Motor (async MongoDB driver):
- **app/main.py**: FastAPI app with lifespan context manager for DB connection
- **app/database.py**: MongoDB connection singleton (connect on startup, close on shutdown)
- **app/config.py**: Pydantic Settings for environment variables
- **app/models/**: Pydantic schemas for validation (Quote, Tool, Brand, Industry)
- **app/routers/**: API endpoints grouped by resource
- **app/services/**: Business logic (email_service.py, file_service.py)
- **app/utils/**: Helpers (ObjectId → string conversion for JSON serialization)

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

### Frontend Architecture (React)

**Google Stitch template** converted to React components:
- **src/App.jsx**: React Router setup with all routes
- **src/components/layout/**: Header, Footer, BottomNav (mobile-first navigation)
- **src/components/sections/**: Reusable page sections (Hero, HowItWorks, etc.)
- **src/pages/**: Full page components (Home, Quote, Tools, Industries, etc.)
- **src/services/api.js**: Centralized Axios client with API methods

**Design system:**
- Tailwind CSS with custom config (primary: #1152d4, accent: #f97316)
- Montserrat font (bold/black weights for industrial feel)
- Material Symbols Outlined icons
- Dark mode support via Tailwind's `dark:` classes
- Mobile-first with bottom navigation bar

**Quote form specifics:**
- React Hook Form for validation
- React Dropzone for drag-drop photo upload (max 5 photos, 5MB each)
- FormData submission for multipart/form-data
- Photo previews with remove functionality
- Success/error status display after submission

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

// industries - Industries served (dynamic content)
{
  _id: ObjectId,
  name: String,
  description: String,
  icon: String,  // Material Symbol icon name
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

# Email Configuration - SendGrid
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

**No Admin UI** - Content management is API-only. Use FastAPI Swagger docs at `/docs`:

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

**Current Implementation**: SendGrid API (configured)

Email service in `app/services/email_service.py` uses SendGrid Python SDK:
```python
from sendgrid import SendGridAPIClient
from sendgrid.helpers.mail import Mail

# Sends email notification to team when quote submitted
async def send_quote_notification(quote: Quote) -> bool
```

**Setup**:
1. Sign up at https://sendgrid.com (free tier: 100 emails/day)
2. Get API key from SendGrid dashboard
3. Add to `backend/.env` as `SENDGRID_API_KEY`
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
2. Set `CORS_ORIGINS` to production domain only
3. Configure DNS (Hostinger → Digital Ocean nameservers)
4. Set up SSL certificate
5. Add initial tools/brands/industries data
6. Test quote submission and email notification end-to-end

## Known Limitations

1. **No authentication** - API endpoints are public (add auth for production CRUD operations)
2. **No rate limiting** - Can be added with FastAPI middleware
3. **Local file storage** - Photos not in cloud storage
4. **No pagination** - Quote list returns all quotes (add pagination for scale)
5. **No admin UI** - Content management requires API/Swagger docs access
6. **No image optimization** - Uploaded photos stored as-is

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

**Logo:** "CNS" (orange #f97316) + "TOOLS AND REPAIR" (uppercase, default text color)

**Component patterns:**
- Use Material Symbols Outlined for icons
- Button styles: `bg-primary` with `shadow-xl shadow-primary/30`
- Cards: `rounded-2xl` with `border` and subtle `shadow-sm`
- Mobile-first spacing: `px-6 py-16` for sections
- Font weights: `font-black` for headings, `font-bold` for subheadings

**Color usage:**
- Primary (#1152d4): CTAs, active states, icons
- Accent Orange (#f97316): Logo, highlights, badges
- Slate grays: Text, borders, backgrounds
- Dark mode: All components support `dark:` variants
