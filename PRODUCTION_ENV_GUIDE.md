# Production Environment Configuration Guide

**Quick Reference**: Complete environment variable setup for production deployment

---

## ⚠️ SECURITY CRITICAL

**This file contains PLACEHOLDERS only. Never commit real credentials.**

All actual credentials must be stored in:
- **Local file**: `backend/.env.production` (gitignored)
- **App Platform**: Settings → Environment Variables (encrypted)

---

## 🎯 Required Configuration Values

Only **2 values** require customization in `backend/.env.production`:

### 1. Production MongoDB URL
**Variable**: `MONGODB_URL`

**How to get this**:
1. Login to MongoDB Atlas: https://cloud.mongodb.com
2. Select your cluster: **prod-cluster**
3. Click "Connect" → "Connect your application"
4. Copy connection string
5. Replace `<username>`, `<password>`, `<database>` with actual values

**Format**:
```
mongodb+srv://<username>:<password>@prod-cluster.t8ewwml.mongodb.net/<database>?retryWrites=true&w=majority&tls=true&appName=prod-cluster
```

**Example** (with placeholders):
```
MONGODB_URL=mongodb+srv://your_db_user:your_db_password@prod-cluster.t8ewwml.mongodb.net/cnstoolsandrepair_db_prod?retryWrites=true&w=majority&tls=true&appName=prod-cluster
```

---

### 2. Production Domain (CORS)
**Variable**: `CORS_ORIGINS`

**What to use**:
- **Custom domain**: `https://cnstoolsandrepair.com,https://www.cnstoolsandrepair.com`
- **App Platform URL**: `https://your-app-name.ondigitalocean.app`

**Example**:
```
CORS_ORIGINS=https://cnstoolsandrepair.com,https://www.cnstoolsandrepair.com
```

---

## ✅ Pre-Configured Values

These are standard values (customize if needed):

| Variable | Value | Notes |
|----------|-------|-------|
| `DATABASE_NAME` | `cnstoolsandrepair_db_prod` | Production database name |
| `SENDGRID_FROM_EMAIL` | `noreply@cnstoolsandrepair.com` | Email sender address |
| `NOTIFICATION_EMAIL` | `cnstoolsandrepair@gmail.com` | Quote notification recipient |
| `MAX_FILE_SIZE` | `5242880` | 5MB file upload limit |
| `ALLOWED_EXTENSIONS` | `jpg,jpeg,png,webp` | Image formats allowed |
| `UPLOAD_DIR` | `uploads` | Upload directory path |
| `USE_SPACES` | `false` | Disable Spaces storage |
| `SPACES_REGION` | `sfo3` | Digital Ocean region |
| `SPACES_BUCKET` | `cnstoolsandrepair-photos` | Bucket name (if enabled) |
| `SPACES_ENDPOINT` | `https://sfo3.digitaloceanspaces.com` | Spaces endpoint |
| `ENVIRONMENT` | `production` | Environment identifier |
| `JWT_ALGORITHM` | `HS256` | JWT signing algorithm |
| `JWT_EXPIRATION_HOURS` | `8` | Admin token expiration |

---

## 🔐 Secret Generation Required

These values must be generated fresh (never reuse from development):

### SendGrid API Key
**Variable**: `SENDGRID_API_KEY`

**How to generate**:
1. Login to SendGrid: https://app.sendgrid.com
2. Navigate to Settings → API Keys
3. Click "Create API Key"
4. Name: `cnstoolsandrepair-production`
5. Permission: Full Access (or Mail Send only)
6. Copy the key (shown only once!)

**Format**:
```
SENDGRID_API_KEY=SG.xxxxxxxxxxxxxxxxxxxx.yyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyy
```

---

### JWT Secret Key
**Variable**: `JWT_SECRET_KEY`

**How to generate**:
```bash
python3 -c "import secrets; print(secrets.token_urlsafe(32))"
```

**Format**:
```
JWT_SECRET_KEY=AaBbCcDd1234567890-_Random_String_Here
```

**⚠️ CRITICAL**: Never reuse JWT secrets between environments or after compromise!

---

### Digital Ocean Spaces Credentials (Optional)
**Variables**: `SPACES_KEY`, `SPACES_SECRET`

**When needed**: Only if enabling `USE_SPACES=true` for persistent photo storage

**How to generate**:
1. Login to Digital Ocean: https://cloud.digitalocean.com
2. Navigate to API → Spaces Keys
3. Click "Generate New Key"
4. Name: `cnstoolsandrepair-production`
5. Copy both Access Key and Secret Key

**Format**:
```
SPACES_KEY=DO00XXXXXXXXXXXXXXXX
SPACES_SECRET=xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
```

---

## 📋 Complete Environment Variable Template

Copy this to `backend/.env.production` and fill in placeholders:

