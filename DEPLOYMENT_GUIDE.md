# Password Reset System - Complete Deployment Guide

This guide will walk you through deploying the password reset system from scratch, including database setup, email configuration, and production deployment.

---

## Prerequisites

- Google Cloud SQL PostgreSQL database (`doac-referral-db`)
- Access to your backend deployment environment
- Email account for sending reset codes (Gmail recommended)
- Environment variables configuration access

---

## Step 1: Database Migration (Google Cloud SQL)

### Option A: Using Google Cloud Console (Easiest)

1. **Go to Cloud SQL Console:**
   - Visit: https://console.cloud.google.com/sql/instances
   - Select your instance: `doac-referral-db`

2. **Open Cloud Shell:**
   - Click the Cloud Shell icon in the top right
   - This gives you a terminal with `gcloud` and `psql` pre-installed

3. **Connect to your database:**
   ```bash
   gcloud sql connect doac-referral-db --user=postgres
   ```
   - Enter your database password when prompted

4. **Run the migration:**
   ```sql
   -- Create password reset tokens table
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

   -- Create indexes for better query performance
   CREATE INDEX IF NOT EXISTS idx_password_reset_tokens_user_id ON password_reset_tokens(user_id);
   CREATE INDEX IF NOT EXISTS idx_password_reset_tokens_expires_at ON password_reset_tokens(expires_at);

   -- Verify table was created
   \dt password_reset_tokens
   \d password_reset_tokens
   ```

5. **Exit:**
   ```sql
   \q
   ```

### Option B: Using Cloud SQL Proxy (For Local Connection)

1. **Download Cloud SQL Proxy:**
   ```bash
   # macOS
   curl -o cloud-sql-proxy https://storage.googleapis.com/cloud-sql-connectors/cloud-sql-proxy/v2.8.0/cloud-sql-proxy.darwin.amd64
   chmod +x cloud-sql-proxy

   # Linux
   wget https://storage.googleapis.com/cloud-sql-connectors/cloud-sql-proxy/v2.8.0/cloud-sql-proxy.linux.amd64 -O cloud-sql-proxy
   chmod +x cloud-sql-proxy
   ```

2. **Get your instance connection name:**
   - Go to: https://console.cloud.google.com/sql/instances
   - Click on `doac-referral-db`
   - Copy the "Connection name" (format: `project:region:instance`)

3. **Start the proxy:**
   ```bash
   ./cloud-sql-proxy --port 5432 flightstudio:us-central1:doac-referral-db
   # Example: ./cloud-sql-proxy --port 5432 my-project:us-central1:doac-referral-db
   ```

4. **In a new terminal, connect with psql:**
   ```bash
   psql -h 127.0.0.1 -U postgres -d doac-referral-db
   ```

5. **Run the migration script:**
   ```bash
   psql -h 127.0.0.1 -U postgres -d doac-referral-db -f backend/migrations/add_password_reset_table.sql
   ```

### Option C: Using Google Cloud SQL Admin API

1. **Install gcloud CLI** (if not installed):
   ```bash
   # macOS
   curl https://sdk.cloud.google.com | bash
   exec -l $SHELL

   # Initialize
   gcloud init
   ```

2. **Run migration:**
   ```bash
   # Upload migration file to Cloud Storage bucket first
   gsutil cp backend/migrations/add_password_reset_table.sql gs://YOUR-BUCKET/

   # Or run directly via Cloud Shell
   gcloud sql connect doac-referral-db --user=postgres < backend/migrations/add_password_reset_table.sql
   ```

### Verify Migration Success

After running the migration, verify it worked:

```sql
-- Check if table exists
SELECT tablename FROM pg_tables WHERE tablename = 'password_reset_tokens';

-- Check table structure
\d password_reset_tokens

-- Should show:
--   Column           |  Type    | Nullable |  Default
-- -------------------+----------+----------+-----------
--  id                | integer  | not null | nextval(...)
--  user_id           | integer  |          |
--  code_hash         | varchar  | not null |
--  device_fingerprint| varchar  | not null |
--  expires_at        | timestamp| not null |
--  used              | boolean  |          | false
--  used_at           | timestamp|          |
--  created_at        | timestamp|          | CURRENT_TIMESTAMP
```

