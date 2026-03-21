# 🚀 CNS Tools and Repair - Deployment Ready Guide

**Domain**: cnstoolsandrepair.com
**Infrastructure Status**: ✅ All services provisioned and ready

---

## ✅ Infrastructure Checklist (Completed)

You have confirmed the following are ready:

- [x] **MongoDB Atlas** - Production database created
- [x] **Digital Ocean Spaces** - Storage bucket configured
- [x] **SendGrid** - Email service ready
- [x] **Domain** - cnstoolsandrepair.com registered

---

## 📋 Pre-Deployment Configuration

### Step 1: Gather Credentials

Before deploying, collect these credentials from your services:

#### **MongoDB Atlas**
- [ ] Production connection string
  - Format: `mongodb+srv://username:password@cluster.mongodb.net/cnstoolsandrepair_db_prod?retryWrites=true&w=majority&tls=true`
  - Get from: Atlas Dashboard → Database → Connect → Connect your application
- [ ] Database name: `cnstoolsandrepair_db_prod`

#### **Digital Ocean Spaces**
- [ ] Spaces Access Key (starts with `DO00`)
- [ ] Spaces Secret Key
- [ ] Space name (bucket): Your chosen bucket name
- [ ] Region: (e.g., `nyc3`, `sfo3`, `sgp1`)
  - Get from: DO Dashboard → Spaces → API

#### **SendGrid**
- [ ] API Key (starts with `SG.`)
  - Get from: SendGrid Dashboard → Settings → API Keys
- [ ] Verified sender email: `noreply@cnstoolsandrepair.com`
- [ ] Notification email: Your business email

