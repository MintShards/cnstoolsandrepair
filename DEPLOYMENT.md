# Production Deployment Guide

## ⚠️ CRITICAL: File Storage Migration Required

The current development setup uses **local filesystem storage** (`backend/uploads/`) which will **lose all uploaded photos** on production deployment. This affects:
- **Gallery photos** (uploaded via admin panel)
- **Quote request photos** (uploaded by customers)

**You MUST integrate Digital Ocean Spaces before production deployment.**

## Why Digital Ocean Spaces is Required

Production containers have ephemeral filesystems:
- App Platform containers reset on each deployment
- Local uploads don't survive restarts
- Quote photo URLs in emails would be broken
- Gallery photos would disappear after deployments

**Cost:** $5/month (250GB storage + 1TB bandwidth included)

## Deployment Options

### Option 1: App Platform + Spaces (RECOMMENDED)

**Architecture:**
```
Digital Ocean App Platform ($12/month)
├─ Backend (FastAPI container)
├─ Frontend (React static site)
└─ Auto-deploy from GitHub

Digital Ocean Spaces ($5/month)
└─ Permanent image storage (gallery + quotes)

MongoDB Atlas (Free tier)
└─ Database (already configured)

Total: ~$17/month
```

**Pros:**
- Fully managed platform (no server maintenance)
- Auto-deploy on GitHub push
- Automatic SSL certificates
- Built-in monitoring and logs
- Zero DevOps knowledge required

**Setup Steps:**
1. Create Spaces bucket: `cnstoolsandrepair-photos`
2. Generate Spaces access keys
3. Update backend code (see implementation section below)
4. Create App Platform app from GitHub repo
5. Configure environment variables
6. Deploy automatically

### Option 2: Droplet + Spaces

**Architecture:**
```
Digital Ocean Droplet ($6-12/month)
├─ Ubuntu server
├─ Docker Compose
├─ Nginx reverse proxy
└─ Manual Let's Encrypt SSL

Digital Ocean Spaces ($5/month)
MongoDB Atlas (Free tier)

Total: ~$11-17/month
```

**Pros:**
- More control over server configuration
- Slightly cheaper ($6 vs $12 for hosting)

**Cons:**
- Manual server setup and maintenance
- Manual SSL certificate renewal
- Manual deployments (git pull + restart)
- Requires DevOps knowledge

## Spaces Implementation Checklist

### 1. Create Spaces Bucket
- [ ] Login to Digital Ocean dashboard
- [ ] Create → Spaces → Choose NYC3 region
- [ ] Name: `cnstoolsandrepair-photos`
- [ ] Set permissions: Public read, private write
- [ ] Generate access keys (save securely)

### 2. Update Backend Code
- [ ] Install `boto3` library: Add to `requirements.txt`
- [ ] Update `backend/app/services/file_service.py` to upload to Spaces
- [ ] Organize folders: `gallery/` and `quotes/`
- [ ] Update delete endpoint to remove from Spaces
- [ ] Add Spaces config to `backend/app/config.py`
- [ ] Test locally with Spaces credentials

### 3. Migrate Existing Files
- [ ] Upload current `backend/uploads/` files to Spaces `gallery/` folder
- [ ] Update MongoDB records with full Spaces URLs
- [ ] Test image access from Spaces URLs

### 4. Environment Configuration

Add to `backend/.env.production`:
```env
# Digital Ocean Spaces
SPACES_REGION=nyc3
SPACES_BUCKET=cnstoolsandrepair-photos
SPACES_KEY=<your_spaces_access_key>
SPACES_SECRET=<your_spaces_secret_key>
SPACES_ENDPOINT=https://nyc3.digitaloceanspaces.com

# Update for production
MONGODB_URL=<atlas_production_connection_string>
DATABASE_NAME=cnstoolsandrepair_db_prod
CORS_ORIGINS=https://cnstoolsandrepair.com
ENVIRONMENT=production

# Email (same as dev)
SENDGRID_API_KEY=<your_sendgrid_api_key>
SENDGRID_FROM_EMAIL=noreply@cnstoolsandrepair.com
NOTIFICATION_EMAIL=cnstoolsandrepair@gmail.com

# JWT (generate new for production)
JWT_SECRET_KEY=<generate_new_with_secrets.token_urlsafe(32)>
JWT_ALGORITHM=HS256
JWT_EXPIRATION_HOURS=8

# File uploads (same)
MAX_FILE_SIZE=5242880
ALLOWED_EXTENSIONS=jpg,jpeg,png,webp
```

### 5. Test Production Setup
- [ ] Upload test photo via admin panel → verify in Spaces
- [ ] Submit test quote with photo → verify email has working Spaces URL
- [ ] Delete photo via admin panel → verify removed from Spaces
- [ ] Check public gallery page displays Spaces images

### 6. Deploy to Digital Ocean
- [ ] **If App Platform**: Create app, connect GitHub, set env vars
- [ ] **If Droplet**: SSH setup, Docker install, Nginx config, SSL cert
- [ ] Update DNS (Hostinger → Digital Ocean nameservers)
- [ ] Test production URL end-to-end

## File Organization in Spaces

```
cnstoolsandrepair-photos/
├── gallery/              # Gallery page photos (admin uploads)
│   ├── uuid1.jpg
│   ├── uuid2.png
│   └── uuid3.webp
│
└── quotes/               # Customer quote request photos
    ├── uuid4.jpg
    ├── uuid5.png
    └── uuid6.jpg
```

## Implementation Code Changes Required

