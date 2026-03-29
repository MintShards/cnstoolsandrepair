# CNS Tool Repair

**B2B industrial pneumatic tool repair website** serving Surrey, BC and surrounding areas. Built with the FARM stack (FastAPI + React + MongoDB).

**Business Model**: Local on-site service where customers bring tools for professional diagnosis and repair.

**Target Market**: Mid to large industrial businesses across 10 key sectors:
- Automotive & Fleet Management
- Manufacturing & Metal Fabrication
- Construction & Heavy Equipment
- Oil & Gas Operations
- Aerospace & Marine
- Mining & MRO (Maintenance, Repair, Operations)

## Tech Stack

### Backend
- **FastAPI** - Modern async Python web framework
- **Motor** - Async MongoDB driver for high-performance database operations
- **Pydantic** - Data validation and settings management
- **MongoDB Atlas** - Cloud database (no local MongoDB required)
- **SendGrid** - Transactional email service for notifications
- **JWT Authentication** - Secure admin authentication with python-jose
- **Passlib + Bcrypt** - Password hashing and verification
- **Pillow** - Image processing for photo uploads

### Frontend
- **React 18** - Modern UI library with hooks
- **Vite** - Lightning-fast build tool and dev server
- **Tailwind CSS** - Utility-first CSS framework
- **React Router v6** - Client-side routing with component-based architecture
- **React Hook Form** - Performant form validation and management
- **React Dropzone** - Drag-and-drop file uploads with preview
- **React Helmet Async** - SEO meta tags, Open Graph, structured data
- **Axios** - HTTP client with interceptors for API calls
- **Swiper** - Touch-enabled carousel for brand logos

