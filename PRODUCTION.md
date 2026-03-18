# Production Deployment Guide

Complete guide for deploying CNS Tools and Repair to production.

## Quick Start

**Total time**: ~1 hour for basic deployment

```bash
# 1. Setup Spaces (Digital Ocean dashboard - 30 min)
# 2. Configure environment (15 min)
# 3. Deploy to App Platform (15 min)
# 4. Manual verification (15 min)
```

---

## 🔴 Critical Setup (Required)

### 1. Digital Ocean Spaces (30 min)

**Why**: Local filesystem (`backend/uploads/`) loses photos on deployment.

**Steps**:
1. Login: https://cloud.digitalocean.com → Spaces → Create Bucket
2. Configuration:
   - Name: `cnstoolsandrepair-photos`
   - Region: NYC3
   - File listing: Restricted
3. Generate API keys: API → Spaces Keys → Generate New Key
4. **Save immediately** (shown once): Access Key + Secret Key
5. Configure CORS: Bucket → Settings → CORS:
```json
[{
  "AllowedOrigins": ["https://cnstoolsandrepair.com", "https://www.cnstoolsandrepair.com"],
  "AllowedMethods": ["GET"],
  "AllowedHeaders": ["*"],
  "MaxAgeSeconds": 3000
}]
```

**Test locally**:
```bash
cd backend
# Add to .env:
# USE_SPACES=true
# SPACES_KEY=DO00...
# SPACES_SECRET=...

python3 -m uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
# Visit localhost:5173/admin/login
# Upload gallery photo → verify appears in Spaces dashboard
```

---

### 2. Environment Configuration (15 min)

**Create production database**:
1. MongoDB Atlas: https://cloud.mongodb.com
2. Create database: `cnstoolsandrepair_db_prod`
3. Copy connection string

**Generate JWT secret**:
```bash
python -c "import secrets; print(secrets.token_urlsafe(32))"
```

**Configure `backend/.env`**:
```env
# Database
MONGODB_URL=mongodb+srv://USER:PASS@cluster.mongodb.net/cnstoolsandrepair_db_prod?retryWrites=true&w=majority&tls=true
DATABASE_NAME=cnstoolsandrepair_db_prod

# Security
JWT_SECRET_KEY=<32+ char secret from above>
CORS_ORIGINS=https://cnstoolsandrepair.com

# Email
SENDGRID_API_KEY=<your_key>
SENDGRID_FROM_EMAIL=noreply@cnstoolsandrepair.com
NOTIFICATION_EMAIL=cnstoolsandrepair@gmail.com

# Spaces
USE_SPACES=true
SPACES_KEY=<DO00...>
SPACES_SECRET=<secret>
SPACES_REGION=nyc3
SPACES_BUCKET=cnstoolsandrepair-photos
SPACES_ENDPOINT=https://nyc3.digitaloceanspaces.com

# Config
ENVIRONMENT=production
UPLOAD_BASE_URL=https://cnstoolsandrepair.com
```

**Verify**:
```bash
grep -E "your_|REPLACE_|example" backend/.env
# Should return nothing
```

---

### 3. Deploy to App Platform (15 min)

1. Digital Ocean App Platform → Create App
2. Connect GitHub repo
3. Configure:
   - **Backend**: Dockerfile, port 8000
   - **Frontend**: npm run build, static site
4. Copy all environment variables from `backend/.env`
5. Deploy

---

### 4. Manual Verification (15 min)

**Test quote submission**:
1. Visit https://cnstoolsandrepair.com/quote
2. Fill form + upload photo → Submit
3. Check email notification received
4. Verify photo in Spaces dashboard (`quotes/` folder)

**Test admin**:
1. Create admin: `python scripts/create_admin.py`
2. Login: `/admin/login`
3. View quote → Update status → Delete
4. Verify photo deleted from Spaces

---

## 🔧 MongoDB Indexes (Optional - Performance)

**Create manually via MongoDB Atlas UI**:
1. Atlas → Collections → quotes → Indexes tab
2. Create these indexes:

```javascript
// Index 1: Sort by creation date
{ "created_at": -1 }

// Index 2: Filter by status
{ "status": 1 }

// Index 3: Unique request numbers
{ "request_number": 1 } // unique: true

// Index 4: Email lookups
{ "email": 1 }

// Index 5: Status + date filtering
{ "status": 1, "created_at": -1 }
```

---

## 📊 Architecture

```
User Browser (cnstoolsandrepair.com)
    ↓
Digital Ocean App Platform
├── React Frontend (SPA)
└── FastAPI Backend
    ├── MongoDB Atlas (database)
    ├── DO Spaces (photo storage)
    └── SendGrid (email)
```

**Cost**: $17/month
- Spaces: $5/mo
- App Platform: $12/mo
- MongoDB: Free tier
- SendGrid: Free tier

---

## 🛡️ Security Features

