# Production Deployment Guide - Google Cloud Run

## Overview

This guide walks you through deploying the DOAC referral system to Google Cloud Run **safely** without disrupting your running production service.

## Key Safety Features

✅ **Auto-initialization**: Metadata caches automatically on server startup
✅ **Zero-downtime**: Cloud Run handles blue-green deployment automatically
✅ **Database migrations**: Safe to run while old version is still running
✅ **Rollback-friendly**: Easy to revert if needed

---

## Pre-Deployment Checklist

### 1. Run Database Migrations

The migrations are **safe to run on live production** - they only add new tables/columns:

```bash
# Option A: Connect directly to Cloud SQL
gcloud sql connect YOUR_INSTANCE --user=postgres

# Run migrations
\i backend/src/database/migrations/004_add_video_metadata.sql
\i backend/src/database/migrations/005_add_apple_podcasts.sql
\q
```

```bash
# Option B: Use psql with connection string
psql "$PRODUCTION_DATABASE_URL" -f backend/src/database/migrations/004_add_video_metadata.sql
psql "$PRODUCTION_DATABASE_URL" -f backend/src/database/migrations/005_add_apple_podcasts.sql
```

**What these migrations do:**
- `004`: Creates `video_metadata` table with indexes
- `005`: Adds `redirect_url_apple` to settings table
- **Safe**: Won't affect existing data or running services

### 2. Set Environment Variables

Add to your Cloud Run service environment variables (or Secret Manager):

```bash
# Required for YouTube metadata (otherwise uses fallback)
YOUTUBE_API_KEY=<your-youtube-data-api-v3-key>

# Optional for Spotify metadata (otherwise uses fallback)
SPOTIFY_CLIENT_ID=<your-spotify-client-id>
SPOTIFY_CLIENT_SECRET=<your-spotify-client-secret>
```