### Backend Changes
1. `app/services/file_service.py` - Replace local save with Spaces upload
2. `app/routers/gallery.py` - Delete from Spaces instead of local disk
3. `app/routers/quotes.py` - Already uses file_service (automatic)
4. `app/config.py` - Add Spaces settings
5. `requirements.txt` - Add `boto3`

### Example: file_service.py Spaces Integration
```python
import boto3
from botocore.exceptions import ClientError
from app.config import settings

# Initialize Spaces client
s3_client = boto3.client(
    's3',
    region_name=settings.SPACES_REGION,
    endpoint_url=settings.SPACES_ENDPOINT,
    aws_access_key_id=settings.SPACES_KEY,
    aws_secret_access_key=settings.SPACES_SECRET
)

async def upload_file_to_spaces(file: UploadFile, folder: str) -> str:
    """Upload file to Digital Ocean Spaces, return public URL"""
    file_extension = file.filename.split(".")[-1]
    unique_filename = f"{uuid.uuid4()}.{file_extension}"
    key = f"{folder}/{unique_filename}"

    try:
        s3_client.upload_fileobj(
            file.file,
            settings.SPACES_BUCKET,
            key,
            ExtraArgs={'ACL': 'public-read'}
        )
        return f"{settings.SPACES_ENDPOINT}/{settings.SPACES_BUCKET}/{key}"
    except ClientError as e:
        raise HTTPException(status_code=500, detail=f"Upload failed: {str(e)}")

async def delete_file_from_spaces(file_url: str) -> bool:
    """Delete file from Spaces by URL"""
    # Extract key from URL
    key = file_url.split(f"{settings.SPACES_BUCKET}/")[-1]

    try:
        s3_client.delete_object(Bucket=settings.SPACES_BUCKET, Key=key)
        return True
    except ClientError as e:
        print(f"Delete failed: {str(e)}")
        return False
```

### Frontend Changes
- **Minimal**: Images already use URLs from database
- Automatic switch to Spaces URLs when backend returns them

### Email Template Changes
- Quote notification emails will show clickable Spaces URLs instead of broken local paths

## Cost Breakdown

| Service | Development | Production | Notes |
|---------|-------------|------------|-------|
| **Hosting** | $0 (local) | $12/month | App Platform Starter |
| **Image Storage** | $0 (local) | $5/month | Spaces 250GB |
| **Database** | $0 | $0 | MongoDB Atlas free tier |
| **SSL Certificate** | N/A | $0 | Included with App Platform |
| **Domain** | N/A | ~$15/year | cnstoolsandrepair.com |
| **Total** | $0 | **~$17/month** | Plus domain annual fee |

## Storage Estimates

**Year 1 projections:**
- Gallery photos: 27 current + ~10 new/year = ~70MB
- Quote photos: ~100 quotes/year × 2 photos × 2MB = ~400MB
- **Total: ~470MB** (well under 250GB Spaces limit)

**Spaces pricing:**
- 250GB storage included in $5/month
- 1TB bandwidth included
- Additional: $0.02/GB storage, $0.01/GB bandwidth

## Security Notes

### Quote Photo Privacy
- Current implementation: Public URLs with UUID filenames (security through obscurity)
- UUIDs are hard to guess: `7eabdf02-4413-406c-bcd0-2c3f5a49f901.jpg`
- Alternative: Implement signed URLs with expiration (more complex, not needed initially)

### Spaces Permissions
- Gallery folder: Public read (photos shown on public gallery page)
- Quotes folder: Public read (required for email links to work)
- Both folders: Private write (only backend can upload/delete)

## Pre-Production Testing Checklist

Before going live, verify:
1. ✅ All pages complete and tested
2. ✅ Admin authentication working
3. ✅ Quote form with photo upload tested
4. ✅ Gallery admin UI tested
5. ✅ Email notifications working
6. ✅ Spaces integration tested locally
7. ✅ Production environment variables configured
8. ✅ Domain DNS configured
9. ✅ SSL certificate working
10. ✅ End-to-end user flow tested on production URL

## Rollback Plan

If production deployment issues occur:
1. Keep local development environment running
2. Spaces data is persistent (no data loss)
3. MongoDB Atlas backups available (point-in-time recovery)
4. Can redeploy from git commit history
5. Local `uploads/` backup before migration (safety net)

## Additional Production Steps

### SEO Configuration
1. Submit `sitemap.xml` to Google Search Console: `https://cnstoolsandrepair.com/sitemap.xml`
2. Verify domain ownership
3. Request indexing for main pages
4. Monitor search performance

### Email Domain Verification
1. Login to SendGrid dashboard
2. Add domain: `cnstoolsandrepair.com`
3. Add DNS records at Hostinger:
   - SPF record (TXT)
   - DKIM records (CNAME)
   - DMARC record (TXT)
4. Wait for verification (up to 48 hours)
5. Test email delivery from production domain

### SSL/TLS Configuration
- **App Platform**: Automatic via Let's Encrypt (no action needed)
- **Droplet**: Manual Let's Encrypt setup via Certbot
  ```bash
  sudo certbot --nginx -d cnstoolsandrepair.com -d www.cnstoolsandrepair.com
  ```

### Monitoring Setup
- Enable Digital Ocean monitoring (CPU, memory, bandwidth)
- Set up uptime monitoring (UptimeRobot, Pingdom, etc.)
- Configure email alerts for downtime
- Monitor MongoDB Atlas metrics (connections, storage)

### Backup Strategy
- MongoDB Atlas: Point-in-time recovery enabled (free tier)
- Spaces: Enable versioning (additional cost)
- Database exports: Weekly backups via `mongodump`
- Code: GitHub repository (already version controlled)
