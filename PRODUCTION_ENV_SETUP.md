# Production Environment Setup Guide

Complete guide to configure production environment variables for CNS Tools and Repair deployment.

**Time Required**: ~15 minutes
**Prerequisites**: Spaces configured (see `SPACES_SETUP.md`)

---

## Overview

Production requires a separate `.env` configuration with:
- ✅ Production MongoDB database (not dev database)
- ✅ Strong JWT secret (32+ characters)
- ✅ Production domain CORS (no localhost)
- ✅ Spaces credentials configured
- ✅ Valid SendGrid API key

---

## Step 1: Create Production MongoDB Database (5 min)

### 1.1 Access MongoDB Atlas
1. Login: https://cloud.mongodb.com
2. Navigate to your cluster
3. Click: **Collections** tab

### 1.2 Create Production Database
**Click**: `Create Database`

**Configuration**:
- **Database name**: `cnstoolsandrepair_db_prod` (note: `_prod` not `_dev`)
- **Collection name**: `quotes` (initial collection, others auto-created)

**Click**: `Create`

### 1.3 Get Connection String
1. Click: **Connect** button (cluster overview)
2. Choose: **Connect your application**
3. **Driver**: Python, **Version**: 3.12 or later
4. **Copy** connection string:

```
mongodb+srv://<username>:<password>@cluster.mongodb.net/?retryWrites=true&w=majority
```

### 1.4 Configure Connection String
Replace placeholders:
- `<username>` → Your Atlas username
- `<password>` → Your Atlas password (**URL encode** special characters)

**Add database name** after `.net/`:
```
mongodb+srv://username:password@cluster.mongodb.net/cnstoolsandrepair_db_prod?retryWrites=true&w=majority&tls=true
```

**Note**: Added `&tls=true` for security

### 1.5 Verify Network Access
**Atlas → Network Access**:
- Allow: `0.0.0.0/0` (allow all) **OR**
- Add your deployment platform's IP addresses

---

## Step 2: Generate JWT Secret (2 min)

**Why**: JWT tokens authenticate admin users. Production needs unique secret.

### 2.1 Generate Secure Secret
Run this command:

```bash
python -c "import secrets; print(secrets.token_urlsafe(32))"
```

**Example output**:
```
xK9mPqL3nRtYvWz8A5BcDeF2GhJ6Mn7pQsUvXy1ZaBc
```

**Save this value** - you'll need it in `.env`

**Security**:
- ✅ Minimum 32 characters
- ✅ Different from development secret
- ✅ Never commit to git
- ❌ Don't reuse across environments

---

## Step 3: Configure Production .env (5 min)

### 3.1 Copy Template
```bash
cd backend
cp .env.production.template .env
```

**Or create new** `backend/.env`:

### 3.2 Production .env Configuration

```env
# ============================================
# PRODUCTION ENVIRONMENT - CNS Tools & Repair
# ============================================

# MongoDB - Production Database
MONGODB_URL=mongodb+srv://username:password@cluster.mongodb.net/cnstoolsandrepair_db_prod?retryWrites=true&w=majority&tls=true
DATABASE_NAME=cnstoolsandrepair_db_prod

# CORS - Production Domain ONLY (no localhost)
CORS_ORIGINS=https://cnstoolsandrepair.com,https://www.cnstoolsandrepair.com

# Email - SendGrid
SENDGRID_API_KEY=SG.your_actual_sendgrid_key_here
SENDGRID_FROM_EMAIL=noreply@cnstoolsandrepair.com
NOTIFICATION_EMAIL=cnstoolsandrepair@gmail.com

# File Upload
MAX_FILE_SIZE=5242880
ALLOWED_EXTENSIONS=jpg,jpeg,png,webp
UPLOAD_DIR=uploads
UPLOAD_BASE_URL=https://cnstoolsandrepair.com

# Digital Ocean Spaces (REQUIRED - See SPACES_SETUP.md)
USE_SPACES=true
SPACES_REGION=nyc3
SPACES_BUCKET=cnstoolsandrepair-photos
SPACES_KEY=DO00XXXXXXXXXXXXXXXXXXXX
SPACES_SECRET=your_spaces_secret_key_here
SPACES_ENDPOINT=https://nyc3.digitaloceanspaces.com

# Environment
ENVIRONMENT=production

# JWT Authentication (REQUIRED - See Step 2)
JWT_SECRET_KEY=your_generated_32_char_secret_from_step_2
JWT_ALGORITHM=HS256
JWT_EXPIRATION_HOURS=8
```

