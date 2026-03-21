# Digital Ocean Spaces Setup Guide

Complete step-by-step guide to configure Digital Ocean Spaces for CNS Tools and Repair.

**Why Needed**: Local file storage (`backend/uploads/`) will lose all photos on deployment. Spaces provides persistent cloud storage for quote photos, gallery images, and brand logos.

**Time Required**: ~30 minutes
**Cost**: $5/month (250GB storage + 1TB transfer included)

---

## Step 1: Create Spaces Bucket (10 min)

### 1.1 Access Digital Ocean Dashboard
1. Login to Digital Ocean: https://cloud.digitalocean.com
2. Navigate: **Create** → **Spaces Object Storage**
3. Or direct link: https://cloud.digitalocean.com/spaces

### 1.2 Configure Bucket
**Choose datacenter region**:
- Select: **New York 3 (NYC3)**
- Reason: Lowest latency for Surrey, BC → East Coast infrastructure

**Enable CDN** (Optional but recommended):
- ✅ Check "Enable CDN"
- Improves image loading speed globally
- No additional cost

**Choose bucket settings**:
- **Bucket name**: `cnstoolsandrepair-photos` (must be globally unique)
- **File listing**: `Restricted` (security - don't allow public listing)
- **Project**: Select your project or Default

**Click**: `Create a Spaces Bucket`

---

## Step 2: Generate API Keys (5 min)

### 2.1 Create Spaces Access Keys
1. Navigate: **API** → **Spaces Keys** (left sidebar)
2. Or direct: https://cloud.digitalocean.com/account/api/spaces
3. Click: `Generate New Key`

### 2.2 Save Credentials
**CRITICAL**: Credentials shown **only once**. Save immediately!

You'll receive:
- **Access Key**: `DO00XXXXXXXXXXXXXXXXXXXX` (24 characters)
- **Secret Key**: Long string (40+ characters)

**Save to secure location**:
```bash
# Example - DO NOT use these values
Access Key: DO00ABC123EXAMPLE456XYZ
Secret Key: abcdef1234567890secretexamplekey1234567890
```

**Security**:
- ✅ Save in password manager
- ✅ Add to `.env` file (gitignored)
- ❌ Never commit to git
- ❌ Never share publicly

---

## Step 3: Configure CORS (5 min)

**Why**: Allow your website to load images from Spaces in browsers.

### 3.1 Access CORS Settings
1. Go to your bucket: https://cloud.digitalocean.com/spaces
2. Click: `cnstoolsandrepair-photos` bucket
3. Navigate: **Settings** tab
4. Scroll to: **CORS Configurations**

### 3.2 Add CORS Rules
Click `Edit` and paste this JSON:

```json
[
  {
    "AllowedOrigins": [
      "https://cnstoolsandrepair.com",
      "https://www.cnstoolsandrepair.com"
    ],
    "AllowedMethods": [
      "GET",
      "HEAD"
    ],
    "AllowedHeaders": [
      "*"
    ],
    "MaxAgeSeconds": 3000
  }
]
```

**For development/testing, add localhost**:
```json
[
  {
    "AllowedOrigins": [
      "https://cnstoolsandrepair.com",
      "https://www.cnstoolsandrepair.com",
      "http://localhost:5173",
      "http://localhost:3000"
    ],
    "AllowedMethods": [
      "GET",
      "HEAD"
    ],
    "AllowedHeaders": [
      "*"
    ],
    "MaxAgeSeconds": 3000
  }
]
```

**Click**: `Save`

---

## Step 4: Local Testing (10 min)

### 4.1 Configure Backend Environment
Edit `backend/.env`:

```env
# Digital Ocean Spaces - REQUIRED FOR PRODUCTION
USE_SPACES=true
SPACES_REGION=nyc3
SPACES_BUCKET=cnstoolsandrepair-photos
SPACES_KEY=DO00XXXXXXXXXXXXXXXXXXXX  # Your actual key from Step 2
SPACES_SECRET=your_secret_key_here     # Your actual secret from Step 2
SPACES_ENDPOINT=https://nyc3.digitaloceanspaces.com
```

### 4.2 Verify boto3 Installed
```bash
cd backend
source venv/bin/activate  # Or .\venv\Scripts\activate on Windows
pip list | grep boto3
# Should show: boto3  1.34.34
```

If not installed:
```bash
pip install boto3==1.34.34
```

### 4.3 Test Upload Locally
**Start backend**:
```bash
cd backend
source venv/bin/activate
python3 -m uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

**Start frontend** (new terminal):
```bash
cd frontend
npm run dev
```

**Test gallery upload**:
1. Visit: http://localhost:5173/admin/login
2. Login with admin credentials
3. Go to: **Gallery** tab
4. Upload a test photo
5. **Verify in Spaces dashboard**:
   - Go to: https://cloud.digitalocean.com/spaces
   - Open: `cnstoolsandrepair-photos`
   - Should see: `gallery/` folder with UUID-named file

**Test quote submission**:
1. Visit: http://localhost:5173/repair-request
2. Fill form and upload photo
3. Submit
4. **Verify in Spaces**:
   - Should see: `quotes/` folder with photo

### 4.4 Test Photo Loading
**Check URLs in MongoDB**:
- Photos should have URLs like: `https://nyc3.digitaloceanspaces.com/cnstoolsandrepair-photos/gallery/uuid.jpg`
- NOT like: `uuid.jpg` (local storage format)

**Check in browser**:
- Visit gallery page
- Photos should load (not broken images)
- Browser console should show no CORS errors

---

## Step 5: Production Deployment

### 5.1 Add to Production Environment
In your deployment platform (Digital Ocean App Platform), add environment variables:

```env
USE_SPACES=true
SPACES_REGION=nyc3
SPACES_BUCKET=cnstoolsandrepair-photos
SPACES_KEY=DO00XXXXXXXXXXXXXXXXXXXX
SPACES_SECRET=your_secret_key_here
SPACES_ENDPOINT=https://nyc3.digitaloceanspaces.com
```

### 5.2 Update CORS for Production Only
**After successful deployment**, remove localhost from CORS:

```json
[
  {
    "AllowedOrigins": [
      "https://cnstoolsandrepair.com",
      "https://www.cnstoolsandrepair.com"
    ],
    "AllowedMethods": [
      "GET",
      "HEAD"
    ],
    "AllowedHeaders": [
      "*"
    ],
    "MaxAgeSeconds": 3000
  }
]
```

---

## Troubleshooting

### ❌ "boto3 not installed" Error
**Problem**: Python can't find boto3 module

**Solution**:
```bash
cd backend
source venv/bin/activate
pip install boto3==1.34.34
```

---

### ❌ "Spaces credentials not configured" Error
**Problem**: Missing or invalid API keys in `.env`

**Check**:
1. `backend/.env` has `USE_SPACES=true`
2. `SPACES_KEY` starts with `DO00`
3. `SPACES_SECRET` is not empty
4. No quotes around values in `.env`

**Example** (correct):
```env
SPACES_KEY=DO00ABC123EXAMPLE
SPACES_SECRET=secret123
```

---

### ❌ Photos Not Loading (CORS Error)
**Problem**: Browser console shows CORS errors

**Check browser console** (F12 → Console):
```
Access to image at 'https://nyc3.digitaloceanspaces.com/...' from origin
'https://cnstoolsandrepair.com' has been blocked by CORS policy
```

**Solution**:
1. Go to Spaces → Settings → CORS
2. Verify your domain is in `AllowedOrigins`
3. Ensure `GET` is in `AllowedMethods`
4. Wait 1-2 minutes for changes to propagate
5. Hard refresh browser (Ctrl+Shift+R)

---

### ❌ Upload Fails with 403 Forbidden
**Problem**: API keys lack permissions

**Solution**:
1. Regenerate new Spaces key
2. Ensure key has **full Spaces permissions** (not read-only)
3. Update `.env` with new credentials
4. Restart backend server

---

### ❌ Photos Uploaded to Wrong Bucket
**Problem**: Using incorrect bucket name

**Check**:
- `SPACES_BUCKET=cnstoolsandrepair-photos` (exact match)
- Bucket exists in NYC3 region
- Region matches: `SPACES_REGION=nyc3`

---

### ❌ Local Works, Production Fails
**Problem**: Different environment variables

**Verify**:
1. Production platform has ALL Spaces env vars set
2. Values match local `.env` (except localhost in CORS)
3. Restart production app after adding env vars

**Debug**:
```bash
# Check production logs for:
"Warning: boto3 not installed"  # Missing dependency
"Spaces integration disabled"    # USE_SPACES=false
"Spaces credentials not configured"  # Missing keys
```

---

## Verification Checklist

Before marking as complete:

- [ ] Bucket `cnstoolsandrepair-photos` created in NYC3
- [ ] API keys generated and saved securely
- [ ] CORS configured with production domains
- [ ] Local testing: Gallery photo uploaded successfully
- [ ] Local testing: Quote photo uploaded successfully
- [ ] Spaces dashboard shows `gallery/` and `quotes/` folders
- [ ] Photos load in browser (no CORS errors)
- [ ] MongoDB has Spaces URLs (not local filenames)
- [ ] Production `.env` configured with Spaces credentials

---

## Cost Breakdown

**Spaces Pricing** (as of 2026):
- Base: $5/month
- Includes: 250GB storage + 1TB outbound transfer
- Overage: $0.02/GB storage, $0.01/GB transfer

**Estimated Usage** (CNS Tools):
- Photos: ~50-100 per month × 500KB avg = 25-50MB/month
- Storage: ~600MB/year (well under 250GB limit)
- Transfer: ~5-10GB/month (well under 1TB limit)

**Total Cost**: **$5/month** (no overages expected)

---

## Security Best Practices

✅ **DO**:
- Keep API keys in `.env` (gitignored)
- Use `Restricted` file listing
- Limit CORS to production domains only
- Rotate keys if exposed
- Use environment variables for credentials

❌ **DON'T**:
- Commit API keys to git
- Use `Public` file listing
- Allow wildcard CORS (`*`)
- Hardcode credentials in code
- Share secret keys publicly

---

## Next Steps

After Spaces is configured:

1. ✅ Spaces setup complete
2. ➡️ Configure production environment: See `PRODUCTION_ENV_SETUP.md`
3. ➡️ Run validation script: `python scripts/validate_production.py`
4. ➡️ Deploy to production: See `DEPLOYMENT_CHECKLIST.md`

---

**Questions?** Check `PRODUCTION.md` troubleshooting section or Digital Ocean documentation.