**Get API keys:**
- **YouTube**: [Google Cloud Console](https://console.cloud.google.com/) → Enable YouTube Data API v3 → Credentials
- **Spotify**: [Spotify Dashboard](https://developer.spotify.com/dashboard) → Create App → Get Client ID/Secret

**Using Cloud Run UI:**
```bash
gcloud run services update YOUR_SERVICE_NAME \
  --update-env-vars YOUTUBE_API_KEY=your_key_here \
  --update-env-vars SPOTIFY_CLIENT_ID=your_id_here \
  --update-env-vars SPOTIFY_CLIENT_SECRET=your_secret_here \
  --region us-central1
```

**OR** add them in Cloud Console:
1. Go to Cloud Run → Your Service → Edit & Deploy New Revision
2. Variables & Secrets → Add Variable
3. Add each key/value pair

---

## Deployment Steps

### Option 1: Automatic Metadata Caching (Recommended)

**This is the simplest and safest approach** - just deploy!

```bash
# Build and deploy
gcloud builds submit --tag gcr.io/YOUR_PROJECT/doac-backend
gcloud run deploy YOUR_SERVICE_NAME \
  --image gcr.io/YOUR_PROJECT/doac-backend \
  --region us-central1 \
  --platform managed
```

**What happens automatically:**
1. Cloud Run deploys new container (old one keeps running)
2. New container starts, runs health checks
3. After 5 seconds, `initializeMetadataBackground()` runs
4. Checks database for existing metadata
5. Fetches from APIs if missing
6. Once healthy, Cloud Run switches traffic (zero downtime)

**Monitor the logs:**
```bash
gcloud run services logs read YOUR_SERVICE_NAME --limit 50
```

Look for:
```
✅ All required environment variables are set
🚀 Server running on port 8080
🔍 Checking video metadata cache...
📥 Metadata missing or incomplete - fetching from APIs...
📺 Fetching YouTube metadata...
✅ YouTube cached: [Video Title]
🎵 Fetching Spotify metadata...
✅ Spotify cached: [Episode Title]
🍎 Fetching Apple Podcasts metadata...
✅ Apple Podcasts cached: [Episode Title]
🎉 Video metadata initialization complete!
```

### Option 2: Pre-populate Metadata Before Traffic Hits

If you want to ensure metadata is cached **before** any user requests hit:

#### Step 1: Build but don't deploy yet
```bash
# Build the container
gcloud builds submit --tag gcr.io/YOUR_PROJECT/doac-backend
```

#### Step 2: Run safe caching script
```bash
cd backend

# First, do a dry run to see what would be cached
npm run cache-metadata:safe

# If output looks good, actually cache it
npm run cache-metadata:safe -- --force
```

**Expected output:**
```
📋 Current video URLs:
   📺 YouTube: https://youtu.be/qxxnRMT9C-8
   🎵 Spotify: https://open.spotify.com/episode/...
   🍎 Apple Podcasts: https://podcasts.apple.com/...

📊 Current metadata cache status:
   (no metadata cached yet)

📥 Will cache/update 3 platform(s)

📺 Caching youtube metadata...
   ✅ Success: "Death of a Cheerleader - Episode Title"
   📸 Thumbnail: https://i.ytimg.com/vi/...
   🎙️  Channel: Death of a Cheerleader

🎵 Caching spotify metadata...
   ✅ Success: "Episode Title"
   📸 Thumbnail: https://i.scdn.co/image/...
   🎙️  Channel: Death of a Cheerleader

🍎 Caching apple metadata...
   ✅ Success: "Episode Title"
   📸 Thumbnail: https://is1-ssl.mzstatic.com/...
   🎙️  Channel: Death of a Cheerleader

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📊 Summary:
   ✅ Cached: 3
   ⏭️  Skipped (fresh): 0
   ❌ Errors: 0
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

🎉 Metadata caching complete!
```

#### Step 3: Deploy
```bash
gcloud run deploy YOUR_SERVICE_NAME \
  --image gcr.io/YOUR_PROJECT/doac-backend \
  --region us-central1 \
  --platform managed
```

Now when the server starts, it will see the metadata already exists and skip the API calls.

---

## Post-Deployment Verification

### 1. Check Service Health
```bash
curl https://YOUR_SERVICE_URL/health
```

Expected:
```json
{
  "status": "ok",
  "message": "Server is running",
  "environment": "production",
  "timestamp": "2025-11-17T..."
}
```

### 2. Test Referral Landing Page

Visit a referral link: `https://your-domain.com/r/TESTCODE`

**Verify:**
- ✅ YouTube card shows: thumbnail, title, channel name, view count
- ✅ Spotify card shows: thumbnail, title, channel name
- ✅ Apple Podcasts card shows: thumbnail, title, channel name
- ✅ Page loads in <100ms (cached metadata)

### 3. Test Platform Click Flow

Click each platform button and verify:
1. Redirects to correct URL
2. Points awarded (check logs)
3. Fraud prevention working (click same link again = no points)

**Check logs:**
```bash
gcloud run services logs read YOUR_SERVICE_NAME --limit 100
```

Look for:
```
✅ Click tracked for code ABC123, pending platform selection
✅ Points awarded for code ABC123 via youtube button
✅ Points awarded for code DEF456 via spotify button
✅ Points awarded for code GHI789 via apple button

🚨 SELF-CLICK DETECTED: User 42 clicked their own referral link
⚠️ Points NOT awarded - fraud flags: ["self_click:Device ID match"]
```

### 4. Verify Metadata API Calls

Check that APIs are responding correctly:

```bash
# SSH into a Cloud Run instance (for testing only)
gcloud run services proxy YOUR_SERVICE_NAME --region us-central1

# Or check logs for API errors
gcloud run services logs read YOUR_SERVICE_NAME --limit 200 | grep -i "api"
```

No errors = APIs working correctly!

### 5. Performance Check

Landing page should load fast:
```bash
curl -w "@-" -o /dev/null -s https://YOUR_SERVICE_URL/api/referral/settings << 'EOF'
    time_namelookup:  %{time_namelookup}\n
       time_connect:  %{time_connect}\n
    time_appconnect:  %{time_appconnect}\n
   time_pretransfer:  %{time_pretransfer}\n
      time_redirect:  %{time_redirect}\n
 time_starttransfer:  %{time_starttransfer}\n
                    ----------\n
         time_total:  %{time_total}\n
EOF
```

Expected: `time_total` < 0.1s (100ms)

---

## Monitoring

### Key Metrics to Watch

1. **Error Rate**: Should stay <0.1%
   ```bash
   gcloud logging read "resource.type=cloud_run_revision AND severity>=ERROR" --limit 50
   ```

2. **Response Times**: P95 should be <200ms
   - Check in Cloud Console → Cloud Run → Metrics

3. **Fraud Detection Rate**: 5-10% is normal
   ```bash
   gcloud run services logs read YOUR_SERVICE_NAME | grep "FRAUD DETECTED"
   ```

4. **API Call Success Rate**
   ```bash
   gcloud run services logs read YOUR_SERVICE_NAME | grep -E "(YouTube|Spotify|Apple).*cached"
   ```

### Set Up Alerts (Optional)

Create alerts for:
- Error rate > 1%
- Response time P95 > 500ms
- Memory usage > 80%
- CPU usage > 80%

---

## Troubleshooting

### Issue: Metadata not loading

**Check:**
```bash
# Verify table exists
gcloud sql connect YOUR_INSTANCE --user=postgres
SELECT * FROM video_metadata;
```

**Fix:**
```bash
# Re-run the caching script
npm run cache-metadata:safe -- --force
```

### Issue: API keys not working

**Check:**
```bash
gcloud run services describe YOUR_SERVICE_NAME --region us-central1 \
  --format="value(spec.template.spec.containers[0].env)"
```

**Fix:**
Update environment variables and redeploy.

### Issue: Old metadata showing

**Solution:**
```bash
# Force refresh metadata (it's >24 hours old)
npm run cache-metadata:safe -- --force
```

### Issue: Server not starting

**Check logs:**
```bash
gcloud run services logs read YOUR_SERVICE_NAME --limit 100
```

**Common causes:**
- Missing environment variables (DATABASE_URL, JWT_SECRET, REDIS_URL)
- Database connection issues
- Redis connection issues

---

## Rollback Plan

If you need to rollback:

### Quick Rollback (to previous revision)
```bash
# List revisions
gcloud run revisions list --service YOUR_SERVICE_NAME --region us-central1

# Rollback to previous revision
gcloud run services update-traffic YOUR_SERVICE_NAME \
  --to-revisions PREVIOUS_REVISION=100 \
  --region us-central1
```

### Database Rollback (if needed)
```sql
-- Remove Apple Podcasts setting
DELETE FROM settings WHERE key = 'redirect_url_apple';

-- Remove Apple metadata (optional)
DELETE FROM video_metadata WHERE platform = 'apple';
```

Frontend will gracefully hide the Apple button if no metadata exists.

---

## Updating Video URLs in Production

When you want to change to a new episode:

### Option 1: Via Admin Panel (TODO)
Update URLs in admin panel → Metadata auto-refreshes

### Option 2: Via Database
```sql
-- Update the URL
UPDATE settings
SET value = 'https://youtu.be/NEW_VIDEO_ID'
WHERE key = 'redirect_url';

-- Update the URL for Spotify
UPDATE settings
SET value = 'https://open.spotify.com/episode/NEW_EPISODE_ID'
WHERE key = 'redirect_url_spotify';

-- Update the URL for Apple Podcasts
UPDATE settings
SET value = 'https://podcasts.apple.com/rs/podcast/NEW_EPISODE'
WHERE key = 'redirect_url_apple';
```

Then refresh metadata:
```bash
npm run cache-metadata:safe -- --force
```

---

## Security Checklist

Before going live, verify:

- ✅ All database queries use parameterized statements
- ✅ Rate limiting enabled (Redis-backed)
- ✅ Fraud detection active (device fingerprinting)
- ✅ SSRF protection on Apple Podcasts scraping
- ✅ Environment variables in Secret Manager (not plain text)
- ✅ CORS configured for production domain only
- ✅ Helmet security headers enabled
- ✅ HTTPS only (Cloud Run default)

See [SECURITY_AUDIT_REPORT.md](SECURITY_AUDIT_REPORT.md) for full details.

---

## Performance Benchmarks

Expected performance:
- Landing page load: **<100ms**
- Click tracking: **<100ms**
- Points award: **<100ms**
- Fraud check: **<50ms**

All queries use indexed lookups for optimal performance.

---

## Support

If issues arise:

1. Check Cloud Run logs first
2. Verify database connectivity
3. Test Redis connection
4. Review security rules (CORS, rate limiting)
5. Check API quotas (YouTube, Spotify)

**Emergency contacts:**
- Cloud Run docs: https://cloud.google.com/run/docs
- PostgreSQL docs: https://www.postgresql.org/docs/
- Redis docs: https://redis.io/documentation

---

## Summary

**Recommended deployment flow:**

1. ✅ Run database migrations
2. ✅ Set environment variables (YouTube API key, etc.)
3. ✅ Deploy to Cloud Run
4. ✅ Metadata caches automatically on startup
5. ✅ Verify in logs
6. ✅ Test referral flow
7. ✅ Monitor for 24 hours

**Total downtime:** 0 seconds (Cloud Run handles zero-downtime deployment)

**Risk level:** Low (auto-initialization handles everything safely)

Happy deploying! 🚀
