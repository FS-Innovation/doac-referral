# Quick Start: Deploy to Production (Google Cloud Run)

**30-second summary:** Your app auto-caches video metadata on startup. Just run migrations and deploy!

---

## Fast Track (Recommended)

```bash
# 1. Run database migrations (safe to run on live DB)
psql "$PRODUCTION_DATABASE_URL" -f backend/src/database/migrations/004_add_video_metadata.sql
psql "$PRODUCTION_DATABASE_URL" -f backend/src/database/migrations/005_add_apple_podcasts.sql

# 2. Set environment variables
gcloud run services update YOUR_SERVICE_NAME \
  --update-env-vars YOUTUBE_API_KEY=your_key_here \
  --region us-central1

# 3. Build and deploy
gcloud builds submit --tag gcr.io/YOUR_PROJECT/doac-backend
gcloud run deploy YOUR_SERVICE_NAME \
  --image gcr.io/YOUR_PROJECT/doac-backend \
  --region us-central1

# 4. Watch logs to verify auto-initialization
gcloud run services logs tail YOUR_SERVICE_NAME

# Done! Metadata caches automatically on startup.
```

---

## Safe Track (Pre-cache metadata first)

```bash
# Steps 1-2: Same as above (migrations + env vars)

# 3. Build container
gcloud builds submit --tag gcr.io/YOUR_PROJECT/doac-backend

# 4. Pre-populate metadata cache
cd backend
npm run cache-metadata:safe                    # Dry run
npm run cache-metadata:safe -- --force         # Actually cache

# 5. Deploy
gcloud run deploy YOUR_SERVICE_NAME \
  --image gcr.io/YOUR_PROJECT/doac-backend \
  --region us-central1
```

---

## What Gets Auto-Cached on Startup

Your server automatically caches:
- **YouTube** video metadata (title, thumbnail, views, duration)
- **Spotify** episode metadata (title, thumbnail, show name)
- **Apple Podcasts** episode metadata (title, thumbnail, show name)

**How it works:**
1. Server starts → waits 5 seconds
2. Checks if metadata exists in database
3. If missing → fetches from APIs in background
4. Stores in `video_metadata` table
5. Landing pages load instantly from cache

**Location:** [backend/src/startup/initializeMetadata.ts](backend/src/startup/initializeMetadata.ts#L88)

---

## Required Environment Variables

```bash
# Must have
DATABASE_URL=postgresql://...
JWT_SECRET=your-secret
REDIS_URL=redis://...

# For video metadata (optional, has fallbacks)
YOUTUBE_API_KEY=AIza...        # Get from Google Cloud Console
SPOTIFY_CLIENT_ID=abc123       # Get from Spotify Dashboard
SPOTIFY_CLIENT_SECRET=xyz789   # Get from Spotify Dashboard
```

**Without API keys:** App uses fallback metadata (generic titles, default thumbnails)

---

## Verify Deployment

```bash
# Health check
curl https://YOUR_SERVICE_URL/health

# Test landing page
curl https://YOUR_SERVICE_URL/api/referral/settings

# Check logs for auto-init
gcloud run services logs read YOUR_SERVICE_NAME --limit 50 | grep -A 5 "metadata"
```

**Expected in logs:**
```
🔍 Checking video metadata cache...
📥 Metadata missing or incomplete - fetching from APIs...
✅ YouTube cached: [Video Title]
✅ Spotify cached: [Episode Title]
✅ Apple Podcasts cached: [Episode Title]
🎉 Video metadata initialization complete!
```

---

## Updating Video URLs

When you have a new episode:

```sql
-- Update URLs in database
UPDATE settings SET value = 'https://youtu.be/NEW_ID' WHERE key = 'redirect_url';
UPDATE settings SET value = 'https://open.spotify.com/episode/NEW_ID' WHERE key = 'redirect_url_spotify';
UPDATE settings SET value = 'https://podcasts.apple.com/NEW_URL' WHERE key = 'redirect_url_apple';
```

Then refresh cache:
```bash
npm run cache-metadata:safe -- --force
```

Or just restart your Cloud Run service (auto-init will refresh stale data).

---

## Rollback

```bash
# Rollback to previous revision
gcloud run revisions list --service YOUR_SERVICE_NAME --region us-central1
gcloud run services update-traffic YOUR_SERVICE_NAME \
  --to-revisions PREVIOUS_REVISION=100 \
  --region us-central1
```

---

## Need Help?

- **Detailed guide:** [PRODUCTION_DEPLOYMENT_GUIDE.md](PRODUCTION_DEPLOYMENT_GUIDE.md)
- **Security info:** [SECURITY_AUDIT_REPORT.md](SECURITY_AUDIT_REPORT.md)
- **Full checklist:** [PRODUCTION_DEPLOYMENT.md](PRODUCTION_DEPLOYMENT.md)

---

## Summary

✅ **Zero downtime:** Cloud Run handles blue-green deployment
✅ **Auto-caching:** Metadata initializes on startup
✅ **Safe migrations:** Add new tables without affecting existing data
✅ **Rollback-friendly:** Easy to revert if needed
✅ **Production-tested:** Fraud detection, rate limiting, and fallbacks built-in

**Estimated deployment time:** 5-10 minutes

Happy deploying! 🚀