### 3.3 Replace All Placeholders

**Critical replacements**:
1. `MONGODB_URL` → Your Atlas connection string
2. `JWT_SECRET_KEY` → Generated secret from Step 2
3. `SENDGRID_API_KEY` → Your SendGrid API key
4. `SPACES_KEY` → From Spaces setup
5. `SPACES_SECRET` → From Spaces setup

### 3.4 Verify No Placeholders
Run validation:

```bash
grep -E "your_|REPLACE_|example|XXXX|<.*>" backend/.env
```

**Expected**: No output (means all placeholders replaced)

**If you see output**: Missing replacements, update `.env`

---

## Step 4: SendGrid Configuration (3 min)

### 4.1 Verify SendGrid Account
1. Login: https://app.sendgrid.com
2. Navigate: **Settings** → **API Keys**
3. Verify API key exists or create new one

### 4.2 Domain Authentication (Recommended)
**For production email delivery**:

1. **Settings** → **Sender Authentication**
2. **Authenticate Your Domain**: `cnstoolsandrepair.com`
3. Add DNS records provided by SendGrid
4. Wait for verification (can take 24-48 hours)

**Why**: Authenticated domains have better deliverability

### 4.3 Test API Key
```bash
curl -X POST https://api.sendgrid.com/v3/mail/send \
  -H "Authorization: Bearer YOUR_SENDGRID_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "personalizations": [{"to": [{"email": "test@example.com"}]}],
    "from": {"email": "noreply@cnstoolsandrepair.com"},
    "subject": "Test",
    "content": [{"type": "text/plain", "value": "Test"}]
  }'
```

**Expected**: `202 Accepted` response

---

## Step 5: Environment Variables for Deployment Platform

### 5.1 Digital Ocean App Platform
When deploying, add these environment variables:

**Navigate**: App → Settings → Environment Variables

**Add each variable** from your `backend/.env`:

| Variable | Value | Example |
|----------|-------|---------|
| `MONGODB_URL` | Atlas connection string | `mongodb+srv://...` |
| `DATABASE_NAME` | Production DB name | `cnstoolsandrepair_db_prod` |
| `CORS_ORIGINS` | Production domains | `https://cnstoolsandrepair.com,...` |
| `SENDGRID_API_KEY` | SendGrid key | `SG.abc123...` |
| `SENDGRID_FROM_EMAIL` | From email | `noreply@cnstoolsandrepair.com` |
| `NOTIFICATION_EMAIL` | Admin email | `cnstoolsandrepair@gmail.com` |
| `MAX_FILE_SIZE` | Upload limit | `5242880` |
| `ALLOWED_EXTENSIONS` | File types | `jpg,jpeg,png,webp` |
| `UPLOAD_DIR` | Upload folder | `uploads` |
| `UPLOAD_BASE_URL` | Domain | `https://cnstoolsandrepair.com` |
| `USE_SPACES` | Enable Spaces | `true` |
| `SPACES_REGION` | Spaces region | `nyc3` |
| `SPACES_BUCKET` | Bucket name | `cnstoolsandrepair-photos` |
| `SPACES_KEY` | Spaces access key | `DO00...` |
| `SPACES_SECRET` | Spaces secret | `(your secret)` |
| `SPACES_ENDPOINT` | Spaces URL | `https://nyc3.digitaloceanspaces.com` |
| `ENVIRONMENT` | Environment | `production` |
| `JWT_SECRET_KEY` | JWT secret | `(your 32+ char secret)` |
| `JWT_ALGORITHM` | Algorithm | `HS256` |
| `JWT_EXPIRATION_HOURS` | Token lifetime | `8` |

### 5.2 Mark Sensitive Variables
**Mark as encrypted** (platform-specific):
- `MONGODB_URL`
- `SENDGRID_API_KEY`
- `SPACES_SECRET`
- `JWT_SECRET_KEY`

---

## Validation Checklist

### Pre-Deployment Validation

Run automated validation:
```bash
cd backend
source venv/bin/activate
python scripts/validate_production.py
```

