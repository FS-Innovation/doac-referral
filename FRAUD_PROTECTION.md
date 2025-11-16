# Fraud Protection System

This referral system has built-in fraud protection that **always redirects to your YouTube video** but intelligently prevents abuse by not awarding points for suspicious activity.

## Core Philosophy

**Everyone gets to watch the video, but only legitimate clicks earn points.**

This approach:
- ✅ Provides a good user experience (everyone sees the content)
- ✅ Prevents gaming the points system
- ✅ Tracks all activity for monitoring
- ✅ Doesn't punish users for edge cases (like clicking twice by accident)

## Fraud Detection Layers

### 1. Rate Limiting (1 click per IP per hour)

**What it detects:**
- Multiple clicks from the same IP address within 1 hour

**How it works:**
- First click: ✅ Redirect + award points
- Second+ click (within 1 hour): ✅ Redirect, ❌ no points

**Example:**
```bash
# First click
curl http://localhost:5000/api/referral/ABC123
# → Redirects to YouTube, +1 point

# Second click (within 1 hour)
curl http://localhost:5000/api/referral/ABC123
# → Redirects to YouTube, no points (logged as fraud)
```

**Log message:**
```
⚠️  Rate limit exceeded for referral click from IP: 203.0.113.42 (will redirect without points)
```

**Skip in development:**
This check is **disabled** in development mode (`NODE_ENV=development`) to make testing easier.

---

### 2. Duplicate Click Detection (24 hour window)

**What it detects:**
- Same IP clicking the same referral code multiple times

**How it works:**
- Tracks IP+Code combinations for 24 hours
- First click from IP: ✅ Award points
- Duplicate from same IP: ✅ Redirect, ❌ no points

**Redis key:** `fraud:CODE:IP_ADDRESS`

**Log message:**
```
⚠️  Duplicate click detected for code: ABC123 from IP: 203.0.113.42
```

---

### 3. Bot Detection

**What it detects:**
Automated requests from bots and scripts based on User-Agent headers.

**Blocked User-Agents:**
- `bot`, `crawler`, `spider`
- `curl`, `wget`, `python`
- `axios`, `node-fetch`
- `java` (not JavaScript)
- `go-http`

**How it works:**
- Checks User-Agent header against patterns
- If bot detected: ✅ Redirect, ❌ no points
- All activity logged

**Example:**
```bash
# Bot request
curl -A "Mozilla/5.0" http://localhost:5000/api/referral/ABC123
# → Redirects to YouTube, +1 point ✅

curl -A "python-requests/2.28.0" http://localhost:5000/api/referral/ABC123
# → Redirects to YouTube, no points ❌
```

**Log message:**
```
🚨 Suspicious user agent detected (will redirect without points): python-requests/2.28.0 from IP: 203.0.113.42
```

---

### 4. High Velocity Detection (Click Spam)

**What it detects:**
- More than 3 clicks per minute from the same IP (across all referral codes)

**How it works:**
- Tracks click velocity per IP with 1-minute sliding window
- 1-3 clicks/min: ✅ Normal behavior
- 4+ clicks/min: ✅ Redirect, ❌ no points

**Redis key:** `velocity:IP_ADDRESS`

**Example:**
```bash
# Rapid clicking
for i in {1..5}; do
  curl http://localhost:5000/api/referral/ABC123
done
# First 3: Redirect + points
# 4th+: Redirect, no points
```

**Log message:**
```
🚨 High velocity clicks detected (will redirect without points): IP 203.0.113.42 (5 clicks/min)
```

---

### 5. Mass Fraud Detection (Code Hopping)

**What it detects:**
- Same IP clicking more than 5 different referral codes within 1 hour

**How it works:**
- Tracks unique codes per IP per hour
- 1-5 codes: ✅ Legitimate
- 6+ codes: ✅ Redirect, ❌ no points (likely a fraud script)

**Redis key:** `ipclicks:IP_ADDRESS` (Set of codes)

**Example:**
```bash
# User clicks 6 different referral codes in 10 minutes
curl http://localhost:5000/api/referral/CODE1  # ✅ Points
curl http://localhost:5000/api/referral/CODE2  # ✅ Points
curl http://localhost:5000/api/referral/CODE3  # ✅ Points
curl http://localhost:5000/api/referral/CODE4  # ✅ Points
curl http://localhost:5000/api/referral/CODE5  # ✅ Points
curl http://localhost:5000/api/referral/CODE6  # ❌ No points (fraud suspected)
```

**Log message:**
```
🚨 Mass fraud detected (will redirect without points): IP 203.0.113.42 (6 codes clicked)
```

**Warning threshold:**
When an IP clicks 3+ different codes, a warning is logged:
```
⚠️  IP 203.0.113.42 has clicked 4 different referral codes in the last hour
```

---

## What Gets Logged

**All clicks are logged in the database** regardless of fraud status:

```sql
SELECT * FROM referral_clicks;
```

| id | user_id | ip_address | user_agent | clicked_at |
|----|---------|------------|------------|------------|
| 1  | 5       | 203.0.113.42 | Mozilla/5.0 | 2025-11-15 |
| 2  | 5       | 203.0.113.42 | curl/7.68.0 | 2025-11-15 |
| 3  | 7       | 198.51.100.1 | python-requests | 2025-11-15 |

