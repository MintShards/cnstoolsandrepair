# Hostinger DNS Configuration for Digital Ocean App Platform

**Domain**: cnstoolrepair.com (registered on Hostinger)
**Target**: Digital Ocean App Platform
**Goal**: Point custom domain to deployed application with SSL

---

## 🎯 Overview

Connect your Hostinger domain to Digital Ocean App Platform:
1. Deploy app to App Platform first
2. Add custom domain in App Platform settings
3. Get DNS records from App Platform
4. Update DNS in Hostinger
5. Wait for DNS propagation
6. SSL certificate auto-generates (free via Let's Encrypt)

---

## 📋 Step-by-Step Setup

### Phase 1: Deploy App First (Required!)

**⚠️ CRITICAL**: Deploy to App Platform BEFORE configuring DNS

1. Complete app deployment (follow `READY_TO_DEPLOY.md`)
2. Wait for deployment to finish
3. Verify app works at default URL: `https://your-app-xxxxx.ondigitalocean.app`
4. Then proceed with custom domain setup

---

### Phase 2: Add Custom Domain in App Platform

1. Go to your app in Digital Ocean dashboard
2. Click "Settings" tab
3. Click "Domains" section
4. Click "Add Domain"

5. Add your domains:
   - First: `cnstoolrepair.com`
   - Click "Add Domain"
   - Second: `www.cnstoolrepair.com`
   - Click "Add Domain"

6. App Platform will show DNS records
   - You'll see A records or CNAME records
   - **Keep this page open** or write down the records

---

### Phase 3: Configure DNS in Hostinger

#### Using A Records (Recommended)

**If App Platform shows A records:**

1. Login to Hostinger: https://hpanel.hostinger.com
2. Go to "Domains" → Click `cnstoolrepair.com`
3. Click "DNS / Name Servers"
4. Click "Manage" under DNS Records

5. **Add A Record for Root Domain**:
   ```
   Type: A
   Name: @ (or blank for root)
   Points to: [IP from App Platform]
   TTL: 3600
   ```

6. **Add A Record for WWW**:
   ```
   Type: A
   Name: www
   Points to: [Same IP from App Platform]
   TTL: 3600
   ```

7. Click "Save" or "Add Record"

#### Using CNAME (Alternative)

**If App Platform shows CNAME records:**

1. **For Root Domain** (`cnstoolrepair.com`):
   ```
   Type: CNAME
   Name: @
   Points to: [CNAME target from App Platform]
   TTL: 3600
   ```

   **Note**: Some DNS providers don't allow CNAME on root. If Hostinger rejects, use A record instead.

2. **For WWW** (`www.cnstoolrepair.com`):
   ```
   Type: CNAME
   Name: www
   Points to: [CNAME target from App Platform]
   TTL: 3600
   ```

---

### Phase 4: Verify DNS Configuration

#### In Hostinger
After saving, DNS records should look like:

```
Type    Name    Value/Points To              TTL
A       @       64.225.xx.xx (App IP)       3600
A       www     64.225.xx.xx (Same IP)      3600
```

#### Check DNS Propagation
Use online tools:

**Tool 1**: https://dnschecker.org/
- Enter: `cnstoolrepair.com`
- Check A record points to correct IP globally

**Tool 2**: https://www.whatsmydns.net/
- Enter: `cnstoolrepair.com`
- Verify DNS propagated worldwide

**Propagation time**: 5 minutes to 48 hours (usually 30 minutes)

---

### Phase 5: Verify in App Platform

1. Return to App Platform → Your App → Settings → Domains
2. Wait for verification:
   - Status changes from "Pending" to "Active"
   - SSL certificate auto-generates (Let's Encrypt)
   - Shows green checkmark when ready

3. SSL Certificate:
   - Automatically issued by Let's Encrypt
   - Takes 5-10 minutes after DNS verifies
   - No action needed

---

## 🧪 Testing Your Domain

### After DNS Propagates:

**Test 1: HTTP Redirect**
- Visit: `http://cnstoolrepair.com`
- Should redirect to: `https://cnstoolrepair.com`

**Test 2: WWW Version**
- Visit: `https://www.cnstoolrepair.com`
- Should work and show your site

**Test 3: API Endpoints**
- Visit: `https://cnstoolrepair.com/health`
- Should return: `{"status":"healthy"}`

**Test 4: Quote Submission**
- Go to: `https://cnstoolrepair.com/repair-request`
- Submit test quote
- Verify no CORS errors in browser console (F12)

---

## ⚠️ Important Notes

### CORS Configuration
Your environment variables should have:
```
CORS_ORIGINS=https://cnstoolrepair.com,https://www.cnstoolrepair.com
```

### Hostinger Name Servers
**Do NOT change name servers!** Keep Hostinger's defaults:
- `ns1.dns-parking.com`
- `ns2.dns-parking.com`

You're only updating **DNS records**, not name servers.

### Email Records
If you have email with Hostinger:
- **Do NOT delete** existing MX, TXT, or SPF records
- Only add/update A records for `@` and `www`
- Email will continue working

---

## 🚨 Troubleshooting

### Domain Not Resolving

**Check DNS**:
```bash
nslookup cnstoolrepair.com
```

Should show App Platform IP.

**Fix**:
- Verify A records added correctly in Hostinger
- Wait longer for propagation (up to 48 hours)
- Clear browser cache and DNS cache

### SSL Certificate Not Working

**Check**:
- DNS must be verified first (green checkmark in App Platform)
- SSL takes 5-10 minutes after DNS verification
- Check App Platform Domains for certificate status

**Fix**:
- Wait for DNS to fully propagate
- Check App Platform logs for SSL errors
- Ensure both `@` and `www` records point correctly

### CORS Errors

**Symptom**: Browser console shows CORS error

**Check**:
- Backend environment variable `CORS_ORIGINS` includes your domain
- Domain matches exactly (with `https://`)

**Fix**:
- Verify `CORS_ORIGINS` in App Platform environment variables
- Redeploy if CORS settings changed

### WWW Not Working

**Check**:
- A record for `www` exists in Hostinger DNS
- Points to same IP as root domain
- App Platform has `www.cnstoolrepair.com` added as domain

**Fix**:
- Add www A record in Hostinger
- Add www domain in App Platform Settings → Domains

---

## 📊 Expected Timeline

| Step | Time |
|------|------|
| Deploy app to App Platform | 10-15 min |
| Add custom domain in App Platform | 2 min |
| Update DNS in Hostinger | 5 min |
| DNS propagation | 30 min - 48 hrs (usually 30 min) |
| SSL certificate generation | 5-10 min after DNS |
| **Total** | **~1 hour** (if DNS is fast) |

---

## ✅ Success Checklist

Domain is working when:
- [ ] App deployed to App Platform
- [ ] Custom domains added in App Platform
- [ ] A records added in Hostinger DNS
- [ ] DNS propagation complete (dnschecker.org shows correct IP)
- [ ] App Platform shows domains as "Active" with green checkmark
- [ ] SSL certificate issued (padlock in browser)
- [ ] `https://cnstoolrepair.com` loads site
- [ ] `https://www.cnstoolrepair.com` loads site
- [ ] `/health` endpoint returns healthy
- [ ] No CORS errors when submitting quote
- [ ] Email notifications working

---

## 🆘 Support Resources

- **Hostinger DNS Guide**: https://support.hostinger.com/en/articles/1583227-how-to-manage-dns-records
- **App Platform Custom Domains**: https://docs.digitalocean.com/products/app-platform/how-to/manage-domains/
- **DNS Checker**: https://dnschecker.org/
- **SSL Checker**: https://www.sslshopper.com/ssl-checker.html

---

## 🎯 Quick Reference

**What you need from App Platform**:
- IP address for A records (or CNAME target)

**What to add in Hostinger DNS**:
```
Type: A, Name: @, Value: [App Platform IP], TTL: 3600
Type: A, Name: www, Value: [App Platform IP], TTL: 3600
```

**What's in your environment variables**:
```
CORS_ORIGINS=https://cnstoolrepair.com,https://www.cnstoolrepair.com
```

**Final URL**: `https://cnstoolrepair.com` 🎉

---

**Next Step**: Deploy app to App Platform first (follow `READY_TO_DEPLOY.md`), then return here for DNS setup!