**Manual checks**:
- [ ] MongoDB connection string includes `cnstoolsandrepair_db_prod`
- [ ] JWT secret is 32+ characters
- [ ] CORS has NO `localhost` entries
- [ ] `USE_SPACES=true` (not false)
- [ ] Spaces credentials from `SPACES_SETUP.md`
- [ ] SendGrid API key starts with `SG.`
- [ ] `ENVIRONMENT=production` (not development)
- [ ] No placeholder values (`your_`, `REPLACE_`, `example`)

### Security Validation

- [ ] `.env` file is gitignored (check `.gitignore`)
- [ ] Different JWT secret than development
- [ ] MongoDB password is strong (16+ chars, mixed case, numbers, symbols)
- [ ] Spaces keys never committed to git
- [ ] SendGrid domain authenticated (for production)

---

## Troubleshooting

### ❌ MongoDB Connection Failed
**Error**: `ServerSelectionTimeoutError` or connection refused

**Check**:
1. Connection string has correct username/password
2. Special characters in password are URL-encoded
   - `@` → `%40`
   - `#` → `%23`
   - `/` → `%2F`
3. Network Access in Atlas allows deployment platform IP
4. Database name matches: `cnstoolsandrepair_db_prod`

**Test connection**:
```bash
python -c "from pymongo import MongoClient; client = MongoClient('YOUR_MONGODB_URL'); print(client.list_database_names())"
```

---

### ❌ JWT Secret Too Short
**Error**: Authentication fails or security warning

**Fix**:
```bash
# Generate new secret (32+ chars)
python -c "import secrets; print(secrets.token_urlsafe(32))"

# Update .env
JWT_SECRET_KEY=<new_secret>
```

---

### ❌ SendGrid Email Not Sending
**Check**:
1. API key is valid (test with curl command above)
2. From email domain authenticated in SendGrid
3. Not exceeding free tier limit (100 emails/day)
4. Check SendGrid Activity log for rejections

---

### ❌ CORS Errors in Production
**Symptoms**: Images fail to load, API requests blocked

**Check**:
1. `CORS_ORIGINS` has production domain (no `http://localhost`)
2. Domain includes `https://` prefix
3. Both `www` and non-`www` versions included
4. Spaces CORS configured (see `SPACES_SETUP.md`)

---

### ❌ Spaces Upload Fails in Production
**Check**:
1. `USE_SPACES=true` in production env vars
2. All Spaces variables set (KEY, SECRET, BUCKET, REGION, ENDPOINT)
3. Spaces credentials valid (test locally first)
4. boto3 installed in production (should be in `requirements.txt`)

---

## Environment Comparison

### Development vs Production

| Variable | Development | Production |
|----------|-------------|------------|
| `DATABASE_NAME` | `cnstoolsandrepair_db_dev` | `cnstoolsandrepair_db_prod` |
| `CORS_ORIGINS` | `http://localhost:5173,...` | `https://cnstoolsandrepair.com` |
| `USE_SPACES` | `false` (optional) | `true` (required) |
| `ENVIRONMENT` | `development` | `production` |
| `JWT_SECRET_KEY` | Dev secret | **Different** prod secret |
| `UPLOAD_BASE_URL` | `http://localhost:8000` | `https://cnstoolsandrepair.com` |

---

## Security Best Practices

### ✅ DO
- Use separate databases for dev/prod
- Generate unique JWT secrets for each environment
- Enable Spaces in production (persistent storage)
- Authenticate SendGrid domain
- URL-encode special characters in MongoDB password
- Mark sensitive env vars as encrypted in platform
- Rotate secrets if exposed

### ❌ DON'T
- Reuse development credentials in production
- Include `localhost` in production CORS
- Commit `.env` file to git
- Use weak JWT secrets (<32 characters)
- Leave placeholder values in production config
- Share production credentials in unsecured channels

---

## Next Steps

After environment is configured:

1. ✅ Production environment configured
2. ➡️ Run validation: `python scripts/validate_production.py`
3. ➡️ Deploy to platform: See `DEPLOYMENT_CHECKLIST.md`
4. ➡️ Post-deployment setup: `python scripts/post_deployment.py`

---

**Questions?** See `PRODUCTION.md` or check deployment platform documentation.
