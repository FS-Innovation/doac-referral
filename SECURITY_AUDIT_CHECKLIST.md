# Security Audit: Critical Requirements Checklist

**Date:** 2025-11-16
**Status:** Pre-Production Security Review
**Question:** Are all Priority 1-4 security requirements complete, or will they be complete when hosted on Google Cloud?

---

## Executive Summary

✅ **Most Critical Items: COMPLETE**
⚠️ **Some Items: PARTIALLY COMPLETE**
❌ **Some Items: MISSING (Need Implementation)**

**Verdict:** Your system is **NOT ready for public deployment** yet. Several critical security measures are missing, and **cloud hosting alone will NOT fix these issues**. You need to implement the missing items below regardless of hosting platform.

---

## Priority 1: Rate Limiting ⚠️ PARTIALLY COMPLETE

**Status: 70% Complete** - Good foundation, but missing critical pieces

### ✅ What's Working

1. **IP-based rate limiting implemented** ([index.ts:11](backend/src/index.ts#L11), [rateLimiter.ts:7-18](backend/src/middleware/rateLimiter.ts#L7-L18))
   - General API: 100 requests/15 min per IP ✅
   - Auth endpoints: 5 attempts/15 min per IP ✅
   - Referral clicks: 1 click/hour per IP ✅
   - Admin endpoints: 200 requests/15 min ✅

2. **Redis-backed rate limiting** ✅
   - Using `express-rate-limit` + `rate-limit-redis`
   - Distributed rate limiting ready for horizontal scaling

3. **Trust proxy configured** ([index.ts:19](backend/src/index.ts#L19)) ✅
   - Reads real IPs from X-Forwarded-For headers
   - Essential for Cloud Run/Firebase Hosting

### ❌ What's MISSING (Critical!)

1. **❌ Account-based rate limiting: Maximum 50 referral claims per day per user**
   - Current issue: Users can claim unlimited referrals per day
   - Attack: Register 1 account, claim 1000 referrals in 1 day = 1000 points
   - **FIX REQUIRED:** Add user_id rate limiting in referral controller

2. **❌ Block repeated requests within 5-second windows**
   - Current: Referral limiter is 1 hour window (too long)
   - Attack: Submit 10 requests in 1 second → race condition → duplicate points
   - **FIX REQUIRED:** Add 5-second sliding window check

### Implementation Status

| Requirement | Status | Implementation |
|------------|--------|----------------|
| IP rate limiting (10 req/min) | ✅ Complete | 100 req/15min (more lenient) |
| Account rate limiting (50/day) | ❌ MISSING | Not implemented |
| 5-second window blocking | ❌ MISSING | Using 1-hour window instead |
| Redis-backed | ✅ Complete | Using rate-limit-redis |

**Priority 1 Score: 50% COMPLETE** ⚠️

---

## Priority 2: Input Validation ⚠️ PARTIALLY COMPLETE

**Status: 60% Complete** - Basic validation exists, but critical checks missing

### ✅ What's Working

1. **Server-side validation** ([authController.ts:12-19](backend/src/controllers/authController.ts#L12-L19))
   - Email/password required ✅
   - Password length minimum (6 chars) ✅
   - Input sanitization via parameterized queries ✅

2. **Referral code validation** ([referralController.ts:20-27](backend/src/controllers/referralController.ts#L20-L27))
   - Verifies code exists before processing ✅
   - Returns 404 for invalid codes ✅

3. **SQL injection prevention** ✅
   - All queries use parameterized statements (`$1`, `$2`)
   - Using `pg` library with proper escaping

### ❌ What's MISSING (Critical!)

1. **❌ Block disposable email domains**
   - Current: Anyone can use `tempmail.com`, `guerrillamail.com`, etc.
   - Attack: Create 1000 accounts with throwaway emails
   - **FIX REQUIRED:** Add disposable email blocklist

2. **❌ Prevent self-referrals**
   - Current: No check for referee_id ≠ referrer_id
   - Attack: Click your own referral link → infinite points
   - **FIX REQUIRED:** Add self-referral prevention in controller

3. **❌ Email format validation**
   - Current: No regex validation for email format
   - Issue: Invalid emails accepted (e.g., "notanemail")
   - **FIX REQUIRED:** Use `express-validator` (already installed!)

4. **❌ Rate limit on registration**
   - Current: Can create unlimited accounts from same IP
   - Attack: Script creates 10,000 accounts → spamming
   - **FIX REQUIRED:** Add registration rate limiter (5/hour per IP)

### Implementation Status

| Requirement | Status | Implementation |
|------------|--------|----------------|
| Server-side validation | ✅ Complete | Basic checks in place |
| Sanitize inputs | ✅ Complete | Parameterized queries |
| Block disposable emails | ❌ MISSING | Not implemented |
| Verify referral codes | ✅ Complete | Database lookup |
| Prevent self-referrals | ❌ MISSING | **CRITICAL - Not checked!** |
| Email format validation | ⚠️ Partial | Basic check, no regex |

**Priority 2 Score: 60% COMPLETE** ⚠️

---

## Priority 3: Database Constraints ❌ MOSTLY MISSING

**Status: 30% Complete** - Critical constraints missing!

### ✅ What's Working

1. **Indexes on key fields** ✅
   - `users.referral_code` has index: `idx_users_referral_code`
   - `referral_clicks.user_id` has index: `idx_referral_clicks_user_id`

2. **Unique constraints** ✅
   - `users.email` - Unique constraint ✅
   - `users.referral_code` - Unique constraint ✅

3. **Foreign key constraints** ✅
   - `referral_clicks.user_id` → `users.id` with CASCADE delete ✅
   - `purchases.user_id` → `users.id` with CASCADE delete ✅

4. **Transaction locking** ([referralController.ts:42-46](backend/src/controllers/referralController.ts#L42-L46)) ✅
   - Using `BEGIN` → `COMMIT` for atomic operations
   - Prevents race conditions during points award

### ❌ What's MISSING (Critical!)

1. **❌ UNIQUE constraint on (referrer_id, referee_id) - CRITICAL!**
   - **Current table:** `referral_clicks` has NO referee tracking!
   - **Issue:** Same person can click same link 1000 times (only IP blocking prevents this)
   - **Problem:** Your fraud detection is in APPLICATION LAYER, not DATABASE LAYER
   - **Attack scenario:**
     ```
     1. User clicks referral link → IP 1.2.3.4 blocked
     2. User switches IP → clicks again → NEW IP, gets points!
     3. Repeat 100 times with VPN rotation → 100 points
     ```
   - **FIX REQUIRED:** Add `referrals` table to track unique (referrer, referee) pairs

2. **❌ CHECK constraint to prevent self-referrals**
   - No database-level prevention
   - Relies on application logic (which doesn't exist yet!)
   - **FIX REQUIRED:** Add `CHECK (referrer_id != referee_id)` when referrals table created

3. **❌ Missing `referrals` table entirely!**
   - Current design: `referral_clicks` only tracks clicks (IP, user_agent)
   - Missing: Who referred whom? (referee_id missing!)
   - **This is a fundamental architectural problem!**

### What Your Database Should Look Like

**Current (Wrong):**
```sql
referral_clicks:
  - id
  - user_id (who OWNS the referral code)
  - ip_address
  - user_agent
  - clicked_at
```

**Should Be (Correct):**
```sql
referrals:
  - id
  - referrer_id (who sent the link)
  - referee_id (who clicked the link) ← MISSING!
  - created_at
  - UNIQUE (referrer_id, referee_id) ← CRITICAL!
  - CHECK (referrer_id != referee_id) ← CRITICAL!

referral_clicks:
  - id
  - user_id
  - ip_address
  - user_agent
  - clicked_at
  - referral_id (foreign key)
```

### Implementation Status

| Requirement | Status | Implementation |
|------------|--------|----------------|
| UNIQUE (referrer_id, referee_id) | ❌ MISSING | **Table doesn't exist!** |
| CHECK (referrer_id != referee_id) | ❌ MISSING | **No constraint** |
| Index on referrer_id | ✅ Complete | Has index |
| Index on created_at | ⚠️ Partial | clicked_at indexed |
| Transaction locks | ✅ Complete | Using BEGIN/COMMIT |

**Priority 3 Score: 30% COMPLETE** ❌

---

## Priority 4: Infrastructure Hardening ⚠️ PARTIALLY COMPLETE

**Status: 40% Complete** - Cloud hosting will help, but NOT complete the solution

### ✅ What's Working

1. **Connection pooling** ([database.ts](backend/src/config/database.ts))
   - Using `pg.Pool` for connection management ✅
   - Configurable max connections ✅

2. **Health checks** ([index.ts:48-55](backend/src/index.ts#L48-L55))
   - `/health` endpoint for monitoring ✅
   - Returns status, environment, timestamp ✅

3. **Compression middleware** ([index.ts:28](backend/src/index.ts#L28)) ✅
   - Reduces bandwidth usage

4. **Security headers** ([index.ts:22-25](backend/src/index.ts#L22-L25))
   - Using `helmet` for security headers ✅
   - CSP and COEP configured for Firebase Hosting ✅

### ⚠️ What Google Cloud Will Provide

When you deploy to **Cloud Run** or **Firebase**, you'll get:

1. ✅ **Auto-scaling** - Cloud Run scales 0 → 1000 instances automatically
2. ✅ **Load balancing** - Built-in L7 load balancer
3. ✅ **Health checks** - Cloud Run monitors `/health` endpoint
4. ✅ **Automatic restarts** - Failed containers restart automatically
5. ✅ **Request queuing** - Cloud Run queues requests during scale-up
6. ✅ **Circuit breakers** - Cloud Run stops sending traffic to failing instances

**These are NOT in your code - they're platform features!**

### ❌ What's STILL MISSING (Must implement yourself!)

1. **❌ Asynchronous processing for referral claims**
   - Current: Synchronous processing blocks HTTP thread
   - Problem: 1000 concurrent requests → database overwhelmed
   - **Cloud Run won't fix this!** Each instance still processes synchronously
   - **FIX REQUIRED:** Use Redis queue (Bull/BullMQ) or Cloud Tasks

2. **❌ Request queuing system**
   - Cloud Run has basic queuing, but you need application-level queuing
   - **FIX REQUIRED:** Implement job queue for referrals

3. **❌ Max connection limits**
   - Current: `pg.Pool` has no explicit max connections set
   - Cloud Run default: 80 concurrent requests per instance
   - PostgreSQL max connections: Usually 100 (shared across ALL instances!)
   - **Problem:** 10 Cloud Run instances × 100 connections = 1000 connections needed (PostgreSQL crashes!)
   - **FIX REQUIRED:** Set `max: 10` in pg.Pool config

4. **❌ Connection timeout handling**
   - No timeout configured for database connections
   - **FIX REQUIRED:** Add `connectionTimeoutMillis: 5000`

### Implementation Status

| Requirement | Status | Implementation |
|------------|--------|----------------|
| Connection pooling | ✅ Complete | Using pg.Pool |
| Max connection limits | ❌ MISSING | No max set |
| Request queuing | ⚠️ Platform | Cloud Run provides basic |
| Asynchronous processing | ❌ MISSING | Synchronous only |
| Circuit breakers | ⚠️ Platform | Cloud Run provides |
| Health checks | ✅ Complete | /health endpoint |
| Auto restart | ⚠️ Platform | Cloud Run provides |
| Load balancing | ⚠️ Platform | Cloud Run provides |

**Priority 4 Score: 40% COMPLETE** ⚠️
**(60% from Cloud Run, but 40% still YOUR responsibility)**

---

## Overall Security Score

| Priority | Requirement | Status | Score | Notes |
|----------|------------|--------|-------|-------|
| 1 | Rate Limiting | ⚠️ Partial | 50% | Missing account limits & 5s window |
| 2 | Input Validation | ⚠️ Partial | 60% | Missing self-referral check! |
| 3 | Database Constraints | ❌ Poor | 30% | **Missing referrals table!** |
| 4 | Infrastructure | ⚠️ Partial | 40% | Cloud helps, but async missing |

**Overall: 45% COMPLETE** ❌

---

## Critical Issues That Must Be Fixed BEFORE Production

### 🚨 BLOCKER #1: Missing Self-Referral Prevention

**Severity:** CRITICAL
**Impact:** Users can give themselves unlimited points
**Attack:**
```bash
# User registers
POST /api/auth/register → Gets referral code ABC123

# User clicks own link
GET /api/referral/ABC123 → +1 point

# Repeat forever → Infinite points
```

**Fix Required:** Add check in `referralController.ts`:
```typescript
// Check if user is clicking their own link
const clickerUserId = req.user?.id; // From auth middleware
if (clickerUserId && clickerUserId === userId) {
  return res.status(403).json({ error: 'Cannot use your own referral code' });
}
```

**Problem:** Your current system allows UNAUTHENTICATED clicks! Anyone can click a referral link without logging in. This means:
- You can't track "who" clicked (only IP addresses)
- Self-referral prevention is impossible without authentication
- **You need to redesign the referral flow!**

---

### 🚨 BLOCKER #2: Missing `referrals` Table

**Severity:** CRITICAL
**Impact:** No unique constraint on referrer/referee pairs
**Attack:**
```bash
# User1 refers User2
GET /api/referral/ABC123 from User2 → +1 point

# User2 deletes account and re-registers
POST /api/auth/register (same email)

# User2 clicks User1's link again
GET /api/referral/ABC123 → +1 point AGAIN!

# Repeat 100 times → 100 points from same person
```

**Fix Required:** Create `referrals` table:
```sql
CREATE TABLE referrals (
  id SERIAL PRIMARY KEY,
  referrer_id INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  referee_id INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(referrer_id, referee_id),
  CHECK (referrer_id != referee_id)
);
```

**This requires architectural changes to your entire referral system!**

---

### 🚨 BLOCKER #3: No Account-Based Rate Limiting

**Severity:** HIGH
**Impact:** Users can claim unlimited referrals per day
**Attack:**
```bash
# User claims 1000 referrals in 1 day
for i in {1..1000}; do
  curl http://yoursite.com/api/referral/$CODE
done

# Result: 1000 points in 1 day (unrealistic for legitimate use)
```

**Fix Required:** Add user_id rate limiting:
```typescript
// In referralController.ts
const dailyClaimsKey = `daily_claims:${userId}`;
const dailyCount = await redisClient.incr(dailyClaimsKey);

if (dailyCount === 1) {
  await redisClient.expire(dailyClaimsKey, 86400); // 24 hours
}

if (dailyCount > 50) {
  return res.status(429).json({ error: 'Daily referral limit exceeded' });
}
```

---

### 🚨 BLOCKER #4: Race Condition on Referral Claims

**Severity:** HIGH
**Impact:** Same user can get duplicate points in race condition
**Attack:**
```bash
# Send 10 simultaneous requests (within 5 seconds)
for i in {1..10}; do
  curl http://yoursite.com/api/referral/ABC123 &
done

# All 10 requests hit before Redis cache updates
# Result: +10 points instead of +1
```

**Fix Required:** Add distributed lock:
```typescript
const lockKey = `lock:referral:${code}:${ipAddress}`;
const acquired = await redisClient.set(lockKey, '1', 'EX', 5, 'NX');

if (!acquired) {
  return res.status(429).json({ error: 'Please wait before trying again' });
}
```

---

### 🚨 BLOCKER #5: PostgreSQL Connection Pool Not Configured

**Severity:** MEDIUM (becomes HIGH under load)
**Impact:** Database runs out of connections
**Problem:**
- Cloud Run can spawn 100 instances
- Each instance creates unlimited connections
- PostgreSQL max connections: 100
- **100 instances × unlimited connections = CRASH!**

**Fix Required:** Update `backend/src/config/database.ts`:
```typescript
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  max: 10, // ← ADD THIS!
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 5000,
});
```

---

## What Google Cloud WILL Fix

✅ **Cloud Run/Firebase Hosting provides:**
1. Auto-scaling (0 → 1000 instances)
2. Load balancing (L7 HTTPS load balancer)
3. Health checks (monitors `/health`)
4. Auto restarts (failed containers restart)
5. Request queuing (basic queuing during scale-up)
6. Circuit breakers (stops traffic to failing instances)
7. DDoS protection (Google Cloud Armor)
8. SSL/TLS (automatic HTTPS certificates)

---

## What Google Cloud WILL NOT Fix

❌ **You must implement yourself:**
1. Self-referral prevention ← **Your application logic**
2. `referrals` table with unique constraints ← **Your database design**
3. Account-based rate limiting ← **Your application logic**
4. Disposable email blocking ← **Your application logic**
5. Race condition handling ← **Your application logic**
6. Asynchronous job processing ← **Your architecture**
7. Database connection pool limits ← **Your configuration**
8. 5-second duplicate request blocking ← **Your application logic**

**Cloud hosting is NOT a silver bullet!** It provides infrastructure scaling, but does NOT fix application-level security vulnerabilities.

---

## Recommendation: DO NOT DEPLOY YET

**Status: NOT PRODUCTION READY** ❌

### Must Fix Before ANY Public Access:

1. **Implement self-referral prevention** (2-4 hours)
2. **Create `referrals` table with unique constraints** (4-8 hours) - **Architectural change required!**
3. **Add account-based rate limiting** (2-3 hours)
4. **Fix PostgreSQL connection pool** (15 minutes)
5. **Add 5-second duplicate blocking** (1-2 hours)
6. **Block disposable emails** (1-2 hours)

**Estimated time to production-ready: 12-20 hours of development**

### What You Can Deploy to Cloud Now:

You can deploy the current system to Google Cloud for **internal testing only**. Cloud Run will handle scaling and infrastructure, but the application vulnerabilities remain.

**Do NOT share publicly until the above fixes are complete!**

---

## Next Steps

1. **Fix Blockers #1-#5** (in order of severity)
2. **Redesign referral flow** to require authentication
3. **Create `referrals` table** and migrate data model
4. **Test with production-like load** (use `locust` or `k6`)
5. **Security audit** by third party
6. **Then deploy to Cloud Run**

Would you like me to implement these critical fixes for you?
