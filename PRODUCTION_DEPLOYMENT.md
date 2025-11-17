# Production Deployment Checklist - Apple Podcasts Integration

## Pre-Deployment Steps

### 1. Database Migrations
Run all migrations in order on production database:
```bash
# Connect to production database
psql $PRODUCTION_DATABASE_URL

# Run migrations in order
\i backend/src/database/migrations/004_add_video_metadata.sql
\i backend/src/database/migrations/005_add_apple_podcasts.sql
```

### 2. Environment Variables
Add the following to production `.env`:
```bash
# Required for YouTube metadata
YOUTUBE_API_KEY=<your-youtube-data-api-v3-key>

# Optional for Spotify metadata (can use fallback)
SPOTIFY_CLIENT_ID=<your-spotify-client-id>
SPOTIFY_CLIENT_SECRET=<your-spotify-client-secret>
```

**How to get API keys:**
- YouTube: https://console.cloud.google.com/ → Enable YouTube Data API v3
- Spotify: https://developer.spotify.com/dashboard → Create App

### 3. Cache Video Metadata (Optional - Auto-initializes on startup)

**The server automatically caches metadata on startup**, but you can pre-populate if desired:

#### Option A: Let Auto-Initialization Handle It (Recommended)
Your server automatically:
- Checks if metadata exists on startup
- Fetches from APIs if missing (after 5 second delay)
- Runs in background without blocking requests
- Has error handling with fallbacks

**No action needed!** Just deploy and the metadata will be cached automatically.

#### Option B: Pre-populate Before Deployment
If you want to cache metadata *before* your production traffic hits:

```bash
cd backend

# Dry run (shows what would be cached, no changes)
npm run cache-metadata:safe

# Actually cache the metadata
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
   ✅ Success: "[Video Title]"
🎵 Caching spotify metadata...
   ✅ Success: "[Episode Title]"
🍎 Caching apple metadata...
   ✅ Success: "[Episode Title]"

🎉 Metadata caching complete!
```

**Production-safe features:**
- Only updates stale data (>24 hours old)
- Dry-run mode to preview changes
- Graceful error handling
- Skips platforms with fresh cache

### 4. Update Referral URLs (Optional)
If you want to change the default Apple Podcasts URL:
```sql
UPDATE settings
SET value = 'https://podcasts.apple.com/YOUR/NEW/URL'
WHERE key = 'redirect_url_apple';
```

Then re-run: `npm run cache-metadata`

## Security Checklist

### ✅ All Security Features Enabled

1. **SQL Injection Protection**
   - ✅ All queries use parameterized statements
   - ✅ No string concatenation in SQL

2. **XSS Protection**
   - ✅ React auto-escapes all user input
   - ✅ No dangerouslySetInnerHTML usage
   - ✅ HTML entities decoded server-side

3. **Fraud Prevention**
   - ✅ Device ID matching (score: 100)
   - ✅ Device fingerprint matching (score: 50)
   - ✅ Browser fingerprint matching (score: 30)
   - ✅ IP tiebreaker (score: 10)
   - ✅ Threshold: 80+ = fraud detected
   - ✅ Works for ALL platforms (YouTube, Spotify, Apple)

4. **Rate Limiting**
   - ✅ Referral clicks: 50/min (DoS protection only)
   - ✅ Platform buttons: 10/min (NEW - prevents spam)
   - ✅ Login attempts: 10/15min
   - ✅ Registration: 5/hour
   - ✅ Redis-backed (falls back to memory if Redis down)

5. **SSRF Protection**
   - ✅ Apple Podcasts: URL must start with `https://podcasts.apple.com/`
   - ✅ Regex limits (500 chars for title, 2000 for description)
   - ✅ HTML size limit (5MB max)
   - ✅ 10-second fetch timeout

6. **Session Security**
   - ✅ Fingerprint validation on platform selection
   - ✅ One-time Redis tokens (10min TTL)
   - ✅ Prevents session hijacking

## Scalability Verification

### Database Indexes
```sql
-- Verify indexes exist:
\d video_metadata

-- Should show:
-- "idx_video_metadata_platform" btree (platform)
-- "idx_video_metadata_video_id" btree (video_id)
-- "video_metadata_platform_video_id_key" UNIQUE (platform, video_id)
```

### Query Performance
All platform queries use indexed lookups:
```sql
-- Fast lookup by platform (uses idx_video_metadata_platform)
SELECT * FROM video_metadata WHERE platform IN ('youtube', 'spotify', 'apple');

-- Fast fraud check (uses idx_user_fingerprints_user_id)
SELECT * FROM user_fingerprints WHERE user_id = ? AND last_seen > NOW() - INTERVAL '90 days';
```

### Redis Caching Strategy
- User ID lookups: 1 hour cache
- Pending clicks: 10 min TTL
- Fraud fingerprints: 24 hour TTL
- Rate limits: Redis-backed for distributed systems

## Post-Deployment Verification

### 1. Test Apple Podcasts Flow
1. Visit a referral link: `https://yourdomain.com/r/TESTCODE`
2. Verify Apple Podcasts metadata loads (thumbnail, title, channel)
3. Click "Apple" button
4. Verify redirect to Apple Podcasts URL
5. Check logs for: `✅ Points awarded for code TESTCODE via apple button`

### 2. Verify Fraud Prevention
1. Click same referral link again from same device
2. Should see: `⚠️ Points NOT awarded - fraud flags: self_click`
3. Points should NOT increment

### 3. Check Rate Limiting
```bash
# Test platform button rate limit (should block after 10 requests/min)
for i in {1..15}; do
  curl -X POST https://yourdomain.com/api/referral/award-points \
    -H "Content-Type: application/json" \
    -d '{"code":"TEST","platform":"apple"}' \
    -w "\nStatus: %{http_code}\n"
done

# Request 11-15 should return 429 (Too Many Requests)
```

### 4. Monitor Logs
Watch for:
```bash
# Successful clicks
✅ Click tracked for code ABC123, pending platform selection
✅ Points awarded for code ABC123 via apple button

# Fraud detection
🚨 SELF-CLICK DETECTED: User 42 clicked their own referral link
⚠️ Points NOT awarded for code ABC123 - fraud flags: ["self_click:Device ID match"]

# Rate limiting
⚠️ Extreme rate limit exceeded for referral click from IP: 1.2.3.4
```

## Rollback Plan

If issues occur, rollback migrations:
```sql
-- Remove Apple Podcasts URL
DELETE FROM settings WHERE key = 'redirect_url_apple';

-- Optionally remove Apple metadata
DELETE FROM video_metadata WHERE platform = 'apple';
```

Frontend will gracefully hide Apple button if no metadata exists.

## Performance Benchmarks

Expected response times:
- `/referral/settings`: <50ms (cached metadata)
- `/referral/:code`: <100ms (fraud checks + Redis)
- `/referral/award-points`: <100ms (Redis lookup + DB update)

## Monitoring

Watch these metrics:
1. **Error Rate**: Should remain <0.1%
2. **Fraud Detection Rate**: 5-10% is normal
3. **Cache Hit Rate**: Redis should be >95%
4. **Response Times**: P95 <200ms

## Support

If issues arise:
1. Check Redis connection: `redis-cli ping`
2. Check database indexes: `\d video_metadata`
3. Verify API keys: `echo $YOUTUBE_API_KEY`
4. Review logs: `tail -f backend/logs/app.log`
