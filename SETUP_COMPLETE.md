# ✅ Setup Complete!

Your referral system is now fully configured and running locally with complete fraud protection.

## What's Working

### 1. Application Running ✅
- **Frontend:** http://localhost:3000 (React dev server)
- **Backend:** http://localhost:5000 (Express API)
- **PostgreSQL:** localhost:5432 (Docker)
- **Redis:** localhost:6379 (Docker)

### 2. Fraud Protection ✅

**Philosophy: Everyone watches the video, only legitimate clicks earn points.**

All fraud scenarios now redirect to your YouTube video but don't award points:

| Scenario | Redirect to YouTube? | Award Points? | Logged? |
|----------|---------------------|---------------|---------|
| Legitimate click | ✅ Yes | ✅ Yes | ✅ Yes |
| Duplicate click (same IP) | ✅ Yes | ❌ No | ✅ Yes |
| Bot/script (curl, python, etc) | ✅ Yes | ❌ No | ✅ Yes |
| High velocity (spam clicking) | ✅ Yes | ❌ No | ✅ Yes |
| Mass fraud (6+ codes/hour) | ✅ Yes | ❌ No | ✅ Yes |
| Rate limit exceeded | ✅ Yes | ❌ No | ✅ Yes |

### 3. Security Features ✅

**Rate Limiting:**
- Auth endpoints: 5 attempts per 15 min
- General API: 100 requests per 15 min
- Referral clicks: 1 per IP per hour (disabled in dev mode)
- Admin endpoints: 200 requests per 15 min

**Fraud Detection:**
- Bot detection (curl, python, wget, etc.)
- Duplicate click tracking (24 hour window)
- High velocity detection (max 3 clicks/min)
- Mass fraud detection (max 5 codes/hour per IP)

**Real IP Tracking:**
- Trust proxy enabled
- Reads X-Forwarded-For headers
- Works with Firebase Hosting & Cloud Run
- All fraud checks use real client IPs

## Quick Commands

### Start Development
```bash
# 1. Start databases
docker-compose up -d

# 2. Start app
npm run dev
```

### Stop Development
```bash
# Ctrl+C to stop app

# Stop databases
docker-compose down
```

### Set YouTube Video URL

**Option 1: Database (Recommended)**
```bash
docker exec -it doac-postgres psql -U doac_user -d referral_system

UPDATE settings
SET value = 'https://www.youtube.com/watch?v=dQw4w9WgXcQ'
WHERE key = 'redirect_url';

# Clear Redis cache
\q
docker exec doac-redis redis-cli DEL "setting:redirect_url"
```

**Option 2: Admin Dashboard**
1. Login as admin@example.com / admin123
2. Go to Settings
3. Update Redirect URL

### Test Your Setup

**Test 1: Normal Click (Should Award Points)**
```bash
CODE="7TW5XFFv6y"  # Your referral code

curl -L http://localhost:5000/api/referral/$CODE \
  -H "User-Agent: Mozilla/5.0"
```

**Test 2: Bot Detection (Should Redirect, No Points)**
```bash
curl -L http://localhost:5000/api/referral/$CODE \
  -H "User-Agent: python-requests/2.28.0"
```

**Test 3: Duplicate Click (Should Redirect, No Points)**
```bash
# Click twice from same IP
curl -L http://localhost:5000/api/referral/$CODE
curl -L http://localhost:5000/api/referral/$CODE
```

### Check Points
```bash
docker exec doac-postgres psql -U doac_user -d referral_system -c \
  "SELECT email, points FROM users WHERE email = 'admin@example.com'"
```

### View Fraud Logs
```bash
# Check Redis for fraud tracking
docker exec doac-redis redis-cli KEYS "*fraud*"

# Check database for clicks
docker exec doac-postgres psql -U doac_user -d referral_system -c \
  "SELECT ip_address, user_agent, COUNT(*) FROM referral_clicks GROUP BY ip_address, user_agent"
```

## Files Created

1. **[docker-compose.yml](docker-compose.yml)** - PostgreSQL + Redis containers
2. **[backend/.env](backend/.env)** - Backend configuration
3. **[frontend/.env](frontend/.env)** - Frontend configuration
4. **[LOCAL_DEVELOPMENT.md](LOCAL_DEVELOPMENT.md)** - Complete dev guide
5. **[QUICK_REFERENCE.md](QUICK_REFERENCE.md)** - Quick commands
6. **[FRAUD_PROTECTION.md](FRAUD_PROTECTION.md)** - Detailed fraud protection docs

