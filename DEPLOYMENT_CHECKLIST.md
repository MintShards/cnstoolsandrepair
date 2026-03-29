# Production Deployment Checklist

Complete step-by-step checklist for deploying CNS Tool Repair to production.

**Total Time**: ~2 hours (setup + deployment + validation)
**Target Platform**: Digital Ocean App Platform
**Stack**: FastAPI + React + MongoDB Atlas + Spaces

---

## Pre-Deployment Phase (1 hour)

### ☐ Digital Ocean Spaces Setup (30 min)
**Guide**: `SPACES_SETUP.md`

- [ ] Create bucket: `cnstoolsandrepair-photos` in NYC3
- [ ] Generate and save Spaces API keys
- [ ] Configure CORS for production domains
- [ ] Test locally with `USE_SPACES=true`
- [ ] Verify photos upload to Spaces (not local filesystem)
- [ ] Check MongoDB has Spaces URLs (not local filenames)

**Validation**:
```bash
# Check local .env
grep "USE_SPACES=true" backend/.env

# Test upload via admin panel
# Visit: http://localhost:5173/admin/login
# Upload gallery photo → verify appears in Spaces dashboard
```

---

### ☐ Production Environment Configuration (15 min)
**Guide**: `PRODUCTION_ENV_SETUP.md`

- [ ] Create MongoDB production database: `cnstoolsandrepair_db_prod`
- [ ] Get Atlas connection string
- [ ] Generate JWT secret (32+ characters)
- [ ] Create `backend/.env` with production values
- [ ] Replace ALL placeholder values
- [ ] Verify no localhost in CORS
- [ ] Confirm SendGrid API key valid

**Validation**:
```bash
cd backend

# Check for placeholders (should return nothing)
grep -E "your_|REPLACE_|example|XXXX|localhost" backend/.env

# Validate configuration
python scripts/validate_production.py
```

---

### ☐ Code Preparation (15 min)

- [ ] All changes committed to git
- [ ] No uncommitted files (`git status` clean)
- [ ] Branch: `main` or production branch
- [ ] Push to GitHub: `git push origin main`
- [ ] Sitemap updated with current dates
- [ ] No console.log or debug code in production

**Commands**:
```bash
# Check git status
git status

# Commit any pending changes
git add .
git commit -m "Production deployment preparation"
git push origin main
```

---

## Deployment Phase (30 min)

### ☐ Digital Ocean App Platform Setup (20 min)

#### Step 1: Create App
1. Login: https://cloud.digitalocean.com
2. Navigate: **Apps** → **Create App**
3. **Source**: Connect GitHub repository
4. **Repository**: Select `cnstoolsandrepair`
5. **Branch**: `main`

#### Step 2: Configure Backend Service

**Service Settings**:
- **Name**: `backend`
- **Type**: Web Service
- **Dockerfile Path**: `backend/Dockerfile`
- **HTTP Port**: `8000`
- **Instance Size**: Basic (512MB RAM, $5/mo)
- **Health Check Path**: `/health`

**Environment Variables** (copy from `backend/.env`):
Add all 20 variables:
```
MONGODB_URL=...
DATABASE_NAME=cnstoolsandrepair_db_prod
CORS_ORIGINS=https://cnstoolrepair.com,https://www.cnstoolrepair.com
SENDGRID_API_KEY=...
SENDGRID_FROM_EMAIL=...
NOTIFICATION_EMAIL=...
MAX_FILE_SIZE=5242880
ALLOWED_EXTENSIONS=jpg,jpeg,png,webp
UPLOAD_DIR=uploads
UPLOAD_BASE_URL=https://cnstoolrepair.com
USE_SPACES=true
SPACES_REGION=nyc3
SPACES_BUCKET=cnstoolsandrepair-photos
SPACES_KEY=...
SPACES_SECRET=...
SPACES_ENDPOINT=https://nyc3.digitaloceanspaces.com
ENVIRONMENT=production
JWT_SECRET_KEY=...
JWT_ALGORITHM=HS256
JWT_EXPIRATION_HOURS=8
```

**Mark as encrypted**:
- `MONGODB_URL`
- `SENDGRID_API_KEY`
- `SPACES_SECRET`
- `JWT_SECRET_KEY`

#### Step 3: Configure Frontend Service

**Service Settings**:
- **Name**: `frontend`
- **Type**: Static Site
- **Dockerfile Path**: `frontend/Dockerfile`
- **Output Directory**: `/usr/share/nginx/html`
- **Instance Size**: Basic ($3/mo)

**No environment variables needed** (frontend uses backend API)

#### Step 4: Configure Routes

**Root domain routing**:
- `/` → `frontend` service (static site)
- `/api` → `backend` service (API)
- `/uploads` → `backend` service (file serving)