---

## Step 2: Email Service Setup (Gmail SMTP)

### Create Gmail App Password

1. **Enable 2-Factor Authentication:**
   - Go to: https://myaccount.google.com/security
   - Click "2-Step Verification"
   - Follow steps to enable 2FA

2. **Generate App Password:**
   - Go to: https://myaccount.google.com/apppasswords
   - Select app: "Mail"
   - Select device: "Other (Custom name)"
   - Enter name: "DOAC Referral Password Reset"
   - Click "Generate"
   - **SAVE THE 16-CHARACTER PASSWORD** (you'll only see it once)

3. **Note your credentials:**
   ```
   EMAIL_HOST=smtp.gmail.com
   EMAIL_PORT=587
   EMAIL_USER=your-email@gmail.com
   EMAIL_PASS=xxxx xxxx xxxx xxxx (the 16-char app password)
   ```

### Alternative: Other Email Providers

**SendGrid (Recommended for Production):**
```env
EMAIL_HOST=smtp.sendgrid.net
EMAIL_PORT=587
EMAIL_USER=apikey
EMAIL_PASS=<your-sendgrid-api-key>
```

**AWS SES:**
```env
EMAIL_HOST=email-smtp.us-east-1.amazonaws.com
EMAIL_PORT=587
EMAIL_USER=<your-smtp-username>
EMAIL_PASS=<your-smtp-password>
```

**Mailgun:**
```env
EMAIL_HOST=smtp.mailgun.org
EMAIL_PORT=587
EMAIL_USER=<your-mailgun-username>
EMAIL_PASS=<your-mailgun-password>
```

**Office 365:**
```env
EMAIL_HOST=smtp.office365.com
EMAIL_PORT=587
EMAIL_USER=your-email@yourdomain.com
EMAIL_PASS=<your-password>
```

---

## Step 3: Configure Environment Variables

### Backend Environment Variables

Add these to your backend `.env` file or deployment environment:

```env
# Email Configuration
EMAIL_HOST=smtp.gmail.com
EMAIL_PORT=587
EMAIL_USER=your-email@gmail.com
EMAIL_PASS=your-app-password-here

# Database (Google Cloud SQL)
DB_HOST=/cloudsql/your-project:region:doac-referral-db  # For App Engine/Cloud Run
# OR
DB_HOST=10.x.x.x  # Private IP if using VPC
# OR
DB_HOST=35.x.x.x  # Public IP (not recommended for production)

DB_PORT=5432
DB_NAME=doac-referral-db
DB_USER=postgres
DB_PASSWORD=your-db-password

# JWT Secret (IMPORTANT: Use a strong secret)
JWT_SECRET=your-very-secure-random-string-here

# Node Environment
NODE_ENV=production
```

### For Google Cloud Run:

```bash
gcloud run services update YOUR-SERVICE-NAME \
  --update-env-vars EMAIL_HOST=smtp.gmail.com,EMAIL_PORT=587,EMAIL_USER=your-email@gmail.com,EMAIL_PASS=your-app-password
```

### For Google App Engine:

Edit `app.yaml`:
```yaml
env_variables:
  EMAIL_HOST: "smtp.gmail.com"
  EMAIL_PORT: "587"
  EMAIL_USER: "your-email@gmail.com"
  EMAIL_PASS: "your-app-password"
  DB_HOST: "/cloudsql/your-project:region:doac-referral-db"
  DB_NAME: "doac-referral-db"
  DB_USER: "postgres"
  DB_PASSWORD: "your-db-password"
  JWT_SECRET: "your-secret-here"
  NODE_ENV: "production"
```

### For Heroku:

```bash
heroku config:set EMAIL_HOST=smtp.gmail.com
heroku config:set EMAIL_PORT=587
heroku config:set EMAIL_USER=your-email@gmail.com
heroku config:set EMAIL_PASS=your-app-password
heroku config:set NODE_ENV=production
```

### For Docker/Docker Compose:

Create `.env.production`:
```env
EMAIL_HOST=smtp.gmail.com
EMAIL_PORT=587
EMAIL_USER=your-email@gmail.com
EMAIL_PASS=your-app-password
DB_HOST=your-cloud-sql-ip
DB_PORT=5432
DB_NAME=doac-referral-db
DB_USER=postgres
DB_PASSWORD=your-db-password
JWT_SECRET=your-secret-here
NODE_ENV=production
```

---

## Step 4: Deploy Backend Changes

### Check what files were modified:

```bash
cd backend

# Files that need to be deployed:
# - src/controllers/authController.ts (new password reset endpoints)
# - src/routes/auth.ts (new routes)
# - src/middleware/rateLimiter.ts (new rate limiters)
# - src/services/emailService.ts (password reset email template)
# - src/database/schema.sql (updated with password_reset_tokens table)
```

### Build Backend:

```bash
cd backend
npm install  # Install dependencies (if any new ones)
npm run build  # Compile TypeScript to JavaScript
```

### Deploy based on your platform:

**Google Cloud Run:**
```bash
# Build and deploy
gcloud builds submit --tag gcr.io/YOUR-PROJECT/doac-referral-backend
gcloud run deploy doac-referral-backend \
  --image gcr.io/YOUR-PROJECT/doac-referral-backend \
  --platform managed \
  --region us-central1 \
  --add-cloudsql-instances YOUR-PROJECT:REGION:doac-referral-db
```

**Google App Engine:**
```bash
gcloud app deploy
```

**Heroku:**
```bash
git add .
git commit -m "feat: Add secure password reset system"
git push heroku main
```

**Docker:**
```bash
docker build -t doac-referral-backend .
docker push your-registry/doac-referral-backend:latest
# Update your deployment to use new image
```

**PM2 (VPS):**
```bash
# Pull latest code
git pull origin main

# Install dependencies
cd backend
npm install

# Rebuild
npm run build

# Restart with PM2
pm2 restart doac-referral-backend
pm2 save
```

---

## Step 5: Deploy Frontend Changes

### Files modified:
```bash
cd frontend

# Files that need to be deployed:
# - src/components/AuthModal.js (password reset UI)
# - src/services/api.js (new API methods)
# - src/index.css (code input styling)
```

### Build Frontend:

```bash
cd frontend
npm install  # Install dependencies (if any new ones)
npm run build  # Create production build
```

### Deploy based on your platform:

**Firebase Hosting:**
```bash
firebase deploy --only hosting
```

**Netlify:**
```bash
# If using Netlify CLI
netlify deploy --prod

# Or push to connected Git repo
git add .
git commit -m "feat: Add password reset UI"
git push origin main
```

**Vercel:**
```bash
vercel --prod
```

**AWS S3 + CloudFront:**
```bash
aws s3 sync build/ s3://your-bucket-name/
aws cloudfront create-invalidation --distribution-id YOUR-DIST-ID --paths "/*"
```

**Google Cloud Storage:**
```bash
gsutil -m rsync -r build/ gs://your-bucket-name/
```

---

## Step 6: Post-Deployment Verification

### 1. Verify Database Table

```bash
# Connect to your Cloud SQL database
gcloud sql connect doac-referral-db --user=postgres

# Check table exists
\dt password_reset_tokens

# Check no data yet
SELECT COUNT(*) FROM password_reset_tokens;
# Should return: 0

\q
```

### 2. Test Email Sending (Backend)

Create a test script or use curl:

```bash
# Test forgot password endpoint
curl -X POST https://your-backend-url/api/auth/forgot-password \
  -H "Content-Type: application/json" \
  -d '{"email":"your-test-email@gmail.com"}'

# Check your email - you should receive a 6-digit code
# Check backend logs for the code (in development mode)
```

### 3. Test Full Flow (Frontend + Backend)

1. **Open your production app**
2. **Click login/register button**
3. **Click "Forgot password?"**
4. **Enter your email address**
5. **Check email for 6-digit code**
6. **Enter code in modal**
7. **Set new password**
8. **Verify you can login with new password**

### 4. Verify Database Records

After testing:

```sql
-- Connect to database
gcloud sql connect doac-referral-db --user=postgres

-- Check password reset tokens were created
SELECT id, user_id, used, created_at, expires_at
FROM password_reset_tokens
ORDER BY created_at DESC
LIMIT 5;

-- Verify used codes are marked as used
SELECT id, user_id, used, used_at
FROM password_reset_tokens
WHERE used = true;

\q
```

---

## Step 7: Monitoring & Troubleshooting

### Check Backend Logs

**Google Cloud Run/App Engine:**
```bash
gcloud logging read "resource.type=cloud_run_revision" --limit 50
```

**Heroku:**
```bash
heroku logs --tail
```

**PM2:**
```bash
pm2 logs doac-referral-backend
```

### Common Issues & Solutions

#### Issue 1: Email Not Sending

**Symptoms:** User doesn't receive email

**Check:**
```bash
# View backend logs
# Look for errors like:
# "Failed to send password reset email: Error: Invalid login"
```

**Solutions:**
- Verify `EMAIL_USER` and `EMAIL_PASS` are correct
- Ensure 2FA is enabled on Gmail account
- Regenerate app password if needed
- Check if Gmail is blocking the login (check security alerts)
- Test SMTP connection:
  ```bash
  telnet smtp.gmail.com 587
  ```

#### Issue 2: Database Connection Failed

**Symptoms:** 500 errors on password reset request

**Check:**
```bash
# Backend logs will show:
# "Error: Connection refused" or "timeout"
```

**Solutions:**
- Verify Cloud SQL instance is running
- Check `DB_HOST`, `DB_USER`, `DB_PASSWORD` are correct
- For Cloud Run: Ensure `--add-cloudsql-instances` is set
- Check if database allows connections from your backend IP
- Test connection manually:
  ```bash
  psql -h YOUR-DB-HOST -U postgres -d doac-referral-db
  ```

#### Issue 3: Table Doesn't Exist

**Symptoms:** Error: `relation "password_reset_tokens" does not exist`

**Solution:**
```bash
# Re-run migration
gcloud sql connect doac-referral-db --user=postgres

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

#### Issue 4: Rate Limit Blocking Requests

**Symptoms:** "Too many password reset requests"

**Solution:**
- Wait for rate limit window to expire (shown in error message)
- Or temporarily increase limits in `backend/src/middleware/rateLimiter.ts`
- Check if Redis is running for distributed rate limiting

#### Issue 5: Code Input Not Working on Mobile

**Symptoms:** Can't type in code boxes on mobile

**Solution:**
- Clear browser cache
- Verify `inputMode="numeric"` attribute is present
- Check CSS for `.code-input` is loaded
- Test on different mobile browsers

---

## Step 8: Security Checklist

Before going live, verify:

- [ ] `JWT_SECRET` is set to a strong random string (not default)
- [ ] Database password is strong and secure
- [ ] Email app password is not exposed in frontend code
- [ ] HTTPS is enabled on all endpoints
- [ ] Rate limiting is enabled and working
- [ ] Environment is set to `NODE_ENV=production`
- [ ] Codes are NOT logged in production (check backend logs)
- [ ] Database is not publicly accessible (use private IP or Cloud SQL proxy)
- [ ] CORS is configured correctly (only allow your frontend domain)
- [ ] Cloud SQL instance has automated backups enabled
- [ ] Redis is secured (password protected if using external Redis)

---

## Step 9: Performance Optimization

### Enable Connection Pooling

In `backend/src/config/database.ts`, ensure:

```typescript
const pool = new Pool({
  max: 20,        // Maximum pool size
  min: 5,         // Minimum pool size
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
});
```

### Enable Redis for Rate Limiting

For production, use a managed Redis instance (Google Cloud Memorystore):

```bash
# Create Redis instance
gcloud redis instances create doac-redis \
  --size=1 \
  --region=us-central1 \
  --tier=basic

# Get Redis host
gcloud redis instances describe doac-redis --region=us-central1 --format="get(host)"
```

Update environment:
```env
REDIS_HOST=10.x.x.x  # Your Redis host
REDIS_PORT=6379
```

### Enable Email Queue (Optional)

For high-volume production, consider using a queue:

```bash
# Using Bull with Redis
npm install bull @types/bull

# Create email queue
import Queue from 'bull';
const emailQueue = new Queue('password-reset-emails', {
  redis: { host: process.env.REDIS_HOST, port: 6379 }
});
```

---

## Step 10: Monitoring & Alerts

### Set up Cloud Monitoring Alerts

```bash
# Alert on high error rate
gcloud alpha monitoring policies create \
  --notification-channels=YOUR-CHANNEL-ID \
  --display-name="Password Reset Errors" \
  --condition-display-name="High error rate" \
  --condition-threshold-value=10 \
  --condition-threshold-duration=300s
```

### Monitor Key Metrics

- **Email Send Rate**: Track successful/failed email sends
- **Code Verification Rate**: Track valid/invalid code attempts
- **Password Reset Completion Rate**: Track successful resets
- **Rate Limit Hits**: Track rate limit violations
- **Database Query Performance**: Monitor slow queries

### Log Important Events

The system automatically logs:
- ✅ Password reset requests
- ✅ Code verification attempts (success/failure)
- ✅ Password reset completions
- ✅ Device fingerprint mismatches
- ✅ Rate limit violations
- ✅ Email send failures

---

## Complete Deployment Checklist

### Pre-Deployment
- [ ] Database migration script created
- [ ] Email service configured (Gmail app password)
- [ ] Environment variables documented
- [ ] Code reviewed and tested locally

### Deployment
- [ ] Database table created in Cloud SQL
- [ ] Backend environment variables set
- [ ] Frontend environment variables set (if any)
- [ ] Backend built and deployed
- [ ] Frontend built and deployed

### Post-Deployment
- [ ] Database table verified
- [ ] Email sending tested
- [ ] Full password reset flow tested
- [ ] Rate limiting tested
- [ ] Mobile responsiveness tested
- [ ] Security checklist completed
- [ ] Monitoring alerts configured
- [ ] Documentation updated

---

## Quick Reference Commands

```bash
# Connect to Cloud SQL
gcloud sql connect doac-referral-db --user=postgres

# View backend logs (Cloud Run)
gcloud logging read "resource.type=cloud_run_revision" --limit 50

# Deploy backend (Cloud Run)
gcloud run deploy doac-referral-backend --image gcr.io/PROJECT/IMAGE

# Deploy frontend (Firebase)
firebase deploy --only hosting

# Test password reset API
curl -X POST https://your-api.com/api/auth/forgot-password \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com"}'

# Check password reset tokens in DB
psql -h HOST -U postgres -d doac-referral-db \
  -c "SELECT * FROM password_reset_tokens ORDER BY created_at DESC LIMIT 5;"
```

---

## Support

If you encounter issues:

1. Check backend logs for errors
2. Verify environment variables are set correctly
3. Test database connection
4. Test email configuration
5. Check rate limit Redis connection
6. Verify frontend can reach backend API
7. Review [PASSWORD_RESET_DOCUMENTATION.md](./PASSWORD_RESET_DOCUMENTATION.md) for detailed implementation details

---

## Success!

Once deployed, your users will have access to a **secure, industry-standard password reset system** with:
- ✅ Email-based verification
- ✅ 6-digit codes with smart input
- ✅ Device fingerprinting security
- ✅ Resend code functionality
- ✅ 10-minute expiration
- ✅ Beautiful email templates
- ✅ Mobile-responsive UI
- ✅ Comprehensive rate limiting

**You're all set!** 🎉
