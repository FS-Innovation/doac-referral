# Production Deployment Checklist - Password Reset Feature

## ✅ What's Already Done

Your password reset system is **COMPLETE** and ready for production! Here's what's implemented:

### Backend ✅
- ✅ Secure password reset endpoints (`/api/auth/forgot-password`, `/api/auth/verify-reset-code`, `/api/auth/reset-password`)
- ✅ Cryptographically secure 6-digit code generation
- ✅ SHA-256 hashing for codes stored in database
- ✅ Device fingerprinting to prevent code theft
- ✅ 10-minute code expiration
- ✅ Rate limiting on all endpoints
- ✅ Email sending via SendGrid
- ✅ Database schema and migration files ready

### Frontend ✅
- ✅ Complete password reset UI flow
- ✅ Forgot password form
- ✅ 6-digit code verification with auto-focus
- ✅ New password form with strength indicator
- ✅ Resend code functionality with cooldown
- ✅ Error handling and validation
- ✅ Fixed button styling (no white backgrounds)

### Security ✅
- ✅ No user enumeration (same response whether email exists or not)
- ✅ Timing-safe code comparison
- ✅ JWT-based reset tokens with 5-minute expiration
- ✅ One-time use codes
- ✅ Device fingerprint matching
- ✅ SQL injection protection
- ✅ XSS protection
- ✅ CSRF protection

---

## 🚀 Deployment Steps

### Step 1: Database Migration (CRITICAL!)

Run this migration on your **production database** before deploying the code:

```bash
# Connect to your production database and run:
psql $DATABASE_URL -f backend/migrations/add_password_reset_table.sql
```

**Or manually execute:**
```sql
CREATE TABLE IF NOT EXISTS password_reset_tokens (
  id SERIAL PRIMARY KEY,
  user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
  code_hash VARCHAR(255) NOT NULL,
  device_fingerprint VARCHAR(255) NOT NULL,
  expires_at TIMESTAMP NOT NULL,
  used BOOLEAN DEFAULT FALSE,
  used_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_password_reset_tokens_user_id ON password_reset_tokens(user_id);
CREATE INDEX IF NOT EXISTS idx_password_reset_tokens_expires_at ON password_reset_tokens(expires_at);
```

### Step 2: SendGrid Setup (CRITICAL!)

#### A. Verify Sender Email in SendGrid

1. Go to https://app.sendgrid.com/settings/sender_auth/senders
2. Click "Create New Sender" or "Verify a Single Sender"
3. Enter: **doacperks@gmail.com**
4. Fill out the form (name, address, etc.)
5. **CHECK YOUR EMAIL** at doacperks@gmail.com
6. Click the verification link
7. Wait for "Verified" status in SendGrid dashboard

**IMPORTANT:** Emails will NOT send until sender is verified!

#### B. Alternative: Domain Authentication (Recommended for Production)

Instead of single sender verification, authenticate your entire domain:

1. Go to https://app.sendgrid.com/settings/sender_auth
2. Click "Authenticate Your Domain"
3. Enter your domain (e.g., `doac-perks.com`)
4. Add DNS records (CNAME, SPF, DKIM) to your domain registrar
5. Wait for verification (up to 48 hours)

**Benefit:** Can send from any email address on your domain without individual verification.

### Step 3: Environment Variables

Set these in your production environment (Railway, Vercel, etc.):

#### Backend Environment Variables:
```bash
# Database
DATABASE_URL=postgresql://user:pass@host:5432/dbname

# JWT Secret (CHANGE THIS!)
JWT_SECRET=your-super-secret-random-string-change-this

# Server
PORT=5000
NODE_ENV=production

# Frontend URL (for CORS)
FRONTEND_URL=https://yourdomain.com

# Redis
REDIS_URL=redis://your-redis-url:6379

# SendGrid Email Configuration
EMAIL_HOST=smtp.sendgrid.net
EMAIL_PORT=587
EMAIL_USER=apikey
EMAIL_PASS=SG.your-actual-sendgrid-api-key-here
SENDGRID_FROM_EMAIL=doacperks@gmail.com
ADMIN_EMAIL=doacperks@gmail.com

# Default redirect
DEFAULT_REDIRECT_URL=https://yourdomain.com/welcome
```

#### Frontend Environment Variables:
```bash
REACT_APP_API_URL=https://api.yourdomain.com
NODE_ENV=production
```

### Step 4: Security Checklist

Before deploying:

- [ ] **Rotate SendGrid API Key** (yours is exposed in this conversation!)
  - Go to https://app.sendgrid.com/settings/api_keys
  - Delete old key: `SG.aHlEj036Rz-VacqIoFYXzQ...`
  - Create new key with "Mail Send" permission
  - Update `EMAIL_PASS` in production environment

