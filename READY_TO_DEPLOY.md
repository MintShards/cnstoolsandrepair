# ✅ READY TO DEPLOY - Production Configuration Guide

**Status**: Configuration guide for production deployment
**Date**: 2026-03-21
**Security**: All credentials use placeholders - fill from local `.env.production`

---

## ⚠️ SECURITY NOTICE

**CRITICAL**: This file contains **PLACEHOLDERS ONLY**. Never commit real credentials to git.

Your actual credentials are in `backend/.env.production` (local file, gitignored).

---

## 🚀 Deployment Overview

### What You'll Deploy
- **Platform**: Digital Ocean App Platform
- **Stack**: FARM (FastAPI + React + MongoDB Atlas)
- **Custom Domain**: cnstoolrepair.com (Hostinger)
- **SSL**: Auto-generated via Let's Encrypt (free)
- **Cost**: ~$12/month (App Platform only, Spaces disabled)

### Prerequisites Checklist
- [ ] MongoDB Atlas production database created
- [ ] Custom domain registered (Hostinger)
- [ ] GitHub repository up to date
- [ ] Local `backend/.env.production` configured
- [ ] All credentials rotated (if previously exposed)

---

## 📋 Step 1: Create Production Database in MongoDB Atlas (5 min)

### Database Setup
1. Login to MongoDB Atlas: https://cloud.mongodb.com
2. Navigate to your cluster: **prod-cluster**
3. Click "Browse Collections"
4. Click "+ Create Database"
   - Database name: `cnstoolsandrepair_db_prod`
   - Collection name: `quotes`
5. Click "Create"

### Network Access Configuration
1. Go to "Network Access" in left sidebar
2. Click "Add IP Address"
3. Add: `0.0.0.0/0` (allow from anywhere)
4. Comment: "App Platform dynamic IPs"
5. Save

**Why 0.0.0.0/0?** App Platform uses dynamic IPs, so we must allow all IPs.

### Get Connection String
1. Click "Connect" on your cluster
2. Choose "Connect your application"
3. Driver: Python 3.12+
4. Copy connection string format:
   ```
   mongodb+srv://<username>:<password>@prod-cluster.t8ewwml.mongodb.net/<database>?retryWrites=true&w=majority&tls=true&appName=prod-cluster
   ```
5. Replace `<username>`, `<password>`, `<database>` with your actual values
6. Save this to `backend/.env.production` as `MONGODB_URL`

---

## 🔧 Step 2: Configure Environment Variables

### Required Variables (17 total)

Copy these to App Platform Settings → Environment Variables.

**⚠️ IMPORTANT**: Replace `your_*_here` with actual values from `backend/.env.production`

```bash
# Database Configuration
MONGODB_URL=your_production_mongodb_connection_string_here
DATABASE_NAME=cnstoolsandrepair_db_prod

# CORS Configuration (update with actual domain)
CORS_ORIGINS=https://cnstoolrepair.com,https://www.cnstoolrepair.com

# Email Configuration (SendGrid)
SENDGRID_API_KEY=your_sendgrid_api_key_here
SENDGRID_FROM_EMAIL=noreply@cnstoolrepair.com
NOTIFICATION_EMAIL=cnstoolrepair@gmail.com

# File Upload Configuration
MAX_FILE_SIZE=5242880
ALLOWED_EXTENSIONS=jpg,jpeg,png,webp
UPLOAD_DIR=uploads

# Digital Ocean Spaces (disabled but required)
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

### Mark as Encrypted (Lock Icon)
When adding to App Platform, check "Encrypt" for:
- `MONGODB_URL`
- `SENDGRID_API_KEY`
- `SPACES_SECRET`
- `JWT_SECRET_KEY`

---

## 🌐 Step 3: Deploy to Digital Ocean App Platform (20 min)

### Create New App
1. Login: https://cloud.digitalocean.com
2. Navigate to "Apps"
3. Click "Create App"
4. Connect GitHub repository: `cnstoolsandrepair`
5. Select branch: `main`

### Configure Backend Service
- **Name**: backend
- **Type**: Web Service
- **Source Directory**: `backend`
- **Dockerfile Path**: `backend/Dockerfile`
- **HTTP Port**: `8000`
- **Health Check Path**: `/health`
- **Instance Size**: Basic ($5/mo)

### Configure Frontend Service
- **Name**: frontend
- **Type**: Static Site
- **Source Directory**: `frontend`
- **Dockerfile Path**: `frontend/Dockerfile`
- **Instance Size**: Basic ($3/mo)

### Add Environment Variables
1. Go to Backend service settings
2. Click "Environment Variables"
3. Add all 17 variables from Step 2 above
4. Mark sensitive ones as encrypted
5. Save

### Deploy
1. Review all settings
2. Click "Create Resources"
3. Wait for build (~5-10 minutes)
4. Monitor build logs for errors
5. Note the App Platform URL (e.g., `https://your-app-xxxxx.ondigitalocean.app`)

