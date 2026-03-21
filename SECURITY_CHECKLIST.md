# 🔒 Security Checklist - Pre-Deployment Verification

**Purpose**: Verify repository is secure before pushing to GitHub
**Date**: 2026-03-21
**Status**: Use this checklist before every deployment

---

## ✅ Pre-Commit Security Checks

### 1. Environment File Protection

**Check `.gitignore` includes:**
```bash
grep -E "\.env$|\.env\.production$" .gitignore
```

**Expected output**:
```
backend/.env
backend/.env.production
```

**Status**: [ ] Verified

---

### 2. No Credentials in Documentation

**Scan all markdown files**:
```bash
grep -r "mongodb+srv://.*:.*@" *.md
grep -r "SG\.[A-Za-z0-9_-]*\.[A-Za-z0-9_-]*" *.md
grep -r "Mayo22pogiako" *.md
```

**Expected output**: Empty (no matches)

**Status**: [ ] Verified

---

### 3. No Real Secrets in Code

**Scan for common secret patterns**:
```bash
# MongoDB passwords
grep -r "Mayo22pogiako\|20Jessie02mi" .

# SendGrid API keys
grep -r "SG\.znwx3LNHTrG3QhlljpvW-A" .

# JWT secrets (example pattern)
grep -r "AcI1XUbYc0NF2W9xCc5mF" .

# Digital Ocean Spaces
grep -r "DO00UKK9CXADLC6MAKNC\|3L9aC8Yi" .
```

**Expected output**: Only matches in `backend/.env.production` (gitignored)

**Status**: [ ] Verified

---

### 4. Placeholder Verification

**All documentation should use placeholders**:
```bash
grep -r "your_.*_here" *.md | wc -l
```

**Expected**: Multiple matches (placeholders present)

**Check no real values**:
```bash
grep -r "mongodb+srv://cnstoolsandrepair-user:" *.md
```

**Expected**: Empty (no real connection strings)

**Status**: [ ] Verified

---

### 5. Git Status Check

**Verify `.env.production` is not tracked**:
```bash
git status backend/.env.production
```

**Expected output**:
```
Untracked files:
  backend/.env.production
```

OR file not shown at all (gitignored).

**Status**: [ ] Verified

---

### 6. Staged Files Review

**Check what will be committed**:
```bash
git diff --cached
```

**Verify**:
- No real credentials
- Only placeholders in documentation
- `.gitignore` includes `.env.production`

**Status**: [ ] Verified

---

## 🔐 Post-Exposure Credential Rotation

**If credentials were previously exposed, rotate ALL of these:**

### MongoDB Atlas
- [ ] Login to https://cloud.mongodb.com
- [ ] Navigate to Database Access
- [ ] Edit user `cnstoolsandrepair-user`
- [ ] Click "Edit"
- [ ] Click "Edit Password"
- [ ] Generate new secure password
- [ ] Update local `backend/.env.production`

### SendGrid
- [ ] Login to https://app.sendgrid.com
- [ ] Go to Settings → API Keys
- [ ] Delete old key (if exists): `znwx3LNHTrG3QhlljpvW-A`
- [ ] Create new API key
- [ ] Name: `cnstoolsandrepair-production-[date]`
- [ ] Copy new key
- [ ] Update local `backend/.env.production`

### JWT Secret
- [ ] Generate new secret:
  ```bash
  python3 -c "import secrets; print(secrets.token_urlsafe(32))"
  ```
- [ ] Update local `backend/.env.production`
- [ ] **Note**: Existing admin sessions will be invalidated

### Digital Ocean Spaces (if used)
- [ ] Login to https://cloud.digitalocean.com
- [ ] Go to API → Spaces Keys
- [ ] Delete old key (if exists)
- [ ] Generate new key pair
- [ ] Update local `backend/.env.production`

---

## 🚨 Emergency Response (Active Breach)

**If GitHub/MongoDB/SendGrid sends security alert:**

### Immediate Actions (Within 1 hour)
1. **Assess exposure**:
   ```bash
   git log --all --source --full-history -- '*.md' | grep -A 5 -B 5 "MongoDB\|SendGrid\|JWT"
   ```

2. **Rotate ALL credentials** (use checklist above)

3. **Force push to remove bad commits**:
   ```bash
   # Verify current state is clean
   git status
   git log --oneline -5

   # Force push to overwrite GitHub history
   git push origin main --force
   ```

4. **Verify GitHub history is clean**:
   - Visit: `https://github.com/YOUR_USERNAME/cnstoolsandrepair/commits/main`
   - Confirm bad commits no longer visible

