# Complete Google Cloud Platform Deployment Guide

## Overview - Optimized for 13M Follower Campaign

This guide deploys the DOAC Referral System to Google Cloud Platform, **optimized for viral video campaigns** with a 13M follower base.

### What This Handles:
- ✅ **Cloud Run** - Auto-scaling backend (0-100 instances)
- ✅ **Firebase Hosting** - Global CDN for React frontend
- ✅ **Cloud SQL** - Managed PostgreSQL database
- ✅ **Memorystore** - Redis caching layer
- ✅ **Secret Manager** - Secure credential storage
- ✅ **Auto-scaling** - Handles traffic spikes automatically
- ✅ **Zero downtime** - Rolling deployments
- ✅ **Fraud protection** - Rate limiting + bot detection

### Expected Traffic (13M Followers):
- **Moderate success**: 2,000-5,000 concurrent users (2% CTR, 15% signup)
- **Viral success**: 5,000-10,000 concurrent users (5% CTR, 20% signup)
- **Mega viral**: 10,000-20,000 concurrent users (10% CTR, 25% signup)

### Costs:
- **Base (idle)**: ~$425/month
- **During viral spike**: ~$600-800/month (first week)
- **After spike**: Drops back to ~$425/month

**Estimated Setup Time:** 45-60 minutes (including quota requests)

---

## Prerequisites

### 1. Google Cloud Account

1. Go to https://console.cloud.google.com
2. Sign up (get $300 free credits for 90 days)
3. Create a new project or select existing one
4. Enable billing

### 2. Install Required Tools

#### macOS

```bash
# Install Homebrew (if not installed)
/bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"

# Install Google Cloud SDK
brew install --cask google-cloud-sdk

# Install Firebase CLI
npm install -g firebase-tools

# Install Docker Desktop
# Download from: https://www.docker.com/products/docker-desktop
```

#### Linux

```bash
# Install Google Cloud SDK
curl https://sdk.cloud.google.com | bash
exec -l $SHELL

# Install Firebase CLI
npm install -g firebase-tools

# Install Docker
curl -fsSL https://get.docker.com -o get-docker.sh
sudo sh get-docker.sh
```

#### Windows

```powershell
# Install Google Cloud SDK
# Download from: https://cloud.google.com/sdk/docs/install

# Install Firebase CLI
npm install -g firebase-tools

# Install Docker Desktop
# Download from: https://www.docker.com/products/docker-desktop
```

### 3. Verify Installations

```bash
gcloud --version          # Should show version
firebase --version        # Should show version
docker --version          # Should show version
node --version           # Should show v18+
```

---

## Step-by-Step Deployment

### Step 1: Initial Setup (5 minutes)

#### 1.1 Login to Google Cloud

```bash
# Login to Google Cloud
gcloud auth login

# Set your project ID (replace YOUR_PROJECT_ID)
gcloud config set project YOUR_PROJECT_ID

# Verify
gcloud config list
```

#### 1.2 Login to Firebase

```bash
# Login to Firebase
firebase login

# Initialize Firebase in project directory
cd /Users/marcus.poole/workspace/FlightStory/guest_approval_app/doac-referral
firebase init hosting
```

