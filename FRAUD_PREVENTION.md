# Referral Fraud Prevention System

## Overview

This document describes the industry-standard fraud prevention system implemented for the referral rewards program. The system is designed to **maximize legitimate user success** while preventing fraud through multi-layered detection.

## Design Principles

### 1. **Legitimate Users First** ✅
- **No IP-only blocking** - Multiple users on same WiFi can all get points
- **VPN-friendly** - Changing IP addresses doesn't trigger false positives
- **Multi-factor matching** - Requires multiple signals before blocking
- **90-day fingerprint expiry** - Allows legitimate device changes over time

### 2. **Defense in Depth** 🛡️
- **3-layer fingerprinting** - Device ID, Device Fingerprint, Browser Fingerprint
- **Database persistence** - Fingerprints stored permanently (not just 24h)
- **Pattern-based detection** - Behavioral analysis, not rigid rules
- **Full forensic logging** - Every click tracked for analysis

---

## Fraud Detection Layers

### Layer 1: Device ID Detection (Strongest)
**Technology**: UUID v4 stored in localStorage
**Persistence**: Until localStorage cleared
**Rule**: One click per device ID per code per 24 hours
**Bypass Difficulty**: Hard (requires clearing localStorage)

```typescript
// Example: Device ID
const deviceId = "550e8400-e29b-41d4-a716-446655440000"
```

### Layer 2: Device Fingerprint (Hardware-Based)
**Technology**: SHA-256 hash of hardware characteristics
**Components**:
- GPU vendor & model (NVIDIA GeForce RTX 3080, Apple M1, etc.)
- CPU cores & RAM
- Screen resolution, color depth, pixel ratio
- WebGL capabilities
- Touch support
- Media devices (cameras, microphones)

**Persistence**: Until hardware changes
**Rule**: One click per device fingerprint per code per 24 hours
**Bypass Difficulty**: Very Hard (requires different device)

```typescript
// Example components:
GPU: "Apple Inc." + "Apple M1"
CPU: 8 cores, 16GB RAM
Screen: 2560x1440, 32-bit color, 2x pixel ratio
→ Hash: "a3f7c8d2e1b4..."
```

### Layer 3: Browser Fingerprint (Software-Based)
**Technology**: SHA-256 hash of browser/software characteristics
**Components**:
- Canvas rendering (text rendering differences)
- Audio context fingerprint
- Installed fonts (61 fonts tested)
- User agent, language, timezone
- Storage capabilities
- Network connection info

**Persistence**: Until browser/OS update
**Rule**: One click per browser fingerprint per code per 24 hours
**Bypass Difficulty**: Medium (requires different browser or major update)

```typescript
// Example components:
Canvas: Base64 of rendered emoji
Audio: Waveform signature
Fonts: ["Arial", "Helvetica", "Times New Roman", ...]
→ Hash: "b4e8f1c2a3d5..."
```

---

## Self-Click Prevention

### Algorithm: Score-Based Multi-Factor Matching

**Scoring System**:
- Device ID match: **+10 points**
- Device Fingerprint match: **+5 points**
- Browser Fingerprint match: **+3 points**

**Threshold**: Score ≥ 8 = Block points

**Examples**:

| Scenario | Device ID | Device FP | Browser FP | Score | Result |
|----------|-----------|-----------|------------|-------|--------|
| Same device, same browser | ✅ Match | ✅ Match | ✅ Match | 18 | ❌ **BLOCKED** |
| Same device, different browser | ✅ Match | ✅ Match | ❌ Diff | 15 | ❌ **BLOCKED** |
| Same device, cleared localStorage | ❌ Diff | ✅ Match | ✅ Match | 8 | ❌ **BLOCKED** |
| Different device (VPN) | ❌ Diff | ❌ Diff | ❌ Diff | 0 | ✅ **ALLOWED** |
| Friend on same WiFi | ❌ Diff | ❌ Diff | ❌ Diff | 0 | ✅ **ALLOWED** |