### Follow-up Actions (Within 24 hours)
- [ ] Monitor MongoDB Atlas for unauthorized access attempts
- [ ] Check SendGrid activity log for suspicious emails
- [ ] Review App Platform logs for failed authentication
- [ ] Update credential rotation schedule
- [ ] Document incident and lessons learned

---

## 📊 Pre-Push Security Audit

Run this comprehensive audit before `git push`:

```bash
#!/bin/bash
# security-audit.sh - Run before pushing to GitHub

echo "🔍 Security Audit Starting..."

# Check .gitignore
echo -e "\n1. Checking .gitignore..."
if grep -q "backend/.env.production" .gitignore; then
    echo "✅ .env.production is gitignored"
else
    echo "❌ WARNING: .env.production NOT in .gitignore"
    exit 1
fi

# Check for real MongoDB passwords
echo -e "\n2. Scanning for MongoDB passwords..."
if git ls-files | xargs grep -l "Mayo22pogiako\|20Jessie02mi" 2>/dev/null; then
    echo "❌ CRITICAL: MongoDB password found in tracked files"
    exit 1
else
    echo "✅ No MongoDB passwords in tracked files"
fi

# Check for SendGrid API keys
echo -e "\n3. Scanning for SendGrid API keys..."
if git ls-files | xargs grep -l "SG\.znwx3LNHTrG3QhlljpvW-A" 2>/dev/null; then
    echo "❌ CRITICAL: SendGrid API key found in tracked files"
    exit 1
else
    echo "✅ No SendGrid API keys in tracked files"
fi

# Check for JWT secrets
echo -e "\n4. Scanning for JWT secrets..."
if git ls-files | xargs grep -l "AcI1XUbYc0NF2W9xCc5mF" 2>/dev/null; then
    echo "❌ CRITICAL: JWT secret found in tracked files"
    exit 1
else
    echo "✅ No JWT secrets in tracked files"
fi

# Check for connection strings
echo -e "\n5. Scanning for connection strings..."
if git ls-files | xargs grep -l "mongodb+srv://[^y][^o][^u]" 2>/dev/null; then
    echo "❌ WARNING: Potential real MongoDB connection string found"
    exit 1
else
    echo "✅ No real connection strings in tracked files"
fi

# Verify placeholders exist
echo -e "\n6. Verifying placeholders..."
if git ls-files "*.md" | xargs grep -l "your_.*_here" >/dev/null 2>&1; then
    echo "✅ Placeholders found in documentation"
else
    echo "⚠️  No placeholders found (might be intentional)"
fi

echo -e "\n✅ Security audit passed! Safe to push.\n"
```

**Usage**:
```bash
chmod +x scripts/security-audit.sh
./scripts/security-audit.sh && git push origin main
```

---

## 🎯 Deployment Security Checklist

**Before deploying to production:**

### Local Environment
- [ ] `backend/.env.production` exists locally
- [ ] `backend/.env.production` is gitignored
- [ ] All placeholders replaced with real values
- [ ] Credentials rotated if previously exposed

### Repository
- [ ] No real credentials in tracked files
- [ ] Documentation uses placeholders only
- [ ] `.gitignore` protects sensitive files
- [ ] Security audit passed

### App Platform
- [ ] Environment variables use encrypted storage
- [ ] CORS_ORIGINS set to production domain only
- [ ] JWT_SECRET_KEY different from development
- [ ] MongoDB network access configured

### MongoDB Atlas
- [ ] Production database created
- [ ] Network access allows 0.0.0.0/0
- [ ] Strong password used
- [ ] Database user has minimal required permissions

### Third-Party Services
- [ ] SendGrid API key valid and active
- [ ] Digital Ocean Spaces configured (if enabled)
- [ ] All API keys tested before deployment

---

## 📚 Security Resources

- **OWASP Top 10**: https://owasp.org/www-project-top-ten/
- **GitHub Secret Scanning**: https://docs.github.com/en/code-security/secret-scanning
- **MongoDB Security Checklist**: https://www.mongodb.com/docs/manual/administration/security-checklist/
- **Digital Ocean Security**: https://docs.digitalocean.com/products/app-platform/how-to/manage-environment-variables/

---

## ✅ Sign-Off

**Audited by**: _________________
**Date**: _________________
**Commit hash**: _________________
**Status**: [ ] SAFE TO PUSH  [ ] ISSUES FOUND

**Notes**:
_________________________________________________________________
_________________________________________________________________
_________________________________________________________________

---

**Remember**: When in doubt, DON'T push. Better safe than sorry! 🔒