```bash
# ========================================
# CNS Tools and Repair - Production Config
# ========================================
# SECURITY: This file is gitignored - never commit to version control
# Date: 2026-03-21
# ========================================

# Database Configuration
MONGODB_URL=your_production_mongodb_connection_string_here
DATABASE_NAME=cnstoolsandrepair_db_prod

# CORS Configuration (update with actual domain)
CORS_ORIGINS=https://cnstoolsandrepair.com,https://www.cnstoolsandrepair.com

# Email Configuration (SendGrid)
SENDGRID_API_KEY=your_sendgrid_api_key_here
SENDGRID_FROM_EMAIL=noreply@cnstoolsandrepair.com
NOTIFICATION_EMAIL=cnstoolsandrepair@gmail.com

# File Upload Configuration
MAX_FILE_SIZE=5242880
ALLOWED_EXTENSIONS=jpg,jpeg,png,webp
UPLOAD_DIR=uploads

# Digital Ocean Spaces (disabled by default)
USE_SPACES=false
SPACES_REGION=sfo3
SPACES_BUCKET=cnstoolsandrepair-photos
SPACES_KEY=your_spaces_key_here
SPACES_SECRET=your_spaces_secret_here
SPACES_ENDPOINT=https://sfo3.digitaloceanspaces.com

# Application Configuration
ENVIRONMENT=production
JWT_SECRET_KEY=your_jwt_secret_here
JWT_ALGORITHM=HS256
JWT_EXPIRATION_HOURS=8
```

---

## ✅ Validation Steps

### 1. Check for Placeholders
```bash
cd backend
grep "your_.*_here" .env.production
```

**Expected**: No output (all placeholders replaced)

### 2. Verify File Protection
```bash
git status .env.production
```

**Expected**: `Untracked files` or not shown (file is gitignored)

### 3. Test Configuration Locally (Optional)
```bash
cd backend
source venv/bin/activate
python3 -m uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

Visit: `http://localhost:8000/health`

**Expected**: `{"status":"healthy"}`

**⚠️ WARNING**: Testing with production config connects to production database!

---

## 🚀 Deployment to App Platform

### Copy Variables to App Platform

1. Go to App Platform → Your App → Settings → Environment Variables
2. Add each variable from `.env.production`
3. **Mark as Encrypted** (check lock icon):
   - `MONGODB_URL`
   - `SENDGRID_API_KEY`
   - `SPACES_SECRET`
   - `JWT_SECRET_KEY`

### Verification After Deployment

**Check health endpoint**:
```
https://your-app-url.ondigitalocean.app/health
```

**Should return**:
```json
{"status":"healthy"}
```

**If fails**: Check App Platform logs for connection errors

---

## 🔧 MongoDB Atlas Production Setup

### Network Access (Required)
1. Login to Atlas: https://cloud.mongodb.com
2. Click "Network Access"
3. Add IP Address: `0.0.0.0/0`
4. Comment: "App Platform dynamic IPs"
5. Confirm

**Why 0.0.0.0/0?** App Platform uses dynamic IPs - must allow all IPs for connection.

### Database Indexes (Post-Deployment)
After deployment, run initialization script:
```bash
python scripts/post_deployment.py
```

This creates 10 performance indexes for quotes, tools, brands, etc.

---

## ⚠️ Security Best Practices

### Credential Rotation Schedule
- **MongoDB password**: Rotate every 90 days
- **SendGrid API key**: Rotate every 180 days or after exposure
- **JWT secret**: Rotate if compromised or annually
- **Spaces credentials**: Rotate every 180 days

### Emergency Rotation (If Exposed)
1. **Immediately** change MongoDB password in Atlas
2. **Immediately** delete and recreate SendGrid API key
3. **Immediately** generate new JWT secret
4. Update `backend/.env.production` locally
5. Update App Platform environment variables
6. Redeploy application

### Storage Security
- **Local file**: `backend/.env.production` - Protected by `.gitignore`
- **Never commit**: Real credentials to version control
- **Never share**: Production credentials via email/chat
- **Use encrypted storage**: 1Password, Bitwarden, etc. for backup

---

## 🆘 Troubleshooting

### "MongoDB connection failed"
- Verify `MONGODB_URL` format is correct
- Check username/password have no special characters needing URL encoding
- Confirm network access allows 0.0.0.0/0 in Atlas
- Verify database name: `cnstoolsandrepair_db_prod`

### "CORS error in browser"
- Verify `CORS_ORIGINS` matches actual domain (with `https://`)
- Check browser console for blocked origin
- Update `CORS_ORIGINS` to include that origin
- Redeploy after changes

### "Email not sending"
- Verify `SENDGRID_API_KEY` is valid (not deleted)
- Check SendGrid dashboard for email status
- Confirm not exceeding free tier (100 emails/day)
- Test API key with SendGrid's test endpoint

### "Placeholders still in config"
- Run validation: `grep "your_.*_here" backend/.env.production`
- Replace all placeholders with real values
- Never deploy with placeholders

---

## 📚 Additional Resources

- **Deployment Guide**: `READY_TO_DEPLOY.md`
- **DNS Setup**: `HOSTINGER_DNS_SETUP.md`
- **Security Checklist**: `SECURITY_CHECKLIST.md`
- **Project Overview**: `CLAUDE.md`

---

## 🎉 Configuration Complete!

Once you've filled in the 2 required values and generated secrets, you're ready to deploy.

**Estimated setup time**: 15-20 minutes
**Next step**: See `READY_TO_DEPLOY.md` for deployment instructions