**Custom Domain** (optional, recommended):
- Add: `cnstoolrepair.com`
- Add: `www.cnstoolrepair.com`
- Enable HTTPS (automatic Let's Encrypt)

---

### ☐ DNS Configuration (10 min)
**If using custom domain**:

1. **Get App Platform IP**:
   - App → Settings → Domains
   - Copy provided IP or CNAME

2. **Update DNS** (your domain registrar):
   ```
   Type: A Record
   Name: @
   Value: <App Platform IP>
   TTL: 3600

   Type: A Record
   Name: www
   Value: <App Platform IP>
   TTL: 3600
   ```

3. **Wait for propagation**: 5-30 minutes

4. **Verify DNS**:
   ```bash
   nslookup cnstoolrepair.com
   ```

---

### ☐ Deployment Trigger

- [ ] Review all settings
- [ ] Click: **Create Resources**
- [ ] Wait for build to complete (~5-10 minutes)
- [ ] Check build logs for errors
- [ ] Wait for health checks to pass

**Monitor deployment**:
- **Runtime Logs** → Backend → Check for startup messages
- **Activity** → View build progress
- **Alerts** → Watch for errors

---

## Post-Deployment Phase (30 min)

### ☐ Database Initialization (10 min)

#### Create Admin User
**Option A: Via App Platform Console** (recommended):
1. App → Backend → Console
2. Run:
```bash
python scripts/create_admin.py
# Follow prompts to create admin user
```

**Option B: Local with production DB**:
```bash
cd backend
# Temporarily use production MongoDB URL in .env
python scripts/create_admin.py
# Revert .env to development after
```

**Record credentials**:
- Email: _______________
- Password: _______________

---

#### Create Database Indexes
**Via App Platform Console**:
```bash
python scripts/create_indexes.py
```

**Verify indexes created**:
- Login to MongoDB Atlas
- Collections → cnstoolsandrepair_db_prod → Indexes
- Should see indexes on: `quotes`, `users`, `contact_messages`

---

### ☐ End-to-End Testing (15 min)

#### Test 1: Quote Submission
1. Visit: `https://cnstoolrepair.com/repair-request`
2. Fill form with test data:
   - Company: Test Industries Ltd
   - Contact: John Doe
   - Email: test@example.com
   - Phone: 604-555-1234
   - Tool: Makita Impact Wrench (model XWT08)
   - Problem: Test problem description
3. Upload test photo (< 5MB, JPG/PNG)
4. Submit form

**Verify**:
- [ ] Form submits successfully (no errors)
- [ ] Confirmation message appears
- [ ] Email received at `NOTIFICATION_EMAIL`
- [ ] Email shows photo (not broken image)
- [ ] Photo in Spaces dashboard (`quotes/` folder)
- [ ] Request number generated (e.g., REQ-2026-0001)

**Check in MongoDB**:
- [ ] Quote document created in `quotes` collection
- [ ] Photo URL is Spaces URL (starts with `https://nyc3.digitaloceanspaces.com/`)
- [ ] All tool fields capitalized correctly

---

#### Test 2: Admin Login
1. Visit: `https://cnstoolrepair.com/admin/login`
2. Login with credentials from database initialization
3. Navigate to **Quotes** tab

**Verify**:
- [ ] Login successful
- [ ] Test quote appears in list
- [ ] Photo loads correctly (not broken)
- [ ] Can update quote status
- [ ] Can delete quote
- [ ] After deletion, photo removed from Spaces

---

#### Test 3: Gallery Upload
1. Admin → **Gallery** tab
2. Upload test photo
3. Visit: `https://cnstoolrepair.com/gallery`

**Verify**:
- [ ] Upload successful
- [ ] Photo appears on gallery page
- [ ] Photo loads (not broken image)
- [ ] Photo in Spaces (`gallery/` folder)

---

#### Test 4: Contact Form
1. Visit: `https://cnstoolrepair.com/contact`
2. Fill and submit contact form

**Verify**:
- [ ] Form submits successfully
- [ ] Email received
- [ ] Message saved in database

---

#### Test 5: Rate Limiting
1. Visit: `/repair-request`
2. Submit 5 quotes in quick succession (use different emails)
3. Attempt 6th submission

**Verify**:
- [ ] First 5 submissions succeed
- [ ] 6th submission blocked with rate limit message
- [ ] Error: "429 Too Many Requests"

---

#### Test 6: Security Checks
**CSRF Protection**:
- [ ] Forms work normally (CSRF tokens generated)
- [ ] Direct POST without token fails

**CORS**:
- [ ] No CORS errors in browser console (F12 → Console)
- [ ] Spaces images load correctly

**File Validation**:
- [ ] Try uploading .exe file → Should fail
- [ ] Try uploading 10MB image → Should fail
- [ ] Valid JPG/PNG upload → Should succeed

---

### ☐ SEO & Analytics (5 min)

#### Google Search Console
1. Visit: https://search.google.com/search-console
2. Add property: `https://cnstoolrepair.com`
3. Verify ownership (DNS TXT record)
4. Submit sitemap: `https://cnstoolrepair.com/sitemap.xml`

**Verify**:
- [ ] Sitemap submitted successfully
- [ ] All pages listed in sitemap
- [ ] No errors in sitemap

#### Social Media Preview
**Test Open Graph tags**:
1. Visit: https://www.opengraph.xyz/
2. Enter: `https://cnstoolrepair.com`
3. Check preview

**Verify**:
- [ ] Title appears correctly
- [ ] Description appears
- [ ] Image loads (if OG image configured)

---

## Monitoring Setup (Optional but Recommended)

### ☐ Error Monitoring

**App Platform Alerts**:
- [ ] Enable alert notifications (Settings → Alerts)
- [ ] Set up email/Slack notifications
- [ ] Configure alerts for:
  - Service unavailable
  - Build failures
  - Resource limits

### ☐ Uptime Monitoring

**Free options**:
- UptimeRobot: https://uptimerobot.com
- Monitor: `https://cnstoolrepair.com/health`
- Check interval: 5 minutes
- Alert when down

### ☐ Database Monitoring

**MongoDB Atlas Alerts**:
- [ ] Enable storage alerts (80% threshold)
- [ ] Enable connection alerts
- [ ] Monitor slow queries

---

## Rollback Plan (If Needed)

### If deployment fails:

1. **Check logs**:
   ```
   App → Backend/Frontend → Runtime Logs
   ```

2. **Common issues**:
   - Missing environment variables → Add in App Settings
   - Build failure → Check Dockerfile, requirements.txt
   - Health check fails → Verify `/health` endpoint works
   - MongoDB connection fails → Check network access in Atlas

3. **Rollback**:
   ```
   App → Deployments → Previous deployment → Rollback
   ```

4. **Rebuild**:
   ```
   App → Settings → Force Rebuild & Redeploy
   ```

---

## Success Criteria

### All systems operational:
- [ ] ✅ Quote submission works end-to-end
- [ ] ✅ Emails delivered with working photo links
- [ ] ✅ Admin login successful
- [ ] ✅ Gallery photos load correctly
- [ ] ✅ All photos stored in Spaces (not local)
- [ ] ✅ Rate limiting active (6th request blocked)
- [ ] ✅ CSRF protection working
- [ ] ✅ No CORS errors
- [ ] ✅ File validation working
- [ ] ✅ Database indexes created
- [ ] ✅ HTTPS enabled (green lock icon)
- [ ] ✅ Sitemap submitted to Google

---

## Cost Summary

**Monthly recurring costs**:
- Digital Ocean App Platform: $12/mo (backend $5 + frontend $3 + overhead)
- Digital Ocean Spaces: $5/mo
- MongoDB Atlas: Free (512MB tier)
- SendGrid: Free (100 emails/day tier)

**Total**: ~$17/month

---

## Post-Launch Tasks

### Immediate (Day 1)
- [ ] Monitor error logs for first 24 hours
- [ ] Test quote submission from real customer
- [ ] Verify email deliverability
- [ ] Check Spaces storage usage

### Week 1
- [ ] Review MongoDB slow query logs
- [ ] Check email delivery rate (should be >95%)
- [ ] Verify Google Search Console indexing
- [ ] Monitor uptime (should be >99%)

### Monthly
- [ ] Review App Platform costs
- [ ] Check Spaces storage usage (should stay <1GB)
- [ ] Review email quota usage (free tier: 100/day)
- [ ] Update dependencies if security patches available

---

## Troubleshooting

### Application won't start
**Check**:
- Runtime logs for Python errors
- All environment variables set
- MongoDB connection string valid
- Dockerfile builds successfully locally

### Photos not loading
**Check**:
- `USE_SPACES=true` in production env vars
- Spaces CORS configured
- Photo URLs in database start with `https://nyc3.digitaloceanspaces.com/`
- Browser console for CORS errors

### Emails not sending
**Check**:
- SendGrid API key valid
- Daily limit not exceeded (100/day free tier)
- From email domain authenticated
- SendGrid Activity log for rejections

### Rate limiting not working
**Check**:
- `slowapi` installed (in requirements.txt)
- Limiter configured in `app/main.py`
- Test from different IPs if behind proxy

---

## Documentation References

- **Spaces Setup**: `SPACES_SETUP.md`
- **Environment Config**: `PRODUCTION_ENV_SETUP.md`
- **General Production Guide**: `PRODUCTION.md`
- **Admin Auth**: `AUTH_SETUP_GUIDE.md`
- **Project Overview**: `CLAUDE.md`

---

## Support Contacts

- **App Platform**: https://cloud.digitalocean.com/support
- **MongoDB Atlas**: https://support.mongodb.com
- **SendGrid**: https://support.sendgrid.com
- **DNS Issues**: Your domain registrar support

---

**🚀 Ready to Deploy?**

Start with Pre-Deployment Phase and work through each section sequentially. Mark items complete as you go.

**Estimated Total Time**: 2 hours from start to fully operational system.

Good luck! 🎉