## Files Modified

1. **[backend/src/middleware/rateLimiter.ts](backend/src/middleware/rateLimiter.ts)**
   - Fixed Redis compatibility issue
   - Changed fraud detection to redirect instead of blocking
   - All fraud scenarios now redirect to video without points

## Database

**Admin Account:**
- Email: admin@example.com
- Password: admin123
- **Change this password immediately!**

**Connection Details:**
- Host: localhost
- Port: 5432
- Database: referral_system
- Username: doac_user
- Password: doac_password

## Next Steps

### 1. Change Admin Password
```bash
docker exec -it doac-postgres psql -U doac_user -d referral_system

UPDATE users
SET password_hash = crypt('YOUR_NEW_SECURE_PASSWORD', gen_salt('bf', 10))
WHERE email = 'admin@example.com';
```

### 2. Set Your YouTube Video URL
Replace `YOUR_VIDEO_ID` with your actual video ID from the database command above.

### 3. Test the Application
1. Open http://localhost:3000
2. Register a new account
3. Get your referral link
4. Open in incognito - you should be redirected to YouTube
5. Check points increased
6. Try clicking again - should redirect but no more points

### 4. Deploy to Production
See [QUICK_START.md](QUICK_START.md) for one-command GCP deployment.

## Fraud Protection in Action

### Example 1: Bot Attempt
```
Request: curl http://localhost:5000/api/referral/ABC123
User-Agent: python-requests/2.28.0
IP: 203.0.113.42

Result:
- ✅ Redirected to YouTube
- ❌ No points awarded
- ✅ Click logged in database
- 🚨 Log: "Suspicious user agent detected (will redirect without points)"
```

### Example 2: Duplicate Click
```
Request #1: http://localhost:5000/api/referral/ABC123
IP: 198.51.100.1

Result:
- ✅ Redirected to YouTube
- ✅ Points awarded (+1)

Request #2: Same IP, same code (within 24 hours)
Result:
- ✅ Redirected to YouTube
- ❌ No points awarded
- ⚠️  Log: "Duplicate click detected"
```

### Example 3: Spam Clicking
```
Requests: 10 clicks in 30 seconds from same IP

Results:
- Clicks 1-3: ✅ Points awarded
- Clicks 4-10: ✅ Redirect, ❌ No points
- 🚨 Log: "High velocity clicks detected"
```

## Monitoring

**View All Clicks:**
```sql
SELECT
  u.email,
  COUNT(rc.id) as total_clicks,
  u.points,
  COUNT(rc.id) - u.points as fraud_blocked
FROM users u
LEFT JOIN referral_clicks rc ON u.id = rc.user_id
GROUP BY u.id, u.email, u.points;
```

**Suspicious IPs:**
```sql
SELECT ip_address, user_agent, COUNT(*) as clicks
FROM referral_clicks
WHERE user_agent LIKE '%bot%'
   OR user_agent LIKE '%curl%'
   OR user_agent LIKE '%python%'
GROUP BY ip_address, user_agent
ORDER BY clicks DESC;
```

## Support

**Documentation:**
- [LOCAL_DEVELOPMENT.md](LOCAL_DEVELOPMENT.md) - Full dev setup guide
- [FRAUD_PROTECTION.md](FRAUD_PROTECTION.md) - Fraud system details
- [QUICK_REFERENCE.md](QUICK_REFERENCE.md) - Quick commands
- [QUICK_START.md](QUICK_START.md) - GCP deployment
- [README.md](README.md) - Project overview

**Need Help?**
1. Check logs: Look at terminal where `npm run dev` is running
2. Check database: `docker exec -it doac-postgres psql -U doac_user -d referral_system`
3. Check Redis: `docker exec doac-redis redis-cli`
4. Restart: `docker-compose restart`

## Summary

🎉 **Your referral system is ready!**

✅ Local development environment running
✅ Fraud protection active (redirects to YouTube, blocks points)
✅ Real IP tracking enabled
✅ Rate limiting configured
✅ All clicks logged for monitoring
✅ Ready to test and build

**Happy coding!**