---

## 🔐 Step 4: Initialize Production System (10 min)

### Access Backend Console
1. Go to your app → Backend service
2. Click "Console" tab

### Run Post-Deployment Script
```bash
python scripts/post_deployment.py
```

This script will:
- Create admin user (prompts for email/password)
- Create 10 database indexes for performance
- Test email configuration via SendGrid
- Generate deployment report

**⚠️ Save your admin credentials!**

---

## 🌍 Step 5: Configure Custom Domain (30 min)

See `HOSTINGER_DNS_SETUP.md` for detailed DNS configuration.

**Quick Steps**:
1. Add domain in App Platform Settings → Domains
2. Note the DNS records provided by App Platform
3. Login to Hostinger DNS management
4. Add A records pointing to App Platform IP
5. Wait for DNS propagation (~30 minutes)
6. SSL certificate auto-generates via Let's Encrypt

---

## ✅ Step 6: Test Everything (10 min)

### Test 1: Health Check
Visit: `https://your-app-url.ondigitalocean.app/health`

Should return: `{"status":"healthy"}`

### Test 2: Submit Test Quote
1. Go to `/repair-request`
2. Fill out form with test data
3. Upload test photo
4. Submit

**Verify**:
- Form submits successfully
- Email received at `cnstoolrepair@gmail.com`
- Quote appears in database

### Test 3: Admin Login
1. Go to `/admin/login`
2. Login with credentials from Step 4
3. Check Quotes tab for test quote

### Test 4: Rate Limiting
Submit 5 quotes quickly - 6th should be blocked.

---

## 💰 Cost Breakdown

**Monthly Costs**:
- Backend (Basic): $5/mo
- Frontend (Basic): $3/mo
- Platform overhead: ~$4/mo
- MongoDB Atlas: $0 (free tier)
- SendGrid: $0 (free tier, 100 emails/day)
- **Total**: ~$12/month

---

## ⚠️ Important Notes

### Photo Storage
With `USE_SPACES=false`:
- ✅ Works immediately without setup
- ⚠️ Photos lost on container restart/redeploy
- ⚠️ Not suitable for permanent photo storage

**To enable persistent storage later**:
1. Create Digital Ocean Spaces ($5/mo)
2. Update `USE_SPACES=true` in environment variables
3. Add Spaces credentials
4. Redeploy

### Database Must Exist First
Create `cnstoolsandrepair_db_prod` in Atlas **before** deployment, or app will fail to start.

### Network Access
MongoDB Atlas must allow `0.0.0.0/0` for App Platform to connect.

---

## 🆘 Troubleshooting

### App Won't Start
**Check**: Runtime logs in App Platform
**Common issue**: MongoDB connection failed
**Fix**: Verify network access allows 0.0.0.0/0 in Atlas

### Email Not Sending
**Check**: SendGrid dashboard activity log
**Common issue**: API key invalid or daily limit exceeded
**Fix**: Verify `SENDGRID_API_KEY` is correct (100 emails/day free tier)

### CORS Error
**Check**: Browser console shows CORS error
**Fix**: Update `CORS_ORIGINS` to match actual domain (with https://)

### Photos Not Working
**Expected**: Photos work but disappear on redeploy (USE_SPACES=false)
**Fix**: Enable Spaces if permanent storage needed

---

## 📚 Additional Resources

- **DNS Setup**: `HOSTINGER_DNS_SETUP.md`
- **Environment Guide**: `PRODUCTION_ENV_GUIDE.md`
- **Security Checklist**: `SECURITY_CHECKLIST.md`
- **Project Overview**: `CLAUDE.md`

---

## 🎯 Deployment Checklist

**Before Deployment**:
- [ ] MongoDB production database created
- [ ] Network access configured (0.0.0.0/0)
- [ ] All 17 environment variables ready
- [ ] Local `.env.production` has real credentials
- [ ] GitHub repository up to date

**After Deployment**:
- [ ] Build completed successfully
- [ ] Health check passes
- [ ] Post-deployment script run
- [ ] Admin user created
- [ ] Test quote submitted
- [ ] Email received
- [ ] Custom domain configured
- [ ] SSL certificate active

---

## 🚀 Ready to Deploy!

**Estimated time**: 45-60 minutes

1. Create MongoDB database (5 min)
2. Create App Platform app (15 min)
3. Wait for build (10 min)
4. Run post-deployment script (10 min)
5. Configure DNS (30 min for propagation)
6. Test everything (5 min)

**Start with Step 1: Create the MongoDB production database**

Good luck! 🎉