- [ ] **Change JWT_SECRET** to a strong random string
  - Generate with: `node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"`

- [ ] **Verify `.env` is in `.gitignore`** (never commit secrets!)

- [ ] **Test rate limiting** is working (prevents abuse)

- [ ] **Enable HTTPS** (required for secure cookies)

### Step 5: Deploy to Production

#### If using Railway (Backend):
```bash
cd backend
git add .
git commit -m "Add password reset feature"
git push railway main

# Or if using Railway CLI:
railway up
```

#### If using Vercel/Netlify (Frontend):
```bash
cd frontend
npm run build
# Deploy via Git push or CLI
```

### Step 6: Test in Production

After deployment, test the complete flow:

1. **Request Password Reset:**
   - Go to your production site
   - Click "Forgot Password"
   - Enter a real email address you can access
   - Click "Send verification code"

2. **Check Email:**
   - Check inbox (and spam!) for the 6-digit code
   - If no email: Check SendGrid Activity Feed at https://app.sendgrid.com/email_activity
   - Look for bounces or errors

3. **Verify Code:**
   - Enter the 6-digit code
   - Should show "Code verified!"

4. **Reset Password:**
   - Enter new password
   - Should show "Password reset successful!"

5. **Login:**
   - Log in with new password
   - Should successfully authenticate

### Step 7: Monitor SendGrid Activity

Check your SendGrid dashboard regularly:
- **Activity Feed:** https://app.sendgrid.com/email_activity
- **Statistics:** https://app.sendgrid.com/statistics
- **Bounces/Spam Reports:** Check for delivery issues

---

## 🐛 Troubleshooting

### Emails Not Sending?

1. **Check SendGrid sender verification:**
   - https://app.sendgrid.com/settings/sender_auth/senders
   - Status should be "Verified"

2. **Check SendGrid API key:**
   - Must have "Mail Send" permission
   - Should start with `SG.`
   - Verify `EMAIL_PASS` in production env matches

3. **Check SendGrid Activity Feed:**
   - https://app.sendgrid.com/email_activity
   - Look for delivery status, bounces, errors

4. **Common errors:**
   - **"does not match a verified Sender Identity"** → Verify sender email in SendGrid
   - **"DMARC policy"** → Need domain authentication or use verified sender
   - **"550 5.7.26"** → Domain not authenticated, use single sender verification

### Database Errors?

1. **"relation 'password_reset_tokens' does not exist"**
   - Run the migration: `psql $DATABASE_URL -f backend/migrations/add_password_reset_table.sql`

2. **"column 'code_hash' does not exist"**
   - Migration didn't run completely, re-run migration

### Code Not Verifying?

1. **"Invalid or expired verification code"**
   - Code expires after 10 minutes
   - Must use same device (fingerprint matching)
   - Code can only be used once
   - Request new code if needed

2. **"Device fingerprint mismatch"**
   - User changed device/browser
   - Must request new code from same device

---

## 📊 What Happens After Deployment

### User Flow:
1. User clicks "Forgot Password"
2. Enters email → **Backend sends 6-digit code to email**
3. User receives email from `doacperks@gmail.com`
4. Enters code → **Backend verifies code, returns reset token**
5. User enters new password → **Backend resets password**
6. User logs in with new password → **Success!**

### Database:
- Each reset request creates a row in `password_reset_tokens`
- Old codes are invalidated when new code is sent
- Used codes are marked `used = true`
- Expired codes (>10 min) are rejected

### Security:
- Codes are hashed (SHA-256) before storing
- No raw codes in database
- Device fingerprinting prevents code theft
- Rate limiting prevents abuse
- Timing-safe comparison prevents timing attacks

---

## ✅ Final Checklist

Before going live:

- [ ] Run database migration on production database
- [ ] Verify sender email in SendGrid (doacperks@gmail.com)
- [ ] Rotate SendGrid API key (current one is exposed)
- [ ] Set all environment variables in production
- [ ] Change JWT_SECRET to strong random value
- [ ] Deploy backend to production
- [ ] Deploy frontend to production
- [ ] Test complete password reset flow in production
- [ ] Check SendGrid Activity Feed for successful delivery
- [ ] Monitor for any errors in first 24 hours

---

## 🎉 You're Ready!

Your password reset system is **production-ready** with:
- ✅ Secure cryptographic code generation
- ✅ Email delivery via SendGrid
- ✅ Device fingerprinting
- ✅ Rate limiting
- ✅ Complete UI flow
- ✅ Error handling

**Just complete the deployment steps above and you're good to go!**

Need help? Check the troubleshooting section or SendGrid's docs: https://docs.sendgrid.com