This allows you to:
- Track engagement (who's getting clicks)
- Analyze fraud patterns
- Generate reports
- Detect abuse

---

## Setting the YouTube Video URL

### Option 1: Via Admin Dashboard (Recommended)

1. Log in as admin (admin@example.com / admin123)
2. Go to Admin Dashboard
3. Settings → Update Redirect URL
4. Enter: `https://www.youtube.com/watch?v=YOUR_VIDEO_ID`
5. Save

### Option 2: Via Database

```bash
docker exec -it doac-postgres psql -U doac_user -d referral_system

UPDATE settings
SET value = 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
    updated_at = NOW()
WHERE key = 'redirect_url';
```

### Option 3: Via Environment Variable (Default)

Edit `backend/.env`:
```bash
DEFAULT_REDIRECT_URL=https://www.youtube.com/watch?v=YOUR_VIDEO_ID
```

This is used when no value is set in the database.

---

## Testing Fraud Protection

### Test 1: Duplicate Clicks

```bash
CODE="ABC123"

# First click - should award points
curl -L http://localhost:5000/api/referral/$CODE

# Second click - should redirect but not award points
curl -L http://localhost:5000/api/referral/$CODE
```

### Test 2: Bot Detection

```bash
CODE="ABC123"

# Normal browser - should award points
curl -L -A "Mozilla/5.0 (Windows NT 10.0; Win64; x64)" \
  http://localhost:5000/api/referral/$CODE

# Bot - should redirect but not award points
curl -L -A "python-requests/2.28.0" \
  http://localhost:5000/api/referral/$CODE
```

### Test 3: High Velocity

```bash
CODE="ABC123"

# Rapid fire 10 clicks
for i in {1..10}; do
  curl -L http://localhost:5000/api/referral/$CODE
  echo "Click $i"
done

# First 3: Points awarded
# 4-10: Redirected but no points
```

### Test 4: Mass Fraud

```bash
# Create multiple users and get their codes
# Then click all codes rapidly from same IP

for code in CODE1 CODE2 CODE3 CODE4 CODE5 CODE6; do
  curl -L http://localhost:5000/api/referral/$code
done

# First 5: Points awarded
# 6th: Redirected but no points
```

---

## Monitoring Fraud Activity

### Check Redis for Fraud Tracking

```bash
# View all fraud detection keys
docker exec doac-redis redis-cli KEYS "*fraud*"

# View rate limit keys
docker exec doac-redis redis-cli KEYS "*rl:*"

# View velocity tracking
docker exec doac-redis redis-cli KEYS "*velocity*"

# View IP click tracking
docker exec doac-redis redis-cli KEYS "*ipclicks*"
```

### Check Database for Suspicious Patterns

```sql
-- Most clicks from single IP
SELECT ip_address, COUNT(*) as clicks
FROM referral_clicks
GROUP BY ip_address
ORDER BY clicks DESC
LIMIT 10;

-- Most suspicious user agents
SELECT user_agent, COUNT(*) as clicks
FROM referral_clicks
WHERE user_agent ILIKE '%bot%'
   OR user_agent ILIKE '%curl%'
   OR user_agent ILIKE '%python%'
GROUP BY user_agent
ORDER BY clicks DESC;

-- Clicks without points awarded (fraud blocked)
-- Compare total clicks vs points awarded
SELECT
  u.email,
  u.points,
  COUNT(rc.id) as total_clicks,
  u.points - COUNT(rc.id) as fraud_blocks
FROM users u
LEFT JOIN referral_clicks rc ON u.id = rc.user_id
GROUP BY u.id, u.email, u.points
HAVING u.points < COUNT(rc.id);
```

---

## Production Recommendations

### 1. Adjust Thresholds Based on Your Use Case

Edit `backend/src/middleware/rateLimiter.ts`:

```typescript
// More restrictive (if you have fraud problems)
max: 1,              // 1 click per hour (default)
windowMs: 3600000,   // 1 hour

// More permissive (if false positives)
max: 3,              // 3 clicks per hour
windowMs: 7200000,   // 2 hours
```

### 2. Enable Rate Limiting in Development

To test rate limits locally, change this:

```typescript
skip: (req: Request) => {
  // Skip rate limiting in development
  return process.env.NODE_ENV === 'development';  // Change to: return false;
},
```

### 3. Monitor Logs

Set up Cloud Logging alerts for:
- `🚨 Suspicious user agent detected`
- `🚨 High velocity clicks detected`
- `🚨 Mass fraud detected`

### 4. Adjust Bot Patterns

If you need to allow certain automation (e.g., Zapier webhooks):

```typescript
const botPatterns = [
  /bot/i,
  // /curl/i,  // Comment out to allow curl
  /python/i,
  // Add custom patterns:
  /my-spam-bot/i,
];
```

---

## Summary

**What happens when fraud is detected:**

| Scenario | Redirect? | Award Points? | Logged? |
|----------|-----------|---------------|---------|
| Legitimate first click | ✅ Yes | ✅ Yes | ✅ Yes |
| Duplicate click (24h) | ✅ Yes | ❌ No | ✅ Yes |
| Rate limit exceeded | ✅ Yes | ❌ No | ✅ Yes |
| Bot user agent | ✅ Yes | ❌ No | ✅ Yes |
| High velocity (spam) | ✅ Yes | ❌ No | ✅ Yes |
| Mass fraud (6+ codes) | ✅ Yes | ❌ No | ✅ Yes |

**Everyone sees your video. Only legitimate users earn points.**

This strikes the perfect balance between user experience and fraud prevention!
