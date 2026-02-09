# CNS Tools and Repair - Implementation Notes

## Project Overview

**Client**: CNS Tools and Repair
**Location**: Surrey, BC, Canada
**Business Type**: B2B Industrial Pneumatic Tool Repair
**Tech Stack**: FARM (FastAPI + React + MongoDB Atlas)

## Business Requirements

### Services Offered
1. **Pneumatic Tool Repair** (Primary)
2. **Tool Calibration** (Specialty tools)
3. **Equipment Rental** (While tools are repaired)
4. **Used Tool Sales** (Occasional)
5. **Contract Repair Service** (B2B agreements)

### Target Industries
- Automotive repair and manufacturing
- Railway maintenance
- Construction companies
- Industrial businesses using air tools as primary equipment

### Target Business Size
- Mid to large industrial businesses
- B2B focused (not retail)

### Service Area
- Currently on-site in Surrey, BC
- Local service (no shipping yet, customers bring tools)

## Key Features Implemented

### 1. Quote Request System
- **Purpose**: Customers submit repair requests online
- **Process**: Customers must bring tools to facility for diagnosis
- **Form Fields**:
  - Company information (name, contact person, email, phone)
  - Tool details (type, brand, model, quantity)
  - Problem description (min 10 characters)
  - Urgency level (low/medium/high)
  - Photo upload (max 5 photos, 5MB each)
- **Backend**: Photos saved to `/uploads`, quote stored in MongoDB
- **Email Notification**: Team receives email on each quote submission

### 2. Dynamic Content Management
All content is CRUD-enabled via API:

**Tools We Repair**:
- Admin can add/edit/delete tool categories
- Fields: name, category, description, image_url, active
- Display: Grid layout on Tools page

**Brands**:
- Showcase of brands serviced
- Fields: name, logo_url, display_order, active
- Display: Hero section on homepage (future enhancement)

**Industries**:
- Industries served by CNS
- Fields: name, description, icon, active
- Display: Industries page with cards

### 3. Email Notifications
- **Service**: SMTP via aiosmtplib
- **Trigger**: New quote submission
- **Recipients**: Team email (configurable)
- **Content**: Complete quote details + photo links
- **Configuration**: Gmail with app password or SendGrid

### 4. Responsive Design
- Mobile-first approach (from Google Stitch template)
- Bottom navigation for mobile users
- Sticky top header
- Dark mode support built-in

## Technical Implementation

### Backend Architecture

**Framework**: FastAPI (async Python web framework)
**Database**: MongoDB Atlas (cloud-hosted)
**File Storage**: Local `/uploads` directory (can be upgraded to Digital Ocean Spaces)

**Project Structure**:
```
backend/app/
├── models/         # Pydantic schemas (Quote, Tool, Brand, Industry)
├── routers/        # API endpoints (quotes, tools, brands, industries, contact)
├── services/       # Business logic (email, file upload)
├── utils/          # Helpers (ObjectId conversion)
├── database.py     # MongoDB connection
├── config.py       # Environment variables
└── main.py         # FastAPI app entry point
```

**Database Collections**:
- `quotes` - Customer quote requests
- `tools_catalog` - Repairable tools
- `brands` - Brand logos/info
- `industries` - Industry sectors served

**API Features**:
- Full CRUD for all collections
- File upload handling (multipart/form-data)
- Email notifications (async)
- CORS configured for frontend
- Static file serving for uploads

### Frontend Architecture

**Framework**: React 18 with Vite
**Styling**: Tailwind CSS (from Google Stitch template)
**Routing**: React Router v6
**Forms**: React Hook Form
**File Upload**: React Dropzone

**Project Structure**:
```
frontend/src/
├── components/
│   ├── layout/     # Header, Footer, BottomNav
│   └── sections/   # Hero, HowItWorks, etc.
├── pages/          # Home, Services, Tools, Industries, Quote, About, Contact
├── services/       # API client (Axios)
├── App.jsx         # Main router
└── main.jsx        # Entry point
```

**Design System** (from Google Stitch):
- **Primary Color**: `#1152d4` (blue)
- **Accent Color**: `#f97316` (orange)
- **Font**: Montserrat (bold, display-focused)
- **Icons**: Material Symbols Outlined
- **Logo**: "CNS" in orange + "TOOLS AND REPAIR" in uppercase

**Key Pages**:
1. **Home** - Hero, How It Works, Why Choose Us, CTA, Testimonials
2. **Services** - All 4 services on one page
3. **Tools** - Dynamic grid from API
4. **Industries** - Dynamic cards from API
5. **Quote** - Full quote form with photo upload
6. **About** - Company information
7. **Contact** - Contact information

## Deployment Strategy

### Development Environment
- **Backend**: `uvicorn app.main:app --reload` on port 8000
- **Frontend**: `npm run dev` on port 5173
- **Database**: MongoDB Atlas (free M0 tier)
- **Docker**: `docker-compose up` for full stack

### Production Environment

**Hosting**: Digital Ocean
**Domain**: Hostinger DNS → Digital Ocean
**SSL**: Let's Encrypt (auto-renewal)

