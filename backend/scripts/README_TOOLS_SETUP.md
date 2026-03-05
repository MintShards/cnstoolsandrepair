# Tools Management Setup Guide

## Overview

The tools management system allows dynamic CRUD operations for the "Tools We Service" section on the website.

## Files Modified

### Backend
- `backend/app/models/tool.py` - Added `icon` and `display_order` fields
- `backend/app/routers/tools.py` - Updated sorting to use `display_order`

### Frontend
- `frontend/src/pages/admin/AdminTools.jsx` - **NEW** Admin CRUD interface
- `frontend/src/components/sections/ToolsPreview.jsx` - Now fetches from API (was hardcoded)
- `frontend/src/App.jsx` - Added `/admin/tools` route
- `frontend/src/components/admin/AdminLayout.jsx` - Added Tools navigation tab

### Migration
- `backend/scripts/seed_tools.py` - **NEW** Seed script for initial 8 tools

## Initial Setup

### 1. Run Migration Script

Populate the database with the initial 8 tool types:

```bash
cd /path/to/cnstoolsandrepair
python3 backend/scripts/seed_tools.py
```

This will create:
1. Impact Wrenches (construction icon)
2. Grinders (auto_fix_high icon)
3. Drills (handyman icon)
4. Sanders (hardware icon)
5. Ratchets (settings icon)
6. Spray Guns (air icon)
7. Nail Guns (push_pin icon)
8. Air Hammers (gavel icon)

### 2. Restart Backend

If backend is running, restart to pick up model changes:

```bash
# Stop current backend (Ctrl+C)
cd backend
python3 -m uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

### 3. Verify Frontend

The frontend should automatically pick up changes (Vite HMR). If not:

```bash
cd frontend
npm run dev
```

## Using the Admin Interface

### Access Admin Panel
1. Navigate to `http://localhost:5173/admin/login`
2. Enter password: `temp-admin-token`
3. Click "Tools Management" tab

### Managing Tools

**Add New Tool:**
- Click "Add Tool" button
- Fill in required fields: Name, Category, Description
- Choose Material icon from https://fonts.google.com/icons
- Set display order (lower numbers appear first)
- Click "Create Tool"

**Edit Existing Tool:**
- Update any field in the tool card
- Click "Save Changes"

**Toggle Visibility:**
- Click eye icon to hide/show tool on website
- Hidden tools remain in database but don't display

**Delete Tool:**
- Click trash icon
- Confirm deletion (soft delete - sets `active: false`)

**Reorder Tools:**
- Change "Display Order" number
- Save changes
- Tools automatically sort by this field

## Database Schema

```javascript
{
  _id: ObjectId,
  name: String,              // e.g., "Impact Wrenches"
  category: String,          // e.g., "impact_tools"
  description: String,       // Brief description
  icon: String,              // Material Symbol name (e.g., "construction")
  image_url: String,         // Placeholder or actual image URL
  display_order: Number,     // Sort order (0-based)
  active: Boolean            // Visibility toggle
}
```

## API Endpoints

All endpoints available at `http://localhost:8000/docs`:

- `GET /api/tools/` - List all active tools
- `GET /api/tools/?active_only=false` - List all tools (including hidden)
- `POST /api/tools/` - Create new tool
- `PUT /api/tools/{id}` - Update tool
- `DELETE /api/tools/{id}` - Soft delete tool (sets active=false)

## Frontend Components

### ToolsPreview (Homepage)
**Location:** `frontend/src/components/sections/ToolsPreview.jsx`
- Fetches active tools from API
- Displays in 2x4 grid (mobile to desktop)
- Shows icon + name only
- Loading skeleton animation

### Tools Page
**Location:** `frontend/src/pages/Tools.jsx`
- Full tools catalog page
- Shows icon + name + description
- Grid layout with more details

### AdminTools
**Location:** `frontend/src/pages/admin/AdminTools.jsx`
- Full CRUD interface
- Card-based layout
- Individual save per tool
- Status indicators (NEW, HIDDEN)

## Material Icons

Browse icons at: https://fonts.google.com/icons

**Usage in icon field:** Just use the icon name (e.g., `build`, `construction`, `handyman`)

**Common tool icons:**
- `build` - General tools
- `construction` - Impact/power tools
- `handyman` - Repair tools
- `hardware` - Mechanical tools
- `settings` - Precision tools
- `air` - Pneumatic/air tools
- `gavel` - Hammers/striking tools

## Troubleshooting

**Tools not showing on homepage:**
- Check tool `active` field is `true`
- Verify backend is running
- Check browser console for API errors

**Admin page not accessible:**
- Ensure logged in via `/admin/login`
- Check localStorage has `admin_token`

**Migration script fails:**
- Verify MongoDB connection in `backend/.env`
- Check `MONGODB_URL` and `DATABASE_NAME` are correct
- Ensure MongoDB service is running (Atlas should be always accessible)

**Icons not displaying:**
- Verify icon name matches Material Symbols exactly
- Check https://fonts.google.com/icons for valid names
- Icon names are case-sensitive

## Next Steps

1. ✅ Run `python3 backend/scripts/seed_tools.py`
2. ✅ Verify tools appear on homepage (`http://localhost:5173/`)
3. ✅ Test admin interface (`http://localhost:5173/admin/tools`)
4. 🔄 Customize tool descriptions as needed
5. 🔄 Replace placeholder images with actual tool photos (optional)
6. 🔄 Add more tool types via admin interface as business expands