#### **Digital Ocean Droplet**
- [ ] Droplet IP address (you'll get this after creating droplet)
- [ ] SSH access configured

---

## 🎯 Quick Deployment Path

### Option A: Manual Deployment (Recommended for First Time)

Follow the comprehensive guide: **DEPLOYMENT_DO_DROPLET.md**

### Option B: Fast-Track Deployment (For Experienced Users)

Follow this guide for a streamlined deployment process.

---

## 🚀 Fast-Track Deployment Steps

### 1. Create Digital Ocean Droplet

**Via DO Dashboard:**
1. Create → Droplets
2. **Image**: Ubuntu 22.04 LTS
3. **Plan**: Basic - 4GB RAM / 2 vCPUs ($24/month)
4. **Region**: Same as your Spaces (e.g., NYC3)
5. **Authentication**: SSH Key (recommended)
6. **Hostname**: `cns-tools-prod`
7. **Enable**: Monitoring + Backups
8. **Create Droplet**

**Save the droplet IP**: `<DROPLET_IP>`

---

### 2. Configure DNS

**Update DNS for cnstoolsandrepair.com:**

| Type | Name | Value | TTL |
|------|------|-------|-----|
| A | @ | `<DROPLET_IP>` | 3600 |
| A | www | `<DROPLET_IP>` | 3600 |

**Wait 15-30 minutes for DNS propagation**, then verify:
```bash
nslookup cnstoolsandrepair.com
```

---

### 3. Server Initial Setup

**SSH into droplet:**
```bash
ssh root@<DROPLET_IP>
```

**Run setup script:**
```bash
# Update system
apt update && apt upgrade -y

# Install dependencies
apt install -y docker.io docker-compose git certbot python3-certbot-nginx ufw fail2ban

# Enable Docker
systemctl enable docker && systemctl start docker

# Configure firewall
ufw allow 22/tcp
ufw allow 80/tcp
ufw allow 443/tcp
ufw --force enable

# Enable fail2ban
systemctl enable fail2ban && systemctl start fail2ban
```

---

### 4. Clone Repository

```bash
# Create deployment directory
mkdir -p /opt/apps && cd /opt/apps

# Clone repository (replace with your repo URL)
git clone https://github.com/yourusername/cnstoolsandrepair.git
cd cnstoolsandrepair
```

---

### 5. Configure Environment Variables

**Create production .env file:**

```bash
cd /opt/apps/cnstoolsandrepair

# Create .env from template
cat > .env << 'EOF'
# MongoDB Atlas - Production
MONGODB_URL=mongodb+srv://USERNAME:PASSWORD@CLUSTER.mongodb.net/cnstoolsandrepair_db_prod?retryWrites=true&w=majority&tls=true
DATABASE_NAME=cnstoolsandrepair_db_prod

# CORS - Production Domain
CORS_ORIGINS=https://cnstoolsandrepair.com,https://www.cnstoolsandrepair.com

# SendGrid - Email Service
SENDGRID_API_KEY=SG.YOUR_SENDGRID_API_KEY_HERE
SENDGRID_FROM_EMAIL=noreply@cnstoolsandrepair.com
NOTIFICATION_EMAIL=your-business-email@example.com

# Digital Ocean Spaces
USE_SPACES=true
SPACES_REGION=nyc3
SPACES_BUCKET=your-bucket-name
SPACES_KEY=DO00XXXXXXXXXXXXX
SPACES_SECRET=your_spaces_secret_key
SPACES_ENDPOINT=https://nyc3.digitaloceanspaces.com
UPLOAD_BASE_URL=https://your-bucket-name.nyc3.cdn.digitaloceanspaces.com

# JWT - Generate new secret
JWT_SECRET_KEY=REPLACE_WITH_GENERATED_SECRET
JWT_ALGORITHM=HS256
JWT_EXPIRATION_HOURS=8

# Frontend API URL
VITE_API_URL=https://cnstoolsandrepair.com

# File Upload
MAX_FILE_SIZE=5242880
ALLOWED_EXTENSIONS=jpg,jpeg,png,webp

# Environment
ENVIRONMENT=production
EOF

# Generate JWT secret and add to .env
echo "JWT_SECRET_KEY=$(python3 -c 'import secrets; print(secrets.token_urlsafe(32))')" >> .env

# Secure .env
chmod 600 .env
```

**Now edit .env with your actual credentials:**
```bash
nano .env
```

Replace these placeholders:
- `USERNAME:PASSWORD@CLUSTER` - Your MongoDB credentials
- `SG.YOUR_SENDGRID_API_KEY_HERE` - Your SendGrid API key
- `your-business-email@example.com` - Your notification email
- `your-bucket-name` - Your Spaces bucket name
- `DO00XXXXXXXXXXXXX` - Your Spaces access key
- `your_spaces_secret_key` - Your Spaces secret key
- Update `SPACES_REGION` if not nyc3

---

### 6. Update Nginx Configuration

```bash
cd /opt/apps/cnstoolsandrepair/frontend

# Edit nginx.prod.conf to use your domain
sed -i 's/yourdomain\.com/cnstoolsandrepair.com/g' nginx.prod.conf

# Verify changes
grep "server_name" nginx.prod.conf
# Should show: server_name cnstoolsandrepair.com www.cnstoolsandrepair.com;
```

---

### 7. Obtain SSL Certificate

**Stop any web servers:**
```bash
systemctl stop nginx 2>/dev/null || true
```

**Get Let's Encrypt certificate:**
```bash
certbot certonly --standalone \
  -d cnstoolsandrepair.com \
  -d www.cnstoolsandrepair.com \
  --non-interactive \
  --agree-tos \
  --email your-email@example.com
```

Replace `your-email@example.com` with your email for renewal notifications.

**Enable auto-renewal:**
```bash
systemctl enable certbot.timer
systemctl start certbot.timer
```

---

### 8. Deploy Application

```bash
cd /opt/apps/cnstoolsandrepair

# Build Docker images
docker-compose -f docker-compose.prod.yml build

# Start services
docker-compose -f docker-compose.prod.yml up -d

# Verify containers running
docker ps
```

**Expected output:**
```
CONTAINER ID   IMAGE                     STATUS         PORTS
xxxxxxxxxxxx   cns-frontend-prod         Up X seconds   0.0.0.0:80->80/tcp, 0.0.0.0:443->443/tcp
xxxxxxxxxxxx   cns-backend-prod          Up X seconds
```

---

### 9. Create Admin User

```bash
# Enter backend container
docker exec -it cns-backend-prod bash

# Create admin user
python scripts/create_admin.py

# Follow prompts:
# - Email: your-admin-email@example.com
# - Password: [choose secure password]

# Exit container
exit
```

---

### 10. Whitelist Droplet IP in MongoDB Atlas

**Important:** MongoDB Atlas needs to allow connections from your droplet.

1. Go to MongoDB Atlas Dashboard
2. Network Access → Add IP Address
3. Enter your droplet IP: `<DROPLET_IP>/32`
4. Comment: "Production Droplet"
5. Click "Confirm"

**Wait 1-2 minutes for Atlas to apply the change.**

---

## ✅ Post-Deployment Verification

### 1. Check Container Logs

```bash
# Backend logs (should show "Application startup complete")
docker logs cns-backend-prod

# Frontend logs (should show nginx started)
docker logs cns-frontend-prod

# Follow logs in real-time
docker logs -f cns-backend-prod
```

### 2. Test Website

**Open in browser:**
- [ ] https://cnstoolsandrepair.com - Homepage loads with SSL
- [ ] All pages load (Services, Industries, About, Contact, Gallery)
- [ ] No mixed content warnings
- [ ] Green padlock in browser

### 3. Test Quote Submission

1. Navigate to: https://cnstoolsandrepair.com/repair-request
2. Fill out form with test data
3. Add tool and upload test photo
4. Click Submit
5. **Verify:**
   - [ ] Success message appears
   - [ ] Email received at notification address
   - [ ] Check Spaces bucket - photo uploaded
   - [ ] Check admin panel - quote appears

### 4. Test Admin Panel

1. Navigate to: https://cnstoolsandrepair.com/admin/login
2. Login with admin credentials
3. **Verify:**
   - [ ] Login successful
   - [ ] All tabs accessible
   - [ ] Quote appears in Quotes tab

### 5. API Health Check

```bash
# From your local machine or droplet
curl https://cnstoolsandrepair.com/api/settings/health

# Expected response: {"status":"ok"}
```

---

## 🔧 Common Issues & Fixes

### Issue: "Cannot connect to MongoDB"

**Fix:**
```bash
# Verify droplet IP is whitelisted in Atlas
# Check connection string in .env
docker exec cns-backend-prod printenv MONGODB_URL

# Restart backend
docker-compose -f docker-compose.prod.yml restart backend
```

### Issue: "SSL certificate error"

**Fix:**
```bash
# Verify certificate exists
ls -la /etc/letsencrypt/live/cnstoolsandrepair.com/

# Check nginx config
docker exec cns-frontend-prod nginx -t

# Restart frontend
docker-compose -f docker-compose.prod.yml restart frontend
```

### Issue: "File upload fails"

**Fix:**
```bash
# Verify Spaces credentials
docker exec cns-backend-prod printenv | grep SPACES

# Test Spaces connectivity
docker exec -it cns-backend-prod bash
python3 << EOF
import boto3
s3 = boto3.client('s3',
    endpoint_url='https://nyc3.digitaloceanspaces.com',
    aws_access_key_id='YOUR_KEY',
    aws_secret_access_key='YOUR_SECRET')
print(s3.list_buckets())
EOF
exit
```

### Issue: "Email not sending"

**Fix:**
```bash
# Check SendGrid key
docker exec cns-backend-prod printenv SENDGRID_API_KEY

# View email-related logs
docker logs cns-backend-prod | grep -i email

# Verify sender domain in SendGrid dashboard
```

---

## 🔄 Update & Maintenance

### Deploy Code Updates

```bash
cd /opt/apps/cnstoolsandrepair

# Pull latest changes
git pull origin main

# Rebuild and restart
docker-compose -f docker-compose.prod.yml build
docker-compose -f docker-compose.prod.yml up -d
```

### View Logs

```bash
# View recent logs
docker logs --tail 100 cns-backend-prod
docker logs --tail 100 cns-frontend-prod

# Follow logs in real-time
docker logs -f cns-backend-prod
```

### Restart Services

```bash
# Restart all services
docker-compose -f docker-compose.prod.yml restart

# Restart specific service
docker-compose -f docker-compose.prod.yml restart backend
docker-compose -f docker-compose.prod.yml restart frontend
```

### System Updates

```bash
# Update system packages (monthly)
apt update && apt upgrade -y

# Reboot if kernel updated
reboot
```

---

## 📊 Monitoring

### Container Stats

```bash
# Real-time resource usage
docker stats

# Disk usage
df -h
du -sh /var/lib/docker/
```

### Setup Alerts (Recommended)

1. **Digital Ocean Monitoring** (Free)
   - Droplet dashboard → Monitoring → Enable
   - Set alerts for CPU/Memory/Disk > 80%

2. **Uptime Monitoring** (Free tier available)
   - UptimeRobot: https://uptimerobot.com
   - Monitor: https://cnstoolsandrepair.com
   - Alert email if site down > 5 minutes

---

## 🔐 Security Checklist

- [x] Firewall enabled (UFW)
- [x] Fail2ban protecting SSH
- [x] SSL/HTTPS enforced
- [x] Security headers configured
- [x] Production database separate from dev
- [x] Environment variables secured (chmod 600)
- [ ] Consider: Disable root SSH login (after testing)
- [ ] Consider: Setup non-root deploy user
- [ ] Schedule: Monthly security updates

---

## 💾 Backup Strategy

### Automated Backups

1. **Droplet Backups** (DO Dashboard)
   - Enable weekly backups ($4.80/month)
   - Retention: 4 weeks

2. **MongoDB Atlas Backups**
   - Automatic daily backups (check Atlas dashboard)
   - Test restore quarterly

3. **Spaces Files**
   - Enable versioning in Space settings
   - Critical files retain for 30 days

### Manual Backups

**Backup .env file:**
```bash
# From droplet
cp /opt/apps/cnstoolsandrepair/.env /root/env-backup-$(date +%Y%m%d).txt

# Download to local machine
scp root@<DROPLET_IP>:/root/env-backup-*.txt .

# Store securely (password manager)
```

---

## 🎉 Deployment Complete!

Your CNS Tools and Repair website is now live at:

**🌐 https://cnstoolsandrepair.com**

### Next Steps:

1. **Test thoroughly** - Click through all pages, submit test quotes
2. **Monitor for 24 hours** - Watch logs for errors
3. **Setup monitoring** - UptimeRobot for uptime alerts
4. **Document credentials** - Store .env backup securely
5. **Schedule maintenance** - Monthly security updates

---

## 📞 Support & Resources

- **Deployment Guide**: DEPLOYMENT_DO_DROPLET.md
- **Code Documentation**: CLAUDE.md
- **API Documentation**: https://cnstoolsandrepair.com/docs

**Need help?** Check troubleshooting section in DEPLOYMENT_DO_DROPLET.md

---

**Last Updated**: 2026-03-21
**Version**: 1.0.0 Production