### Design System
- **Fonts**: Russo One (logo), Montserrat (body)
- **Icons**: Material Symbols Outlined
- **Colors**: Primary blue (#1152d4), Accent orange (#f97316)
- **Dark Mode**: Built-in theme switching with context API

### Deployment
- **Digital Ocean Spaces** - Object storage for production file uploads (required)
- **Digital Ocean App Platform** - Recommended hosting (or Droplet with Docker)
- **MongoDB Atlas** - Production database cluster
- **Hostinger DNS** - Domain management pointing to Digital Ocean

## Features

### Customer-Facing
- ✅ **Quote Request System** - Online quote submission with multi-photo upload (max 5 photos, 5MB each)
- ✅ **Industries Page** - Dynamic content showcasing 10 target industry sectors with tool badges
- ✅ **Services Catalog** - Categorized repairable tools (air tools, electric tools, lifting equipment)
- ✅ **Brand Partners** - Carousel display of supported brands with logos
- ✅ **Contact Form** - Direct contact with email notifications
- ✅ **Responsive Design** - Mobile-first with bottom navigation and touch-optimized UI
- ✅ **Dark Mode** - Built-in theme switching with persistent preference
- ✅ **SEO Optimized** - Meta tags, Open Graph, structured data, sitemap.xml, robots.txt

### Admin Interface (Hidden)
- ✅ **JWT Authentication** - Secure admin login with 8-hour session expiration
- ✅ **Content Management** - Edit all page sections (hero, services, about, contact, testimonials)
- ✅ **Tools CRUD** - Manage repairable tools catalog with categories and soft-delete
- ✅ **Gallery Management** - Photo gallery with WebP optimization
- ✅ **Quote Management** - View and manage customer quote requests
- ✅ **Settings Dashboard** - Centralized business settings with tabbed interface

### Backend Architecture
- ✅ **RESTful API** - FastAPI with automatic OpenAPI documentation at `/docs`
- ✅ **Async Operations** - Non-blocking database and email operations using Motor
- ✅ **File Upload** - Multipart form handling with UUID filenames and validation
- ✅ **Email Notifications** - SendGrid integration for quote and contact form notifications
- ✅ **Request Logging** - Middleware for API request tracking and debugging

## Project Structure

```
cnstoolsandrepair/
├── backend/                # FastAPI backend
│   ├── app/
│   │   ├── models/        # Pydantic models
│   │   ├── routers/       # API endpoints
│   │   ├── services/      # Business logic
│   │   └── utils/         # Helper functions
│   ├── uploads/           # Uploaded files
│   └── requirements.txt
├── frontend/              # React frontend
│   ├── src/
│   │   ├── components/    # React components
│   │   ├── pages/         # Page components
│   │   └── services/      # API client
│   └── package.json
└── docker-compose.yml     # Docker orchestration
```

## Setup Instructions

### Prerequisites
- Python 3.11+
- Node.js 20+
- Docker & Docker Compose (optional)
- MongoDB Atlas account

### 1. MongoDB Atlas Setup

1. Create a free MongoDB Atlas account at https://www.mongodb.com/cloud/atlas
2. Create a new cluster (M0 free tier)
3. Add a database user
4. Whitelist your IP address (or 0.0.0.0/0 for development)
5. Get your connection string

### 2. Backend Setup

```bash
cd backend

# Create virtual environment
python3 -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate

# Install dependencies
pip install -r requirements.txt

# Create .env file
cp .env.example .env

# Edit .env and add your credentials:
# - MongoDB Atlas connection string
# - SendGrid API key (free tier: 100 emails/day)
# - JWT secret key (generate with: python -c "import secrets; print(secrets.token_urlsafe(32))")
# See "Environment Variables" section below for complete list

# Run backend
# IMPORTANT FOR WSL USERS: Must bind to 0.0.0.0 for Windows browser access
python3 -m uvicorn app.main:app --reload --host 0.0.0.0 --port 8000

# For Linux/Mac (not WSL):
# python3 -m uvicorn app.main:app --reload
```

Backend will be available at:
- **WSL/Windows**: http://localhost:8000
- **Linux/Mac**: http://127.0.0.1:8000
- **API Docs**: http://localhost:8000/docs (Swagger UI)

### 3. Frontend Setup

```bash
cd frontend

# Install dependencies
npm install

# Create .env file
cp .env.example .env

# Run frontend
npm run dev
```

Frontend will be available at http://localhost:5173

### 4. Docker Setup (Alternative)

```bash
# Create .env file in root directory with MongoDB credentials
cp backend/.env.example .env

# Build and run containers
docker-compose up --build

# Frontend: http://localhost
# Backend: http://localhost:8000
# API Docs: http://localhost:8000/docs
```

## Environment Variables

### Backend (.env)
```env
# MongoDB Atlas (required)
MONGODB_URL=mongodb+srv://<user>:<pass>@<cluster>.mongodb.net/<db>?retryWrites=true&w=majority&tls=true
DATABASE_NAME=cnstoolsandrepair_db_dev  # Use _prod for production

# CORS (required)
CORS_ORIGINS=http://localhost:5173,http://localhost:3000  # Add production domain for prod

# SendGrid Email (required)
SENDGRID_API_KEY=<your_sendgrid_api_key>  # Get from https://app.sendgrid.com/settings/api_keys
SENDGRID_FROM_EMAIL=noreply@cnstoolrepair.com  # Must be verified sender
NOTIFICATION_EMAIL=cnstoolrepair@gmail.com  # Receives quote/contact notifications

# JWT Authentication (required for admin)
JWT_SECRET_KEY=<generate_with_secrets.token_urlsafe(32)>  # Run: python -c "import secrets; print(secrets.token_urlsafe(32))"
JWT_ALGORITHM=HS256
JWT_EXPIRATION_HOURS=8

# File Upload (optional - defaults shown)
MAX_FILE_SIZE=5242880  # 5MB in bytes
ALLOWED_EXTENSIONS=jpg,jpeg,png,webp
```

**Generate JWT Secret**:
```bash
python -c "import secrets; print(secrets.token_urlsafe(32))"
```

**SendGrid Setup** (Free tier: 100 emails/day):
1. Sign up at https://sendgrid.com
2. Verify sender identity (email or domain)
3. Create API key: Settings → API Keys → Create API Key
4. Copy key to `SENDGRID_API_KEY` (starts with `SG.`)

### Frontend (.env) - Optional
```env
VITE_API_URL=http://localhost:8000  # Only needed if deploying frontend separately
```
Note: Vite proxy handles API routing in development (see `vite.config.js`)

## API Endpoints

### Quotes (Customer Submissions)
- `POST /api/quotes/` - Create quote with photos (multipart/form-data)
- `GET /api/quotes/` - List all quotes (admin)
- `GET /api/quotes/{id}` - Get quote by ID
- `DELETE /api/quotes/{id}` - Delete quote (admin)

### Tools Catalog (Categorized)
- `GET /api/tools/` - List all tools (optional `?active_only=true`)
- `GET /api/tools/by-category` - Get tools grouped by category (air_tools, electric_tools, lifting_equipment)
- `POST /api/tools/` - Create tool (requires `category` field)
- `GET /api/tools/{id}` - Get tool by ID
- `PUT /api/tools/{id}` - Update tool (partial updates supported)
- `DELETE /api/tools/{id}` - Soft delete (sets `active=false`)

### Brands (Logo Carousel)
- `GET /api/brands/` - List brands (optional `?active_only=true`)
- `POST /api/brands/` - Create brand with logo upload
- `GET /api/brands/{id}` - Get brand by ID
- `PUT /api/brands/{id}` - Update brand
- `DELETE /api/brands/{id}` - Soft delete

### Page Content (Singleton Documents)
- `GET /api/home-content/` - Get home page sections (hero, services, testimonials, etc.)
- `PUT /api/home-content/` - Update home page content (upsert)
- `GET /api/industries-content/` - Get industries page content (hero + industries array)
- `PUT /api/industries-content/` - Update industries content (upsert)

### Settings (Admin)
- `GET /api/settings/` - Get business settings
- `PUT /api/settings/` - Update settings (upsert)

### Gallery
- `GET /api/gallery/` - List gallery photos
- `POST /api/gallery/` - Upload photo
- `DELETE /api/gallery/{id}` - Delete photo

### Authentication (Admin)
- `POST /api/auth/login` - Login (returns JWT token)
- `GET /api/auth/me` - Get current user (requires Authorization header)

### Contact
- `POST /api/contact/` - Send contact message (triggers email notification)

**Interactive API Documentation**: http://localhost:8000/docs (Swagger UI with "Try it out" feature)

## Admin Authentication Setup

**⚠️ CRITICAL**: Create an admin user before accessing `/admin/login`

### Create First Admin User
```bash
cd backend
source venv/bin/activate
python scripts/create_admin.py

# Follow prompts:
# Email: admin@cnstoolrepair.com
# Password: [secure password]
```

### Admin Access
1. Navigate to `/admin/login` (hidden route, no nav link)
2. Login with credentials
3. Access settings dashboard at `/admin/settings`
4. JWT token valid for 8 hours (auto-logout after expiration)

### Admin Features
- **Home Tab**: Edit hero section, quick facts, testimonials
- **Services Tab**: Manage services array (no IDs, just descriptions)
- **Industries Tab**: Edit industries page hero and industry sectors
- **Gallery Tab**: Upload/delete photos with WebP optimization
- **About Tab**: Edit about page content and team info
- **Contact Tab**: Update contact information and social links
- **Global Tab**: Business hours, metadata, site-wide settings

### Password Management
- **No password reset feature** - Manual reset required via MongoDB
- See `AUTH_SETUP_GUIDE.md` for manual password reset instructions
- Recommendation: Use strong password manager

## Database Schema

MongoDB collections in `cnstoolsandrepair_db_dev`:

```javascript
// quotes - Customer quote requests
{
  _id: ObjectId,
  customer_name: string,
  email: string,
  phone: string,
  company_name: string,
  tool_description: string,
  issue_description: string,
  photos: [string],  // Array of /uploads/{uuid}.ext
  created_at: datetime,
  status: string
}

// tools_catalog - Repairable tools (categorized)
{
  _id: ObjectId,
  name: string,
  category: "air_tools" | "electric_tools" | "lifting_equipment",
  description: string,
  active: boolean,
  created_at: datetime
}

// brands - Brand logos for carousel
{
  _id: ObjectId,
  name: string,
  logo_url: string,  // /uploads/{uuid}.ext
  active: boolean,
  created_at: datetime
}

// industries_page_content - Industries page (singleton)
{
  _id: ObjectId,
  hero: { heading, subheading },
  industries: [
    {
      title: string,
      description: string,
      tools: [string]  // Tool badges like "Impact Wrenches"
    }
  ]
}

// settings - Business settings (singleton)
{
  _id: ObjectId,
  services: [{ title, description, icon }],
  about: { heading, paragraphs },
  contact: { phone, email, address, hours },
  social: { facebook, instagram, linkedin },
  metadata: { title, description }
}

// gallery - Photo gallery
{
  _id: ObjectId,
  photo_url: string,  // /uploads/{uuid}.webp
  caption: string,
  created_at: datetime
}

// users - Admin authentication
{
  _id: ObjectId,
  email: string (unique),
  hashed_password: string,  // Bcrypt hash
  is_active: boolean,
  created_at: datetime
}
```

**ObjectId Handling**: Backend converts `_id` to `id` (string) before returning to frontend.

## Deployment to Digital Ocean

**⚠️ CRITICAL**: Local file storage (`backend/uploads/`) will **lose all photos** on deployment. Must integrate **Digital Ocean Spaces** (object storage) before production.

See **`DEPLOYMENT.md`** for complete production deployment guide including:
- Digital Ocean Spaces setup and code integration
- Environment configuration for production
- MongoDB Atlas production database setup
- Cost breakdown (~$17/month including Spaces)
- Security checklist and DNS configuration

### Quick Production Checklist
- [ ] ⚠️ **Integrate Digital Ocean Spaces** (required for file uploads)
- [ ] Create MongoDB Atlas production cluster (`cnstoolsandrepair_db_prod`)
- [ ] Generate production JWT secret key
- [ ] Verify SendGrid sender domain
- [ ] Set `CORS_ORIGINS` to production domain only
- [ ] Configure Hostinger DNS → Digital Ocean
- [ ] Setup SSL certificate (Let's Encrypt or DO managed)
- [ ] Test quote submission + email end-to-end
- [ ] Create admin user in production database
- [ ] Submit sitemap.xml to Google Search Console

## Adding Initial Data

Use the API docs (http://localhost:8000/docs) to add initial data:

1. **Add Tools** - POST to `/api/tools/`
2. **Add Brands** - POST to `/api/brands/`
3. **Add Industries** - POST to `/api/industries/`

Or use Python script:
```python
import requests

tools = [
    {"name": "Impact Wrenches", "category": "impact_tools", "description": "..."},
    {"name": "Pneumatic Grinders", "category": "grinding", "description": "..."},
]

for tool in tools:
    requests.post("http://localhost:8000/api/tools/", json=tool)
```

## Development Workflows

### 1. Quote Submission Test
**Purpose**: Verify end-to-end quote flow with photo upload and email notification

```bash
# Start backend (WSL users: must use --host 0.0.0.0)
cd backend && source venv/bin/activate
python3 -m uvicorn app.main:app --reload --host 0.0.0.0 --port 8000

# In new terminal: Start frontend
cd frontend && npm run dev
```

**Test Steps**:
1. Navigate to http://localhost:5173/quote
2. Fill out form with test data
3. Upload 1-5 photos (max 5MB each, jpg/png/webp)
4. Submit form
5. **Verify backend logs**: "Email sent! Status code: 202"
6. **Check email**: Notification sent to `NOTIFICATION_EMAIL`
7. **Verify uploads**: Check `backend/uploads/` for UUID-named files
8. **View in admin**: Login to `/admin/settings` to see quote

### 2. Admin Content Management
**Purpose**: Test admin authentication and content editing

```bash
# Create admin user (one-time setup)
cd backend && source venv/bin/activate
python scripts/create_admin.py
```

**Test Steps**:
1. Navigate to http://localhost:5173/admin/login
2. Login with credentials
3. Access `/admin/settings` dashboard
4. **Edit content**: Try updating hero section text
5. **Verify frontend**: Check homepage reflects changes
6. **Check persistence**: Refresh admin page to confirm save

### 3. Tools CRUD Operations
**Purpose**: Test tools catalog with categories and soft-delete

**Via Swagger UI** (recommended for testing):
1. Navigate to http://localhost:8000/docs
2. **Create tool**: POST `/api/tools/` with `{ "name": "Test Tool", "category": "air_tools", "description": "..." }`
3. **List all**: GET `/api/tools/` to see all tools
4. **By category**: GET `/api/tools/by-category` to see grouped tools
5. **Soft delete**: DELETE `/api/tools/{id}` (sets `active=false`)
6. **Active only**: GET `/api/tools/?active_only=true` to verify deleted tool hidden

### 4. Image Optimization
**Purpose**: Optimize images before deployment (WebP + JPG fallback)

```bash
cd frontend
node scripts/optimize-images.js

# Output: Generates WebP + JPG versions
# Max size: 400KB, Quality: 80%
# Location: Overwrites originals with optimized versions
```

### 5. Database Inspection
**View data with MongoDB Compass**:
```
Connection String: [Copy MONGODB_URL from backend/.env]
Database: cnstoolsandrepair_db_dev
Collections: quotes, tools_catalog, brands, settings, industries_page_content, gallery, users
```

### Common Development Tasks

**Clear all quotes** (via MongoDB shell):
```bash
# In MongoDB Compass or Atlas UI
db.quotes.deleteMany({})
```

**Reset admin password**:
```bash
cd backend
python scripts/create_admin.py  # Overwrites existing user with same email
```

**View API request logs**:
```bash
# Backend terminal shows all requests:
# INFO:     127.0.0.1:54321 - "POST /api/quotes/ HTTP/1.1" 201 Created
```

**Check Vite proxy config** (if API calls fail):
```javascript
// frontend/vite.config.js
server: {
  proxy: {
    '/api': 'http://localhost:8000',
    '/uploads': 'http://localhost:8000'
  }
}
```

## Troubleshooting

### ERR_CONNECTION_RESET (WSL Users)
**Symptom**: Frontend can't reach backend API on Windows/WSL

**Fix**:
```bash
# Must bind to 0.0.0.0 instead of 127.0.0.1
python3 -m uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

**Verify**:
```bash
ss -tuln | grep 8000
# Should show: 0.0.0.0:8000 (not 127.0.0.1:8000)
```

### Pydantic ValidationError "id field required"
**Symptom**: API returns 500 error when creating/updating resources

**Cause**: Forgot to convert MongoDB `_id` to `id` string

**Fix**:
```python
from app.utils.objectid import convert_objectid_to_str

# After database operation:
created_quote = await db.quotes.find_one({"_id": result.inserted_id})
created_quote = convert_objectid_to_str(created_quote)
created_quote["id"] = created_quote.pop("_id")  # Rename _id to id
return QuoteResponse(**created_quote)
```

### MongoDB Connection Failed
**Symptom**: `ServerSelectionTimeoutError` on startup

**Checks**:
1. Verify connection string in `.env` has credentials
2. Check Atlas cluster not paused (free tier auto-pauses after inactivity)
3. Confirm database name: `cnstoolsandrepair_db_dev`
4. Verify IP whitelist in Atlas (0.0.0.0/0 for development)

### Email Not Sending
**Symptom**: Quote submitted but no email received

**Checks**:
1. Verify `SENDGRID_API_KEY` in `.env`
2. Check backend logs for "Email sent! Status code: 202"
3. Verify sender email in SendGrid dashboard
4. Check spam folder for notifications
5. Free tier limit: 100 emails/day

### Tools Route 404 Error
**Symptom**: `/api/tools/by-category` returns 404 or matches as ID

**Fix**: Ensure `/by-category` route defined **before** `/{id}` route in router

```python
# CORRECT ORDER
@router.get("/by-category")
async def get_tools_by_category(): ...

@router.get("/{id}")
async def get_tool(id: str): ...
```

### Dark Mode Not Persisting
**Symptom**: Dark mode resets on page refresh

**Check**: Verify `localStorage` working in browser console:
```javascript
localStorage.getItem('theme')  // Should return 'dark' or 'light'
```

## Known Limitations

1. **No rate limiting** - Production needs slowapi middleware for brute-force protection
2. **No password reset** - Admin password reset requires manual MongoDB update (see `AUTH_SETUP_GUIDE.md`)
3. **Local file storage** - Production requires Digital Ocean Spaces integration (see `DEPLOYMENT.md`)
4. **No pagination** - Quote/tools lists return all results (add pagination for >1000 records)
5. **Client-side SEO** - Meta tags via react-helmet-async (SSR/SSG would improve crawlability)
6. **No image CDN** - Production should use Spaces CDN for faster global delivery
7. **Single admin role** - No role-based access control (all admins have full access)

## Additional Documentation

- **`AUTH_SETUP_GUIDE.md`** - Admin authentication setup, password reset procedures
- **`DEPLOYMENT.md`** - Production deployment guide with Digital Ocean Spaces integration
- **`OG_IMAGE_GUIDE.md`** - Creating social media preview images for SEO
- **`CLAUDE.md`** - Development notes and patterns for Claude Code AI

## Architecture Decisions

### Why SendGrid Instead of SMTP?
- **Reliability**: Better deliverability than Gmail SMTP
- **Scalability**: Handles high volume without rate limits
- **Features**: Email tracking, templates, analytics
- **Cost**: Free tier (100 emails/day) sufficient for MVP

### Why MongoDB Atlas?
- **No local setup**: Cloud-first, no MongoDB installation required
- **Free tier**: M0 cluster sufficient for development
- **Scalability**: Easy upgrade path to production
- **Backups**: Automated backups on paid tiers

### Why JWT for Admin Auth?
- **Stateless**: No session storage required
- **Scalable**: Works across multiple servers
- **Standard**: Industry-standard authentication
- **Expiration**: Built-in 8-hour timeout for security

### Why Local File Storage (Development)?
- **Simplicity**: No cloud setup for MVP development
- **Cost**: Free for development/testing
- **Speed**: Fast local access for development
- **Production**: Upgrade to Spaces before deployment (see `DEPLOYMENT.md`)

## Support

For questions or issues, contact the development team.

## License

Proprietary - CNS Tool Repair © 2024
