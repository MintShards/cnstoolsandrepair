# Digital Ocean Droplet Deployment Guide

Complete step-by-step guide for deploying CNS Tool Repair to production on Digital Ocean Droplet.

## Table of Contents
1. [Prerequisites](#prerequisites)
2. [Pre-Deployment Checklist](#pre-deployment-checklist)
3. [Droplet Setup](#droplet-setup)
4. [Digital Ocean Spaces Setup](#digital-ocean-spaces-setup)
5. [MongoDB Atlas Production Database](#mongodb-atlas-production-database)
6. [Environment Configuration](#environment-configuration)
7. [SSL Certificate Setup](#ssl-certificate-setup)
8. [Deployment](#deployment)
9. [Post-Deployment Verification](#post-deployment-verification)
10. [Troubleshooting](#troubleshooting)

---

## Prerequisites

### Required Accounts
- [ ] Digital Ocean account with billing enabled
- [ ] MongoDB Atlas account (free tier OK for initial deployment)
- [ ] SendGrid account with verified sender domain
- [ ] Domain name with DNS access

### Required Tools (Local)
- [ ] Git
- [ ] SSH client

### Cost Estimate
| Service | Plan | Monthly Cost |
|---------|------|--------------|
| DO Droplet | 4GB RAM, 2 vCPUs, 80GB SSD | $24 |
| DO Spaces | 250GB storage, 1TB bandwidth | $5 |
| MongoDB Atlas | M0 Free Tier | $0 |
| SendGrid | Free (100 emails/day) | $0 |
| **Total** | | **~$29/month** |

---

## Pre-Deployment Checklist

### Code Changes (Already Implemented)
- [x] Gunicorn added to `backend/requirements.txt`
- [x] Backend Dockerfile updated with production CMD
- [x] Production docker-compose file created (`docker-compose.prod.yml`)
- [x] Frontend Dockerfile supports build args for `VITE_API_URL`
- [x] Production nginx config with SSL created (`frontend/nginx.prod.conf`)
- [x] Production environment template created (`backend/.env.production.template`)

### Before You Start
- [ ] Domain DNS propagated (point A record to droplet IP - you'll get this after creating droplet)
- [ ] SendGrid sender domain verified
- [ ] Production database created in MongoDB Atlas
- [ ] Digital Ocean Spaces created and configured

---

## Droplet Setup

### 1. Create Droplet

**Via Digital Ocean Dashboard:**
1. Click "Create" → "Droplets"
2. **Choose Image**: Ubuntu 22.04 LTS
3. **Droplet Type**: Basic
4. **CPU Options**: Regular (2 vCPUs, 4GB RAM, 80GB SSD - $24/month)
5. **Datacenter Region**: Choose closest to target audience (e.g., New York for North America)
6. **Authentication**:
   - **Recommended**: SSH keys (more secure)
   - **Alternative**: Password (enable if no SSH key available)
7. **Optional Add-ons**:
   - [x] Enable Monitoring (free)
   - [x] Enable Automated Backups ($4.80/month - recommended)
8. **Hostname**: `cns-tools-prod` or similar
9. Click "Create Droplet"

**Save the droplet IP address** - you'll need it for DNS and SSH access.

### 2. Configure DNS

**Update your domain's DNS records:**

| Type | Name | Value | TTL |
|------|------|-------|-----|
| A | @ | `<droplet-ip>` | 3600 |
| A | www | `<droplet-ip>` | 3600 |

Wait 5-60 minutes for DNS propagation. Verify with:
```bash
# Check DNS propagation
nslookup yourdomain.com
dig yourdomain.com
```

### 3. Initial Server Setup

**SSH into your droplet:**
```bash
ssh root@<droplet-ip>
```

**Update system packages:**
```bash
apt update && apt upgrade -y
```

**Install required software:**
```bash
# Install Docker
apt install -y docker.io docker-compose

# Enable and start Docker
systemctl enable docker
systemctl start docker

# Install Certbot for SSL certificates
apt install -y certbot python3-certbot-nginx

# Install Git
apt install -y git

# Install basic utilities
apt install -y ufw fail2ban
```

**Verify installations:**
```bash
docker --version          # Should show Docker version
docker-compose --version  # Should show docker-compose version
certbot --version         # Should show certbot version
```

### 4. Security Hardening

**Configure firewall:**
```bash
# Allow SSH (important - do this first!)
ufw allow 22/tcp

# Allow HTTP and HTTPS
ufw allow 80/tcp
ufw allow 443/tcp

# Enable firewall
ufw --force enable

# Verify firewall status
ufw status
```

**Configure fail2ban (protects against brute force attacks):**
```bash
systemctl enable fail2ban
systemctl start fail2ban
```

**Optional: Disable root SSH login (after setting up non-root user):**
```bash
# Create non-root user
adduser deploy
usermod -aG sudo deploy
usermod -aG docker deploy

# Copy SSH keys to new user (if using SSH key authentication)
rsync --archive --chown=deploy:deploy ~/.ssh /home/deploy

# Test SSH as new user in new terminal before disabling root
# ssh deploy@<droplet-ip>

# Then disable root login (edit sshd_config)
nano /etc/ssh/sshd_config
# Change: PermitRootLogin yes → PermitRootLogin no
systemctl restart sshd
```

---

## Digital Ocean Spaces Setup

### 1. Create Space

1. Digital Ocean Dashboard → "Manage" → "Spaces"
2. Click "Create Space"
3. **Region**: Choose same as droplet (e.g., NYC3)
4. **Space Name**: `cnstoolsandrepair-photos`
5. **Enable CDN**: Yes (recommended for faster image delivery)
6. **File Listing**: Restricted (recommended for security)
7. Click "Create Space"

### 2. Generate Access Keys

1. Navigate to "API" → "Spaces Keys"
2. Click "Generate New Key"
3. **Name**: `cns-tools-production`
4. **Save the Key and Secret** - you'll need these for `.env` configuration

### 3. Configure CORS

**Enable CORS for your domain:**

1. Go to your Space → "Settings" → "CORS Configurations"
2. Add new CORS rule:
   - **Origin**: `https://yourdomain.com`
   - **Allowed Methods**: GET, PUT, POST, DELETE
   - **Allowed Headers**: *
3. Save CORS configuration

### 4. Test Space Access

**Upload test file via CLI (optional):**
```bash
# Install AWS CLI (Spaces is S3-compatible)
apt install -y awscli

# Configure AWS CLI for Spaces
aws configure
# AWS Access Key ID: <your-spaces-key>
# AWS Secret Access Key: <your-spaces-secret>
# Default region name: nyc3
# Default output format: json

# Test upload
echo "test" > test.txt
aws s3 cp test.txt s3://cnstoolsandrepair-photos/test.txt --endpoint-url=https://nyc3.digitaloceanspaces.com

# Verify upload in DO dashboard
```

---

## MongoDB Atlas Production Database

### 1. Create Production Database

1. MongoDB Atlas Dashboard → "Browse Collections"
2. Click "Create Database"
3. **Database Name**: `cnstoolsandrepair_db_prod`
4. **Collection Name**: `settings` (initial collection)
5. Click "Create"

### 2. Configure Network Access

**Whitelist droplet IP:**

1. Atlas Dashboard → "Network Access"
2. Click "Add IP Address"
3. **Access List Entry**: `<droplet-ip>/32`
4. **Comment**: `Production Droplet`
5. Click "Confirm"

### 3. Get Connection String

1. Atlas Dashboard → "Database" → "Connect"
2. Select "Connect your application"
3. **Driver**: Python, **Version**: 3.12 or later
4. Copy connection string: `mongodb+srv://<username>:<password>@...`
5. **Save this for `.env` configuration**

### 4. Create Production Database User (Optional - Recommended)

**Create separate user for production:**

1. Atlas Dashboard → "Database Access"
2. Click "Add New Database User"
3. **Authentication Method**: Password
4. **Username**: `cns_prod_user`
5. **Password**: Generate secure password
6. **Database User Privileges**: "Read and write to any database"
7. Click "Add User"

**Update connection string with new credentials.**

---

## Environment Configuration

### 1. Clone Repository on Droplet

```bash
# Create deployment directory
mkdir -p /opt/apps
cd /opt/apps

# Clone repository
git clone https://github.com/yourusername/cnstoolsandrepair.git
cd cnstoolsandrepair
```

### 2. Create Production Environment File

```bash
cd /opt/apps/cnstoolsandrepair/backend

# Copy production template
cp .env.production.template .env

# Edit with production values
nano .env
```

**Fill in all values (replace placeholders):**

```env
# MongoDB - Production Database
MONGODB_URL=mongodb+srv://cns_prod_user:<PASSWORD>@cluster.mongodb.net/cnstoolsandrepair_db_prod?retryWrites=true&w=majority&tls=true
DATABASE_NAME=cnstoolsandrepair_db_prod

# CORS - Your Production Domain
CORS_ORIGINS=https://yourdomain.com,https://www.yourdomain.com

# SendGrid - Production Keys
SENDGRID_API_KEY=SG.your_actual_production_key_here
SENDGRID_FROM_EMAIL=noreply@cnstoolrepair.com
NOTIFICATION_EMAIL=cnstoolrepair@gmail.com

# Digital Ocean Spaces - Your Actual Credentials
USE_SPACES=true
SPACES_REGION=nyc3
SPACES_BUCKET=cnstoolsandrepair-photos
SPACES_KEY=DO00XXXXXXXXXXXXX
SPACES_SECRET=your_actual_spaces_secret_here
SPACES_ENDPOINT=https://nyc3.digitaloceanspaces.com
UPLOAD_BASE_URL=https://cnstoolsandrepair-photos.nyc3.cdn.digitaloceanspaces.com

# JWT - Generate New Production Secret
JWT_SECRET_KEY=<generate_new_secret_here>

# Environment
ENVIRONMENT=production
```

### 3. Generate Production JWT Secret

```bash
# Generate secure JWT secret
python3 -c "import secrets; print(secrets.token_urlsafe(32))"

# Copy output and paste into .env JWT_SECRET_KEY
```

### 4. Create .env for Docker Compose

**Create root-level `.env` for docker-compose:**

```bash
cd /opt/apps/cnstoolsandrepair

# Create .env file for docker-compose
cat > .env << 'EOF'
# Load all backend environment variables
MONGODB_URL=mongodb+srv://cns_prod_user:<PASSWORD>@cluster.mongodb.net/cnstoolsandrepair_db_prod?retryWrites=true&w=majority&tls=true
DATABASE_NAME=cnstoolsandrepair_db_prod
CORS_ORIGINS=https://yourdomain.com,https://www.yourdomain.com
SENDGRID_API_KEY=SG.your_actual_key
SENDGRID_FROM_EMAIL=noreply@cnstoolrepair.com
NOTIFICATION_EMAIL=cnstoolrepair@gmail.com
JWT_SECRET_KEY=your_generated_jwt_secret
USE_SPACES=true
SPACES_KEY=DO00XXXXXXXXXXXXX
SPACES_SECRET=your_spaces_secret
SPACES_REGION=nyc3
SPACES_BUCKET=cnstoolsandrepair-photos
SPACES_ENDPOINT=https://nyc3.digitaloceanspaces.com
UPLOAD_BASE_URL=https://cnstoolsandrepair-photos.nyc3.cdn.digitaloceanspaces.com

# Frontend build arg
VITE_API_URL=https://yourdomain.com
EOF

# Secure the .env file
chmod 600 .env
```

### 5. Update nginx.prod.conf with Your Domain

```bash
cd /opt/apps/cnstoolsandrepair/frontend

# Edit nginx.prod.conf
nano nginx.prod.conf

# Replace 'yourdomain.com' with your actual domain in:
# - Line 3: server_name yourdomain.com www.yourdomain.com;
# - Line 12: server_name yourdomain.com www.yourdomain.com;
# - Line 16-17: SSL certificate paths
```

---

## SSL Certificate Setup

### 1. Obtain Let's Encrypt SSL Certificate

**Stop any running web servers first:**
```bash
# If nginx is running
systemctl stop nginx

# Or stop docker containers if running
cd /opt/apps/cnstoolsandrepair
docker-compose -f docker-compose.prod.yml down
```

**Run Certbot in standalone mode:**
```bash
certbot certonly --standalone -d yourdomain.com -d www.yourdomain.com

# Follow prompts:
# - Enter email address for renewal notifications
# - Agree to Terms of Service
# - (Optional) Share email with EFF
```

**Verify certificate obtained:**
```bash
ls -la /etc/letsencrypt/live/yourdomain.com/
# Should see: cert.pem, chain.pem, fullchain.pem, privkey.pem
```

### 2. Configure Auto-Renewal

**Enable Certbot timer:**
```bash
systemctl enable certbot.timer
systemctl start certbot.timer

# Verify timer is active
systemctl status certbot.timer
```

**Test renewal process (dry run):**
```bash
certbot renew --dry-run
```

**Note**: Certificates auto-renew every 60 days. The timer checks twice daily.

---

## Deployment

### 1. Build Docker Images

```bash
cd /opt/apps/cnstoolsandrepair

# Build images (this will take 5-10 minutes)
docker-compose -f docker-compose.prod.yml build
```

**Expected output:**
- Backend: Python dependencies installed, gunicorn ready
- Frontend: npm packages installed, Vite build completed, nginx configured

### 2. Start Services

```bash
# Start containers in detached mode
docker-compose -f docker-compose.prod.yml up -d

# Verify containers are running
docker ps
# Should show: cns-backend-prod, cns-frontend-prod
```

### 3. Check Logs

```bash
# Backend logs
docker logs cns-backend-prod

# Frontend logs
docker logs cns-frontend-prod

# Follow logs in real-time
docker logs -f cns-backend-prod
```

**Expected in backend logs:**
```
INFO:     Started server process
INFO:     Waiting for application startup.
INFO:     Application startup complete.
INFO:     Uvicorn running on http://0.0.0.0:8000
```

### 4. Create Admin User

```bash
# Enter backend container
docker exec -it cns-backend-prod bash

# Run admin creation script
python scripts/create_admin.py

# Follow prompts to create admin account
# Exit container
exit
```

---

## Post-Deployment Verification

### 1. Test Website Access

**Open browser and test:**
- [ ] `https://yourdomain.com` - Homepage loads
- [ ] Check SSL certificate (should show green padlock)
- [ ] Navigate to all pages (Services, Industries, About, Contact, Gallery)

### 2. Test Quote Submission

1. Navigate to `/repair-request`
2. Fill out form with test data
3. Add test tool and upload photo
4. Submit quote
5. **Verify**:
   - [ ] Success message displayed
   - [ ] Email received at notification address
   - [ ] Photo uploaded to Digital Ocean Spaces (check DO dashboard)
   - [ ] Quote appears in admin panel

### 3. Test Admin Panel

1. Navigate to `/admin/login`
2. Login with admin credentials
3. **Verify**:
   - [ ] Login successful
   - [ ] All tabs load (Home, Services, Industries, Gallery, etc.)
   - [ ] Quote appears in Quotes tab with correct status

### 4. Test API Endpoints

```bash
# Health check
curl https://yourdomain.com/api/settings/health

# Should return: {"status":"ok"}

# API documentation
# Open: https://yourdomain.com/docs
# Swagger UI should load
```

### 5. Performance Testing

**Test page load speed:**
- Use Chrome DevTools → Network tab
- Homepage should load in < 3 seconds
- API responses should be < 500ms

**Test file uploads:**
- Upload 5MB photo (max size)
- Should complete in < 10 seconds

---

## Troubleshooting

### Container Won't Start

**Check logs:**
```bash
docker logs cns-backend-prod
docker logs cns-frontend-prod
```

**Common issues:**

1. **MongoDB connection failed**
   - Verify droplet IP is whitelisted in Atlas
   - Check connection string in `.env`
   - Test connection: `mongo "mongodb+srv://..."`

2. **Environment variables missing**
   - Verify `.env` file exists in project root
   - Check all required variables are set
   - Restart containers: `docker-compose -f docker-compose.prod.yml restart`

3. **Port conflicts**
   - Check if port 80/443 already in use: `netstat -tulpn | grep :80`
   - Stop conflicting services

### SSL Certificate Issues

**Certificate not loading:**
```bash
# Verify certificate exists
ls -la /etc/letsencrypt/live/yourdomain.com/

# Check nginx config syntax
docker exec cns-frontend-prod nginx -t

# View nginx error logs
docker logs cns-frontend-prod
```

**Certificate renewal fails:**
```bash
# Stop frontend container temporarily
docker stop cns-frontend-prod

# Renew manually
certbot renew

# Restart container
docker start cns-frontend-prod
```

### File Upload Fails

**Check Spaces configuration:**
```bash
# Verify Spaces credentials in .env
docker exec cns-backend-prod printenv | grep SPACES

# Test Spaces connectivity from backend
docker exec -it cns-backend-prod bash
python -c "import boto3; s3=boto3.client('s3', endpoint_url='https://nyc3.digitaloceanspaces.com', aws_access_key_id='YOUR_KEY', aws_secret_access_key='YOUR_SECRET'); print(s3.list_buckets())"
```

**Common Spaces issues:**
- Invalid credentials → regenerate keys in DO dashboard
- Wrong region → verify `SPACES_REGION=nyc3` matches Space region
- CORS errors → add domain to Space CORS settings

### Email Not Sending

**Check SendGrid configuration:**
```bash
# Verify SendGrid API key
docker exec cns-backend-prod printenv | grep SENDGRID

# Check backend logs for email errors
docker logs cns-backend-prod | grep -i email
```

**Common SendGrid issues:**
- Invalid API key → regenerate in SendGrid dashboard
- Sender domain not verified → verify domain in SendGrid
- Daily limit exceeded → check SendGrid usage dashboard

### High Memory Usage

**Monitor container resources:**
```bash
# Check container stats
docker stats

# If backend uses too much memory:
# Reduce gunicorn workers in backend/Dockerfile
# Change --workers 4 to --workers 2
```

### Database Connection Timeouts

**Optimize MongoDB connection:**
```bash
# Edit backend/.env
# Add connection pool settings to MONGODB_URL:
# ?retryWrites=true&w=majority&tls=true&maxPoolSize=10&minPoolSize=2

# Restart backend
docker-compose -f docker-compose.prod.yml restart backend
```

---

## Maintenance

### Regular Updates

**Update application code:**
```bash
cd /opt/apps/cnstoolsandrepair
git pull origin main
docker-compose -f docker-compose.prod.yml build
docker-compose -f docker-compose.prod.yml up -d
```

**Update system packages:**
```bash
apt update && apt upgrade -y
```

**Update Docker images:**
```bash
docker-compose -f docker-compose.prod.yml pull
docker-compose -f docker-compose.prod.yml up -d
```

### Backup Strategy

**1. MongoDB Atlas Backups**
- Atlas provides automatic backups (check Atlas dashboard)
- Test restore procedure quarterly

**2. Droplet Backups**
- Enable weekly backups in DO dashboard ($4.80/month)
- Create manual snapshot before major updates

**3. Spaces Backups**
- Enable versioning in Space settings
- Export critical files regularly

**4. Environment Files**
- Backup `.env` files to secure password manager
- **Never commit to git**

### Monitoring Setup

**1. Digital Ocean Monitoring**
- Enable in Droplet dashboard (free)
- Set up alerts for:
  - High CPU usage (> 80%)
  - High memory usage (> 90%)
  - High disk usage (> 85%)

**2. Application Monitoring (Optional)**
- Consider Sentry for error tracking
- Setup uptime monitoring (UptimeRobot, Pingdom)

**3. Log Monitoring**
```bash
# Check disk space used by logs
du -sh /var/lib/docker/containers/

# Rotate logs (Docker handles automatically, but verify)
docker system prune --volumes -f
```

---

## Security Best Practices

1. **Regular Security Updates**
   ```bash
   apt update && apt upgrade -y
   ```

2. **Monitor Access Logs**
   ```bash
   docker logs cns-frontend-prod | grep -i error
   ```

3. **Review Firewall Rules**
   ```bash
   ufw status
   ```

4. **Rotate JWT Secrets Annually**
   - Generate new secret
   - Update `.env`
   - Restart backend
   - All users must re-login

5. **Monitor Failed Login Attempts**
   ```bash
   docker logs cns-backend-prod | grep "login failed"
   ```

---

## Rollback Procedure

**If deployment fails:**

```bash
# Stop containers
docker-compose -f docker-compose.prod.yml down

# Restore previous version
git checkout <previous-commit-hash>

# Rebuild and restart
docker-compose -f docker-compose.prod.yml build
docker-compose -f docker-compose.prod.yml up -d
```

---

## Support Resources

- **Digital Ocean Docs**: https://docs.digitalocean.com/
- **MongoDB Atlas Docs**: https://docs.atlas.mongodb.com/
- **SendGrid Docs**: https://docs.sendgrid.com/
- **Let's Encrypt**: https://letsencrypt.org/docs/
- **FastAPI Deployment**: https://fastapi.tiangolo.com/deployment/

---

## Production Checklist Summary

Before going live:

- [ ] DNS pointing to droplet IP
- [ ] SSL certificate obtained and configured
- [ ] MongoDB production database created and whitelisted
- [ ] Digital Ocean Spaces created and CORS configured
- [ ] All environment variables set in `.env`
- [ ] Firewall configured (UFW)
- [ ] Admin user created
- [ ] Quote submission tested end-to-end
- [ ] Email delivery verified
- [ ] Photo upload to Spaces verified
- [ ] Backups enabled
- [ ] Monitoring configured
- [ ] Security hardening completed

---

**Deployment complete!** 🚀

Your CNS Tool Repair website is now live in production.