**Key Features**:
- ✅ **No IP requirement** - VPN/proxy doesn't bypass detection
- ✅ **Redis + Database** - Checks both 24h cache AND 90-day history
- ✅ **Survives Redis expiry** - Persistent in PostgreSQL

**Code Location**: [referralController.ts:42-131](backend/src/controllers/referralController.ts#L42-L131)

---

## Duplicate Click Prevention (24-Hour Window)

Each fingerprint type has a **24-hour cooldown** per referral code:

| Fingerprint Type | Key Format | Example |
|------------------|------------|---------|
| Device ID | `fraud:{code}:deviceid:{deviceId}` | `fraud:abc123:deviceid:550e8400...` |
| Device FP | `fraud:{code}:devicefp:{fingerprint}` | `fraud:abc123:devicefp:a3f7c8d2...` |
| Browser FP | `fraud:{code}:fp:{fingerprint}` | `fraud:abc123:fp:b4e8f1c2...` |

**Storage**: Redis (24h TTL)
**Bypass**: Wait 24 hours OR use different device

**Code Location**: [rateLimiter.ts:129-182](backend/src/middleware/rateLimiter.ts#L129-L182)

---

## Pattern-Based Detection

### Bot Detection
**Blocked User Agents**:
- `bot`, `crawl`, `spider`, `slurp`
- `curl`, `wget`, `python-requests`
- `go-http`, `node-fetch`

**Note**: Normal browsers (Chrome, Firefox, Safari) are allowed

**Code Location**: [rateLimiter.ts:184-203](backend/src/middleware/rateLimiter.ts#L184-L203)

---

### High Velocity Detection
**Rule**: >5 clicks per minute from same IP = Suspicious
**Note**: This is **NOT standalone** - IP is just one signal

**Rationale**: Legitimate users don't click 6+ referral links in 60 seconds

**Code Location**: [rateLimiter.ts:205-220](backend/src/middleware/rateLimiter.ts#L205-L220)

---

### Mass Fraud Detection
**Rule**: Same IP clicking >10 different referral codes in 1 hour = Fraud pattern
**Note**: This is **pattern analysis**, not IP blocking

**Examples**:
- ✅ **Allowed**: 5 family members on WiFi each click 1-2 codes (total 10)
- ❌ **Blocked**: One person clicking 15 different codes rapidly

**Code Location**: [rateLimiter.ts:226-244](backend/src/middleware/rateLimiter.ts#L226-L244)

---

## Database Schema

### `user_fingerprints` Table
```sql
CREATE TABLE user_fingerprints (
  id SERIAL PRIMARY KEY,
  user_id INTEGER REFERENCES users(id),
  device_id VARCHAR(255),
  device_fingerprint VARCHAR(255),
  browser_fingerprint VARCHAR(255),
  ip_address VARCHAR(45),
  first_seen TIMESTAMP,
  last_seen TIMESTAMP,
  created_at TIMESTAMP,
  updated_at TIMESTAMP,
  CONSTRAINT user_fingerprints_user_id_device_id_key UNIQUE (user_id, device_id)
);
```

**Purpose**: Track all devices a user has used for self-click prevention
**Expiry**: 90 days after `last_seen`
**Updates**: `last_seen` updated on every login

---

### `referral_clicks` Table
```sql
CREATE TABLE referral_clicks (
  id SERIAL PRIMARY KEY,
  user_id INTEGER REFERENCES users(id),
  ip_address VARCHAR(45),
  user_agent TEXT,
  device_id VARCHAR(255),              -- NEW
  device_fingerprint VARCHAR(255),     -- NEW
  browser_fingerprint VARCHAR(255),    -- NEW
  fraud_flags TEXT[],                  -- NEW: e.g., ["duplicate_device_id_24h", "high_velocity"]
  points_awarded BOOLEAN DEFAULT TRUE, -- NEW: False if fraud detected
  clicked_at TIMESTAMP
);
```

**Purpose**: Full forensic logging of every referral click
**Fraud Flags**: Comma-separated list of detection reasons

---

## Fingerprint Lifecycle

### Storage on Login/Registration
```typescript
// 1. Store in Redis (24h cache for fast lookup)
await redisClient.setex(`user:${userId}:deviceid`, 86400, deviceId);

// 2. Store in Database (90-day persistence)
await pool.query(`
  INSERT INTO user_fingerprints (user_id, device_id, ...)
  VALUES ($1, $2, ...)
  ON CONFLICT (user_id, device_id) DO UPDATE SET
    last_seen = CURRENT_TIMESTAMP
`);
```

### Expiry Policy
- **Redis Cache**: 24 hours (automatic)
- **Database**: 90 days since `last_seen` (manual cleanup)

### Cleanup
```bash
# Manual cleanup
npm run cleanup:fingerprints

# Cron job (runs daily at 3 AM)
# Removes fingerprints with last_seen > 90 days ago
```

**Code Location**: [fingerprintCleanup.ts](backend/src/utils/fingerprintCleanup.ts)

---

## Points Award Logic

### Points ARE Awarded ✅ When:
1. ✅ Device ID not seen for this code in 24h
2. ✅ Device fingerprint not seen for this code in 24h
3. ✅ Browser fingerprint not seen for this code in 24h
4. ✅ Not a bot user agent
5. ✅ Not high velocity (<5 clicks/min from IP)
6. ✅ Not mass fraud pattern (<10 codes from IP in 1h)
7. ✅ Self-click score < 8 (not owner's device)

### Points NOT Awarded ❌ When:
**Any ONE of these triggers**:
1. ❌ Same device ID clicked within 24h
2. ❌ Same device fingerprint clicked within 24h
3. ❌ Same browser fingerprint clicked within 24h
4. ❌ Bot user agent detected
5. ❌ High velocity (>5 clicks/min)
6. ❌ Mass fraud (>10 codes in 1h)
7. ❌ Self-click detected (score ≥ 8)

**Note**: User **always** gets redirected to video, even if points not awarded

**Code Location**: [referralController.ts:136-173](backend/src/controllers/referralController.ts#L136-L173)

---

## Migration Guide

### For Existing Databases

Run the migration script:
```bash
psql -U your_user -d your_db -f backend/src/database/migrations/001_add_fingerprint_tables.sql
```

**What it does**:
1. Adds columns to `referral_clicks`: `device_id`, `device_fingerprint`, `browser_fingerprint`, `fraud_flags`, `points_awarded`
2. Creates `user_fingerprints` table
3. Creates indexes for performance

**Rollback**: None needed (additive changes only)

---

## Monitoring & Analytics

### View Fingerprint Stats
```bash
npm run cleanup:fingerprints -- --stats
```

**Output**:
```
Total Fingerprints: 1,523
Unique Users: 487
Active (7 days): 234
Active (30 days): 412
Expired (>90 days): 15
```

### Find Suspicious Users
```bash
npm run cleanup:fingerprints -- --suspicious
```

**Shows**: Users with 5+ different devices (potential fraud)

### SQL Queries

**Find users clicking their own links**:
```sql
SELECT user_id, COUNT(*) as self_clicks
FROM referral_clicks
WHERE fraud_flags && ARRAY['self_click%']
GROUP BY user_id
ORDER BY self_clicks DESC;
```

**Find most common fraud types**:
```sql
SELECT unnest(fraud_flags) as fraud_type, COUNT(*) as occurrences
FROM referral_clicks
WHERE fraud_flags IS NOT NULL
GROUP BY fraud_type
ORDER BY occurrences DESC;
```

**Device sharing analysis**:
```sql
SELECT device_id, COUNT(DISTINCT user_id) as users_sharing
FROM user_fingerprints
WHERE device_id IS NOT NULL
GROUP BY device_id
HAVING COUNT(DISTINCT user_id) > 1;
```

---

## Security Vulnerabilities Fixed

| Issue | Before | After | Status |
|-------|--------|-------|--------|
| Self-click after 24h | ❌ Fingerprints expire from Redis | ✅ Persistent in database (90 days) | ✅ **FIXED** |
| VPN bypass | ❌ Required IP + fingerprint match | ✅ Fingerprint-only matching | ✅ **FIXED** |
| No forensic data | ❌ Only IP + user agent logged | ✅ Full fingerprint logging | ✅ **FIXED** |
| IP-only blocking | ❌ Blocked shared WiFi users | ✅ Multi-factor matching only | ✅ **FIXED** |
| Fingerprint changes | ❌ No history tracking | ✅ 90-day rolling window | ✅ **FIXED** |

---

## Testing Scenarios

### Legitimate Use Cases (Should Award Points)
1. ✅ Friend on same WiFi clicks different referral link
2. ✅ User with VPN clicks legitimate referral link
3. ✅ User clicks link from mobile, then desktop (different devices)
4. ✅ User clicks after 24 hours on same device (cooldown expired)
5. ✅ User upgrades browser/OS (fingerprint changed slightly)

### Fraud Attempts (Should Block Points)
1. ❌ User clicks own link
2. ❌ User clicks own link from VPN (different IP)
3. ❌ User waits 25 hours and clicks own link again (still in 90-day window)
4. ❌ User clears localStorage and clicks again (device fingerprint matches)
5. ❌ Bot/script rapidly clicks multiple codes
6. ❌ Same device clicks same code twice in 24h

---

## Performance Considerations

### Query Optimization
- ✅ Indexes on all fingerprint columns
- ✅ Redis cache for hot data (24h)
- ✅ Database for cold data (90-day history)
- ✅ Cleanup cron runs during low-traffic hours (3 AM)

### Cache Hit Rate
- **Expected**: 95%+ cache hit rate (most checks use Redis)
- **Fallback**: Database query if Redis expires

### Database Growth
- **Estimate**: ~1KB per fingerprint record
- **1000 users × 2 devices each = 2MB**
- **Cleanup**: Automatic 90-day expiry keeps size manageable

---

## Configuration

### Environment Variables
```bash
# Redis (required for fraud detection)
REDIS_URL=redis://localhost:6379

# PostgreSQL (required for persistent storage)
DATABASE_URL=postgresql://user:pass@localhost:5432/dbname

# Frontend URL (for CORS)
FRONTEND_URL=https://doac-perks.com
```

### Adjustable Thresholds

**File**: `backend/src/middleware/rateLimiter.ts`

```typescript
// Duplicate click window
const DUPLICATE_WINDOW = 86400; // 24 hours (seconds)

// Velocity threshold
const MAX_CLICKS_PER_MINUTE = 5; // clicks

// Mass fraud threshold
const MAX_CODES_PER_HOUR = 10; // different codes
```

**File**: `backend/src/controllers/referralController.ts`

```typescript
// Self-click score threshold
const SELF_CLICK_THRESHOLD = 8; // points

// Fingerprint expiry
const FINGERPRINT_EXPIRY_DAYS = 90; // days
```

---

## Changelog

### 2025-11-17 - Major Security Update
- ✅ Added `user_fingerprints` table for persistent storage
- ✅ Removed IP-only blocking (supports shared WiFi/VPN)
- ✅ Added score-based self-click detection (VPN-proof)
- ✅ Added full forensic logging to `referral_clicks`
- ✅ Added 90-day fingerprint expiry
- ✅ Increased thresholds (velocity: 3→5, mass: 5→10)
- ✅ Added cleanup cron job and manual scripts

---

## Support

For questions or issues, please contact the development team or file an issue in the repository.

**Last Updated**: November 17, 2025
**Version**: 2.0.0