**Option 1: App Platform** (Recommended for simplicity)
- GitHub integration
- Auto-deploy on push
- Managed SSL
- Environment variables via dashboard

**Option 2: Droplet + Docker**
- More control
- Docker Compose deployment
- Nginx reverse proxy
- Manual SSL setup

### Environment Variables Required

**Backend (.env)**:
```
MONGODB_URL=mongodb+srv://username:password@cluster.mongodb.net/
DATABASE_NAME=cns_tools
CORS_ORIGINS=https://cnstools.com
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your-email@gmail.com
SMTP_PASSWORD=your-app-password
SMTP_FROM=your-email@gmail.com
NOTIFICATION_EMAIL=team@cnstools.com
```

**Frontend (.env)**:
```
VITE_API_URL=https://api.cnstools.com
```

## Future Enhancements

### Phase 2 (Future)
1. **Admin Dashboard** - Web interface for content management (currently API-only)
2. **Customer Portal** - Login system for quote status tracking (handled by separate system)
3. **Brand Logos Showcase** - Hero section on homepage with brand logos
4. **Testimonials Management** - Dynamic testimonials instead of hardcoded
5. **Image Upload for Tools/Brands** - Direct image upload instead of URLs
6. **Cloud Storage** - Digital Ocean Spaces instead of local uploads
7. **Advanced Email** - SendGrid templates, customer confirmations
8. **Analytics** - Track quote submissions, popular tools, etc.
9. **Blog/Resources** - Repair tips, case studies
10. **Contract Service Page** - Dedicated page for contract repair services

### Phase 3 (Future)
1. **Multi-language** - Support for different languages
2. **SMS Notifications** - Twilio integration
3. **Shipping Integration** - If expanding beyond local service
4. **Inventory Management** - Track parts, tools in repair
5. **Scheduling System** - Appointment booking
6. **Payment Processing** - Online payments for quotes

## Known Limitations

1. **No Admin UI** - Content management is API-only (use Swagger docs or write scripts)
2. **Local File Storage** - Photos stored locally (not cloud storage yet)
3. **No Authentication** - Public API endpoints (fine for read, but CRUD needs protection in production)
4. **No Image Optimization** - Uploaded photos not compressed/resized
5. **No Rate Limiting** - API has no rate limiting (can be added with FastAPI middleware)
6. **No Pagination** - Quote list returns all quotes (fine for small scale)

## Testing Checklist

### Backend Testing
- [ ] MongoDB connection successful
- [ ] All API endpoints work (test via /docs)
- [ ] File upload works (test with Postman)
- [ ] Email notification sends correctly
- [ ] CORS allows frontend requests
- [ ] Environment variables load correctly

### Frontend Testing
- [ ] All pages load without errors
- [ ] Quote form validation works
- [ ] Photo upload works (drag-drop + click)
- [ ] Quote submission successful
- [ ] Tools/Industries fetch from API
- [ ] Mobile navigation works
- [ ] Dark mode toggles (if implemented)
- [ ] All links work

### Integration Testing
- [ ] Full quote submission workflow end-to-end
- [ ] Email received with correct information
- [ ] Photos accessible via /uploads URL
- [ ] Dynamic content displays correctly

## Support & Maintenance

### Regular Tasks
1. **Monitor MongoDB Atlas** - Check storage usage (free tier limit)
2. **Check Email Logs** - Ensure notifications sending
3. **Update Dependencies** - Security patches
4. **Backup Uploads** - Photo files (if using local storage)
5. **Clean Old Quotes** - Archive or delete after processing

### Troubleshooting

**Email Not Sending**:
- Check SMTP credentials
- Verify Gmail app password (not regular password)
- Check email service logs in backend console

**Photos Not Uploading**:
- Check uploads directory permissions
- Verify file size limits
- Check browser console for errors

**API Not Connecting**:
- Verify CORS settings
- Check VITE_API_URL in frontend
- Ensure backend is running

**MongoDB Connection Failed**:
- Check connection string
- Verify IP whitelist in Atlas
- Confirm database user credentials

## Development Notes

**Google Stitch Template**:
- Original HTML/CSS template converted to React components
- Maintained exact styling and structure
- Added routing and dynamic content
- Preserved mobile-first design with bottom navigation

**Design Decisions**:
- Chose React Hook Form for form management (simpler than Formik)
- Used React Dropzone for photo upload (better UX than basic file input)
- Kept quote form on separate page (better UX than modal)
- Tools/Brands/Industries are dynamic (future admin panel)
- Quote status tracking left to separate system (as requested)

**Code Organization**:
- Backend: Clean separation of models, routers, services
- Frontend: Component-based architecture
- Both: Environment-based configuration
- Docker: Single docker-compose for full stack

## Contact Information (Placeholder)

**Business**: CNS Tools and Repair
**Location**: Surrey, BC, Canada
**Phone**: (604) 555-0123
**Email**: info@cnstools.com
**Hours**: Monday - Friday, 8:00 AM - 5:00 PM PST

---

**Implementation Completed**: February 8, 2024
**Tech Stack**: FastAPI + React + MongoDB Atlas
**Status**: Ready for deployment setup