✅ **Built-in**:
- Rate limiting (5 requests/hour)
- CSRF protection
- File validation (deep content check)
- Idempotency (duplicate prevention)
- Phone format validation
- Input sanitization

⚠️ **Production config**:
- Enable `cookie_secure=True` in `app/main.py` (requires HTTPS)
- Use different JWT secrets for dev/prod
- Rotate Spaces keys if exposed

---

## 🚨 Troubleshooting

### Photos not loading
**Symptoms**: Broken images on gallery/emails

**Fixes**:
1. Check CORS in Spaces settings (see setup section)
2. Verify photos exist in Spaces dashboard
3. Check MongoDB - URLs should start with `https://nyc3.digitaloceanspaces.com/`
4. Browser console → look for CORS errors

### Email not sending
**Symptoms**: `email_sent: false` in API response

**Fixes**:
1. Verify SendGrid API key in `.env`
2. Check SendGrid dashboard → Activity
3. Check daily limit (100 emails/day free tier)
4. Test API key:
```bash
curl -X POST https://api.sendgrid.com/v3/mail/send \
  -H "Authorization: Bearer $SENDGRID_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"personalizations":[{"to":[{"email":"test@example.com"}]}],"from":{"email":"noreply@cnstoolsandrepair.com"},"subject":"Test","content":[{"type":"text/plain","value":"Test"}]}'
```

### Can't login to admin
**Fix**: Create admin user:
```bash
cd backend
source venv/bin/activate
python scripts/create_admin.py
```

### Rate limiting not working
**Fix**: Verify in `app/main.py`:
```python
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)
```

### File upload fails (413 error)
**Fix**: Images must be <5MB. Compress before upload.

### MongoDB connection failed
**Fixes**:
1. Verify connection string has credentials
2. Check Atlas cluster not paused
3. Confirm network access allows your IP (or 0.0.0.0/0)

---

## 📈 Monitoring

### Daily
- App Platform → Check error logs
- SendGrid → Delivery rate (should be >95%)

### Weekly
- MongoDB Atlas → Storage usage (free tier: 512MB)
- Spaces → Storage usage (250GB included)

### Monthly
- Review error logs
- Check email quota (100/day free)
- Update dependencies if security patches

---

## ✅ Production Checklist

**Before deployment**:
- [ ] Spaces bucket created + API keys saved
- [ ] CORS configured in Spaces
- [ ] Production MongoDB database created
- [ ] `.env` configured (all credentials)
- [ ] JWT secret generated (32+ chars)
- [ ] No placeholder values in `.env`

**After deployment**:
- [ ] Test quote submission end-to-end
- [ ] Email received with working photo links
- [ ] Photo in Spaces dashboard
- [ ] Admin login works
- [ ] Quote deletion removes photos from Spaces
- [ ] Rate limiting blocks 6th request/hour

---

## 📞 Support

**Before asking for help**:
1. Check this guide's troubleshooting section
2. Review App Platform logs
3. Check MongoDB Atlas metrics
4. Test manually (submit quote, check email)

**Support contacts**:
- Digital Ocean: https://cloud.digitalocean.com/support
- MongoDB Atlas: https://support.mongodb.com
- SendGrid: https://support.sendgrid.com

---

## 🎓 For Developers

### Local Development
```bash
# Backend
cd backend
python3 -m venv venv && source venv/bin/activate
pip install -r requirements.txt
cp .env.example .env  # Edit with dev credentials
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000

# Frontend
cd frontend
npm install
npm run dev
```

### Code Structure
- `backend/app/routers/quotes.py` - Quote API
- `backend/app/services/file_service.py` - Spaces integration
- `backend/app/services/email_service.py` - SendGrid
- `frontend/src/pages/Quote.jsx` - Quote form
- `frontend/src/components/admin/tabs/QuotesTab.jsx` - Admin

### Key Patterns
**MongoDB ObjectId handling**:
```python
# MUST convert to string AND rename _id to id
created = await db.quotes.find_one({"_id": result.inserted_id})
created = convert_objectid_to_str(created)
created["id"] = created.pop("_id")
return QuoteResponse(**created)
```

**File uploads**:
- Dual mode: Local (`USE_SPACES=false`) or Spaces (`USE_SPACES=true`)
- UUID filenames for security
- Deep content validation with Pillow
- Auto-cleanup on delete

---

## Production-Ready Features

✅ **Security**: Rate limiting, CSRF, validation, idempotency
✅ **Reliability**: Non-blocking email, photo cleanup, error tracking
✅ **Performance**: Async MongoDB, structured logging
✅ **Infrastructure**: Spaces integration, MongoDB Atlas

**Stack**: FastAPI + React + MongoDB (FARM)
**Deployment**: Digital Ocean App Platform + Spaces
**Location**: Surrey, BC, Canada
**Business**: B2B Pneumatic Tool Repair

---

**Ready to deploy? Follow the checklist above. Good luck! 🚀**