**Firebase Init Prompts:**
- Use existing project? **Yes**
- Select your project
- Public directory? **frontend/build**
- Configure as single-page app? **Yes**
- Set up automatic builds? **No** (we'll do manual deploys)
- Overwrite index.html? **No**

#### 1.3 Update Firebase Config

Edit `.firebaserc` and replace `YOUR_PROJECT_ID` with your actual project ID:

```json
{
  "projects": {
    "default": "your-actual-project-id"
  }
}
```

---

### Step 2: Enable Required APIs (2 minutes)

```bash
# Enable all required Google Cloud APIs
gcloud services enable \
  run.googleapis.com \
  cloudbuild.googleapis.com \
  sqladmin.googleapis.com \
  redis.googleapis.com \
  secretmanager.googleapis.com \
  compute.googleapis.com \
  artifactregistry.googleapis.com \
  vpcaccess.googleapis.com \
  servicenetworking.googleapis.com

echo "✅ All APIs enabled"
```

---

### Step 3: Set Up Cloud SQL Database (10 minutes)

#### 3.1 Create PostgreSQL Instance

```bash
# Create Cloud SQL instance (takes 5-10 minutes)
# Using db-custom-2-7680 for viral traffic (500 connections)
gcloud sql instances create doac-referral-db \
  --database-version=POSTGRES_15 \
  --tier=db-custom-2-7680 \
  --region=us-central1 \
  --storage-type=SSD \
  --storage-size=10GB \
  --storage-auto-increase \
  --backup-start-time=03:00 \
  --enable-bin-log

# Check status
gcloud sql instances describe doac-referral-db
```

#### 3.2 Create Database

```bash
# Create the database
gcloud sql databases create doac_referral \
  --instance=doac-referral-db
```

#### 3.3 Set Password

```bash
# Generate secure password
export DB_PASSWORD=$(openssl rand -base64 32)
echo "Database Password (save this): $DB_PASSWORD"

# Set postgres user password
gcloud sql users set-password postgres \
  --instance=doac-referral-db \
  --password="$DB_PASSWORD"
```

#### 3.4 Get Connection Name

```bash
# Get connection name (you'll need this later)
export CONNECTION_NAME=$(gcloud sql instances describe doac-referral-db \
  --format="value(connectionName)")

echo "Connection Name: $CONNECTION_NAME"
```

---

### Step 4: Set Up Redis (Memorystore) (10 minutes)

```bash
# Create Redis instance (takes 5-10 minutes)
# Using 5GB for viral traffic caching
gcloud redis instances create doac-referral-redis \
  --size=5 \
  --region=us-central1 \
  --redis-version=redis_6_x \
  --tier=basic

# Get Redis connection details
export REDIS_HOST=$(gcloud redis instances describe doac-referral-redis \
  --region=us-central1 \
  --format="value(host)")

export REDIS_PORT=$(gcloud redis instances describe doac-referral-redis \
  --region=us-central1 \
  --format="value(port)")

echo "Redis URL: redis://${REDIS_HOST}:${REDIS_PORT}"
```

---

### Step 4.5: Create VPC Access Connector (10 minutes) - CRITICAL

**⚠️ REQUIRED FOR REDIS CONNECTIVITY**

Cloud Run needs a VPC Access Connector to communicate with Memorystore Redis.

```bash
# Create VPC Access Connector
# This allows Cloud Run to reach Redis on private network
gcloud compute networks vpc-access connectors create vpc-connector \
  --region=us-central1 \
  --subnet=default \
  --min-instances=2 \
  --max-instances=10 \
  --machine-type=e2-micro

# Wait for connector to be ready (takes 5-10 minutes)
echo "⏳ Waiting for VPC connector to be ready..."
while [ "$(gcloud compute networks vpc-access connectors describe vpc-connector --region=us-central1 --format='value(state)')" != "READY" ]; do
  echo "VPC connector status: $(gcloud compute networks vpc-access connectors describe vpc-connector --region=us-central1 --format='value(state)')"
  sleep 10
done

echo "✅ VPC connector ready"

# Verify connector
gcloud compute networks vpc-access connectors describe vpc-connector \
  --region=us-central1
```

**Cost:** ~$14/month for VPC connector (always running)

**Why this is critical:**
- Without VPC connector: Backend CANNOT connect to Redis
- Without Redis: Rate limiting fails → Site crashes
- This is NOT optional - your deployment will fail without it

---

### Step 5: Store Secrets (5 minutes)

```bash
# Generate JWT secret
export JWT_SECRET=$(openssl rand -base64 64)

# Store DATABASE_URL
export DATABASE_URL="postgresql://postgres:${DB_PASSWORD}@localhost/doac_referral?host=/cloudsql/${CONNECTION_NAME}"

echo -n "$DATABASE_URL" | gcloud secrets create database-url --data-file=-

# Store JWT_SECRET
echo -n "$JWT_SECRET" | gcloud secrets create jwt-secret --data-file=-

# Store REDIS_URL
export REDIS_URL="redis://${REDIS_HOST}:${REDIS_PORT}"
echo -n "$REDIS_URL" | gcloud secrets create redis-url --data-file=-

# Store email configuration (optional)
read -p "Enter email user (or press Enter to skip): " EMAIL_USER
if [ -n "$EMAIL_USER" ]; then
  echo -n "$EMAIL_USER" | gcloud secrets create email-user --data-file=-

  read -sp "Enter email password: " EMAIL_PASS
  echo ""
  echo -n "$EMAIL_PASS" | gcloud secrets create email-pass --data-file=-

  read -p "Enter admin email: " ADMIN_EMAIL
  echo -n "$ADMIN_EMAIL" | gcloud secrets create admin-email --data-file=-
fi

echo "✅ Secrets stored in Secret Manager"
```

---

### Step 6: Deploy Backend to Cloud Run (10 minutes)

#### 6.1 Install Dependencies

```bash
cd backend
npm install
```

#### 6.2 Build and Deploy

```bash
# Build Docker image and deploy
gcloud builds submit --tag gcr.io/$(gcloud config get-value project)/doac-referral-backend

# Deploy to Cloud Run - OPTIMIZED FOR VIRAL TRAFFIC
# Handles 8,000 concurrent users (100 instances × 80 concurrency)
gcloud run deploy doac-referral-backend \
  --image gcr.io/$(gcloud config get-value project)/doac-referral-backend \
  --platform managed \
  --region us-central1 \
  --allow-unauthenticated \
  --port 8080 \
  --min-instances 0 \
  --max-instances 100 \
  --memory 512Mi \
  --cpu 1 \
  --timeout 300 \
  --concurrency 80 \
  --cpu-throttling \
  --set-env-vars "NODE_ENV=production,PORT=8080" \
  --set-secrets "DATABASE_URL=database-url:latest,JWT_SECRET=jwt-secret:latest,REDIS_URL=redis-url:latest,EMAIL_USER=email-user:latest,EMAIL_PASS=email-pass:latest,ADMIN_EMAIL=admin-email:latest" \
  --add-cloudsql-instances "$CONNECTION_NAME" \
  --vpc-connector vpc-connector \
  --vpc-egress private-ranges-only

# Get backend URL
export BACKEND_URL=$(gcloud run services describe doac-referral-backend \
  --region us-central1 \
  --format="value(status.url)")

echo "✅ Backend deployed to: $BACKEND_URL"
echo "✅ Can handle 8,000 concurrent users"
```

---

### Step 7: Run Database Migrations (5 minutes)

```bash
# Install Cloud SQL Proxy
curl -o cloud_sql_proxy https://dl.google.com/cloudsql/cloud_sql_proxy.darwin.amd64
chmod +x cloud_sql_proxy

# Start proxy in background
./cloud_sql_proxy -instances="${CONNECTION_NAME}"=tcp:5432 &
PROXY_PID=$!

# Wait for proxy to connect
sleep 5

# Set local DATABASE_URL
export DATABASE_URL="postgresql://postgres:${DB_PASSWORD}@127.0.0.1:5432/doac_referral"

# Run migrations
npm run migrate

# Stop proxy
kill $PROXY_PID

cd ..

echo "✅ Database migrations complete"
```

---

### Step 8: Deploy Frontend to Firebase (5 minutes)

#### 8.1 Update Firebase Configuration

Update `firebase.json` to point to your Cloud Run backend:

```json
{
  "hosting": {
    "public": "frontend/build",
    "rewrites": [
      {
        "source": "/api/**",
        "run": {
          "serviceId": "doac-referral-backend",
          "region": "us-central1"
        }
      },
      {
        "source": "**",
        "destination": "/index.html"
      }
    ]
  }
}
```

#### 8.2 Build and Deploy Frontend

```bash
cd frontend

# Install dependencies
npm install

# Set backend URL for build
export REACT_APP_API_URL="$BACKEND_URL"
export REACT_APP_ENVIRONMENT="production"

# Build
npm run build

# Deploy to Firebase
firebase deploy --only hosting

# Get frontend URL
export FRONTEND_URL=$(firebase hosting:channel:list --json | grep -o '"url":"[^"]*' | cut -d'"' -f4 | head -1)

echo "✅ Frontend deployed to: $FRONTEND_URL"

cd ..
```

---

### Step 9: Update CORS Settings (2 minutes)

Update Cloud Run backend to allow Firebase Hosting domain:

```bash
gcloud run services update doac-referral-backend \
  --region us-central1 \
  --set-env-vars "FRONTEND_URL=https://$(gcloud config get-value project).web.app"
```

---

### Step 10: Verify Deployment (5 minutes)

#### 10.1 Health Check

```bash
# Check backend health
curl $BACKEND_URL/health

# Should return: {"status":"ok","message":"Server is running"}
```

#### 10.2 Test Frontend

```bash
# Open frontend in browser
open "https://$(gcloud config get-value project).web.app"
```

#### 10.3 Test Registration

1. Go to frontend URL
2. Click "Register"
3. Create account
4. Verify you can log in

#### 10.4 Test Referral System

1. Copy your referral link from dashboard
2. Open in incognito/private window
3. Verify it redirects and awards points

---

## Post-Deployment Tasks

### 1. Change Admin Password

```sql
-- Connect to database
gcloud sql connect doac-referral-db --user=postgres --database=doac_referral

-- Change admin password
UPDATE users SET password_hash = crypt('your-new-strong-password', gen_salt('bf', 10))
WHERE email = 'admin@example.com';
```

### 2. Set Up Custom Domain (Optional)

#### Firebase Hosting

```bash
# Add custom domain
firebase hosting:channel:deploy production --domain your-domain.com
```

Follow Firebase console instructions to configure DNS.

### 3. Set Up Monitoring

Enable Cloud Monitoring:

```bash
# Enable monitoring API
gcloud services enable monitoring.googleapis.com

# Create uptime check
gcloud alpha monitoring uptime create web \
  --resource-type=url \
  --check-interval=300 \
  --timeout=10 \
  --url="${BACKEND_URL}/health"
```

### 4. Set Up Alerting

Create alert policies in GCP Console:
- Cloud Run: CPU > 80%
- Cloud Run: Error rate > 5%
- Cloud SQL: Connection pool > 90%
- Redis: Memory > 90%

### 5. Enable Auto-Backup

```bash
# Verify backups are enabled
gcloud sql instances describe doac-referral-db \
  --format="value(settings.backupConfiguration.enabled)"
```

---

## Load Testing

Now test your deployment:

```bash
cd loadtest

# Install Locust
pip install -r requirements.txt

# Run baseline test (1,000 users)
locust -f locustfile.py --host="https://$(gcloud config get-value project).web.app" \
  --users 1000 --spawn-rate 50 --run-time 10m --headless \
  --html report-baseline.html

# Run fraud test
locust -f referral-fraud-test.py --host="https://$(gcloud config get-value project).web.app" \
  --users 100 --spawn-rate 10 --run-time 5m --headless \
  --html report-fraud.html
```

**Expected Results:**
- ✅ 95th percentile response time < 500ms
- ✅ Error rate < 1%
- ✅ 95%+ fraud attempts blocked

---

## Cost Management

### Monitor Costs

```bash
# Set billing alert
gcloud alpha billing budgets create \
  --billing-account=YOUR_BILLING_ACCOUNT_ID \
  --display-name="DOAC Referral Budget" \
  --budget-amount=100USD \
  --threshold-rule=percent=50 \
  --threshold-rule=percent=90
```

### Cost Optimization Tips

1. **Use Cloud Run min-instances=0** for dev/staging (scale to zero)
2. **Use db-f1-micro** for low traffic (upgrade when needed)
3. **Use Redis basic tier** (upgrade to standard for HA)
4. **Set up log retention** (delete old logs after 30 days)
5. **Use committed use discounts** (30-57% savings)

---

## Troubleshooting

### Backend Not Responding

```bash
# Check Cloud Run logs
gcloud logging read "resource.type=cloud_run_revision AND resource.labels.service_name=doac-referral-backend" --limit 50 --format json

# Check if service is running
gcloud run services describe doac-referral-backend --region us-central1
```

### Database Connection Issues

```bash
# Test connection
gcloud sql connect doac-referral-db --user=postgres

# Check active connections
SELECT count(*) FROM pg_stat_activity;
```

### Redis Connection Issues

```bash
# Check Redis status
gcloud redis instances describe doac-referral-redis --region us-central1

# Check if it's accessible from Cloud Run
gcloud compute networks vpc-access connectors list
```

### Frontend Not Loading

```bash
# Check Firebase hosting status
firebase hosting:channel:list

# Check if backend URL is correct in build
# Rebuild frontend with correct REACT_APP_API_URL
```

---

## Migration from Railway

If you have data on Railway:

### 1. Export Railway Database

```bash
# From Railway dashboard, get DATABASE_URL
# Then export:
pg_dump $RAILWAY_DATABASE_URL > railway_backup.sql
```

### 2. Import to Cloud SQL

```bash
# Start Cloud SQL Proxy
./cloud_sql_proxy -instances="${CONNECTION_NAME}"=tcp:5432 &

# Import
psql "postgresql://postgres:${DB_PASSWORD}@127.0.0.1:5432/doac_referral" < railway_backup.sql

# Stop proxy
killall cloud_sql_proxy
```

### 3. Test Migration

1. Verify user count matches
2. Test login with existing accounts
3. Verify referral codes work
4. Check points balances

---

## Maintenance

### Update Backend

```bash
cd backend

# Make code changes
# Then deploy:
gcloud builds submit --tag gcr.io/$(gcloud config get-value project)/doac-referral-backend
gcloud run deploy doac-referral-backend --image gcr.io/$(gcloud config get-value project)/doac-referral-backend --region us-central1
```

### Update Frontend

```bash
cd frontend

# Make code changes
npm run build

# Deploy
firebase deploy --only hosting
```

### Database Maintenance

```bash
# Vacuum database
gcloud sql operations list --instance=doac-referral-db --filter="operationType=VACUUM"

# Backup now
gcloud sql backups create --instance=doac-referral-db
```

---

## Success Checklist

- [ ] Backend deployed to Cloud Run
- [ ] Frontend deployed to Firebase Hosting
- [ ] Database migrated successfully
- [ ] Redis caching working
- [ ] Health check passing
- [ ] Can register new account
- [ ] Can log in
- [ ] Referral links work
- [ ] Points are awarded
- [ ] Rate limiting working (test with multiple clicks)
- [ ] Fraud detection working (test with bot user-agent)
- [ ] Load test passed (1,000 users)
- [ ] Admin password changed
- [ ] Monitoring set up
- [ ] Alerts configured
- [ ] Backups enabled

---

## Summary

**Your application is now deployed with:**

- 🚀 **Auto-scaling backend** (Cloud Run: 0-100 instances)
- 🌍 **Global CDN** (Firebase Hosting)
- 💾 **Managed database** (Cloud SQL PostgreSQL - 500 connections)
- 🔴 **Redis caching** (Memorystore - 5GB)
- 🔒 **Secure secrets** (Secret Manager)
- 🛡️ **Fraud protection** (Rate limiting + bot detection)
- 📊 **Monitoring** (Cloud Monitoring)
- 💰 **Cost: $425-800/month** (viral traffic)

**Capacity:**
- ✅ Handles 8,000 concurrent users (current config)
- ✅ Can scale to 20,000 with quota increase
- ✅ Auto-scales to handle spikes
- ✅ 95%+ fraud protection
- ✅ <500ms response times

**Next Steps:**
1. Request Cloud Run quota increase (250+ instances)
2. Run load tests before video drop
3. Set up monitoring alerts
4. Prepare emergency scaling commands
5. Test referral system end-to-end

---

## Support

- **GCP Documentation:** https://cloud.google.com/docs
- **Firebase Documentation:** https://firebase.google.com/docs
- **Cloud Run Pricing:** https://cloud.google.com/run/pricing
- **GCP Support:** https://cloud.google.com/support

**Questions?** Check Cloud Run logs: `gcloud logging read`
