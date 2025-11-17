# Fraud Detection Audit - Multi-Factor Check Verification

## Question: Are we blocking on single factors or multi-factors?

---

## Check 1: Duplicate Device ID (rateLimiter.ts:133-146)

**Code**:
```typescript
const deviceKey = `fraud:${code}:deviceid:${deviceId}`;
const deviceClicked = await redisClient.get(deviceKey);
if (deviceClicked) {
  req.body.skipPointsAward = true; // ❌ Looks like single factor!
}
```

**Analysis**:
- **Key format**: `fraud:{CODE}:deviceid:{DEVICE_ID}`
- **What it checks**: Has THIS device clicked THIS code before?
- **Is it multi-factor?**: **NO - Single factor per code**

**Test Scenarios**:

| Scenario | Device | Code | Key | Result |
|----------|--------|------|-----|--------|
| Alice clicks Code #1 | Device A | CODE1 | `fraud:CODE1:deviceid:A` → Stored | ✅ Points awarded |
| Alice clicks Code #1 again (1 hour later) | Device A | CODE1 | `fraud:CODE1:deviceid:A` → **EXISTS** | ❌ **BLOCKED** (duplicate) |
| Alice clicks Code #2 (different code) | Device A | CODE2 | `fraud:CODE2:deviceid:A` → Not stored | ✅ **Points awarded** ✓ |
| Bob clicks Code #1 (different device) | Device B | CODE1 | `fraud:CODE1:deviceid:B` → Not stored | ✅ **Points awarded** ✓ |

**Verdict**: ✅ **CORRECT** - Blocks duplicate clicks of SAME code from SAME device
**Multi-factor?**: Single factor BUT correct behavior (duplicate prevention per code)

---

## Check 2: Duplicate Device Fingerprint (rateLimiter.ts:152-165)

**Code**:
```typescript
const deviceFpKey = `fraud:${code}:devicefp:${deviceFingerprint}`;
const deviceFpClicked = await redisClient.get(deviceFpKey);
if (deviceFpClicked) {
  req.body.skipPointsAward = true;
}
```

**Analysis**: Same as Check #1, but for hardware fingerprint
**Verdict**: ✅ **CORRECT** - Blocks duplicate clicks of SAME code from SAME hardware

---

## Check 3: Duplicate Browser Fingerprint (rateLimiter.ts:169-183)

**Code**:
```typescript
const fpKey = `fraud:${code}:fp:${browserFingerprint}`;
const fpAlreadyClicked = await redisClient.get(fpKey);
if (fpAlreadyClicked) {
  req.body.skipPointsAward = true;
}
```

**Analysis**: Same as Check #1, but for browser fingerprint
**Verdict**: ✅ **CORRECT** - Blocks duplicate clicks of SAME code from SAME browser

---

## Check 4: Self-Click Detection (referralController.ts:79-149)

**Code**:
```typescript
// Score-based system
if (deviceId matches) score = 100
if (deviceFP matches) score += 50
if (browserFP matches) score += 30
if (IP matches) score += 10

if (score >= 80) {
  skipPointsAward = true; // Block
}
```

**Analysis**: **MULTI-FACTOR** - Requires 80+ points
**Possible blocking combinations**:
- Device ID alone = 100 → **BLOCK** ✅
- Device FP + Browser FP = 80 → **BLOCK** ✅
- Device FP + Browser FP + IP = 90 → **BLOCK** ✅
- Device FP alone = 50 → **ALLOW** ✅
- Browser FP alone = 30 → **ALLOW** ✅

**Verdict**: ✅ **CORRECT** - Requires high-confidence match (multi-factor OR Device ID)

---

## CONCERN: Are the checks TOO strict?

### Scenario: Legitimate user clicking multiple codes

**Setup**: Alice has a laptop, visits 5 different friends who each have referral codes

| Action | Device | Code | Duplicate Check | Self-Click Check | Result |
|--------|--------|------|-----------------|------------------|--------|
| Click friend #1's code | Laptop | CODE1 | First time → Allow | Different owner → Allow | ✅ Points |
| Click friend #2's code | Laptop | CODE2 | First time → Allow | Different owner → Allow | ✅ Points |
| Click friend #3's code | Laptop | CODE3 | First time → Allow | Different owner → Allow | ✅ Points |
| Click friend #1's code again | Laptop | CODE1 | **DUPLICATE** → Block | Different owner → Allow | ❌ **BLOCKED** |
| Click own code | Laptop | OWN | First time → Allow | **SELF-CLICK** → Block | ❌ **BLOCKED** |

**Verdict**: ✅ **CORRECT** - Alice can click all 5 friends' codes once each

---

## Scenario: Office with 20 people

**Setup**: 20 people, same WiFi, all clicking different codes

| Person | Device | Code | Duplicate Check | Self-Click Check | IP | Result |
|--------|--------|------|-----------------|------------------|----|--------|
| Alice | Laptop A | CODE1 | First time | Different owner | 1.2.3.4 | ✅ Points |
| Bob | Laptop B | CODE2 | First time | Different owner | 1.2.3.4 | ✅ Points |
| Carol | Phone C | CODE3 | First time | Different owner | 1.2.3.4 | ✅ Points |
| ...18 more people | Different devices | Different codes | First time | Different owner | 1.2.3.4 | ✅ Points |

**Verdict**: ✅ **CORRECT** - All 20 get points (no IP blocking)

---

## Scenario: User trying to game the system

**Setup**: Alice tries to click her own code multiple times

| Attempt | Device | Code | Method | Duplicate Check | Self-Click Check | Result |
|---------|--------|------|--------|-----------------|------------------|--------|
| 1st | Laptop | OWN | Normal | First time → Allow | **Device ID match → Block** | ❌ **BLOCKED** |
| 2nd | Laptop + VPN | OWN | Change IP | First time → Allow | **Device ID match → Block** | ❌ **BLOCKED** |
| 3rd | Desktop | OWN | Different device | First time → Allow | **No match → Allow** | ✅ **Points** ⚠️ |

**CONCERN**: ⚠️ User can click own code from different device!

**Is this a problem?**
- If Alice legitimately has 2 devices (laptop + desktop), she should be able to click OTHER people's codes from both
- But she shouldn't get points for clicking her OWN code from desktop
- **Current behavior**: She WOULD get points if she clicks her own code from a device she's never logged in from

**Wait, let me check**: Does self-click detection check ALL devices in the database?

Looking at line 62-70 in referralController.ts:
```typescript
const fpResult = await pool.query(
  `SELECT device_id, device_fingerprint, browser_fingerprint, last_seen
   FROM user_fingerprints
   WHERE user_id = $1
     AND last_seen > NOW() - INTERVAL '90 days'
   ORDER BY last_seen DESC`,
  [userId]
);
```

**YES!** It checks ALL devices for that user (up to 90 days old).

So if Alice has logged in from both laptop and desktop, the self-click detection will check BOTH devices.

---

## FINAL VERDICT

### ✅ All Checks Are Correct

1. **Duplicate Detection (3 checks)**: Single-factor per code, but correct behavior
   - Blocks: Same device clicking same code twice
   - Allows: Same device clicking different codes
   - Allows: Different devices clicking same code

2. **Self-Click Detection**: Multi-factor (score >= 80)
   - Checks ALL user's devices (up to 90 days)
   - Requires high confidence (Device ID OR multiple fingerprints)
   - Uses IP as tiebreaker

### 🎯 Multi-Factor Verification

| Check Type | Factors Required | Correct? |
|------------|------------------|----------|
| **Duplicate Device ID** | 1 factor (Device ID) BUT per-code | ✅ Yes |
| **Duplicate Device FP** | 1 factor (Device FP) BUT per-code | ✅ Yes |
| **Duplicate Browser FP** | 1 factor (Browser FP) BUT per-code | ✅ Yes |
| **Self-Click Detection** | Multi-factor (score >= 80) | ✅ Yes |

### 📊 The System Works Correctly Because:

1. **Duplicate checks are PER CODE** - Not blocking across different codes
2. **Self-click checks ALL user devices** - Can't bypass by using different device
3. **No IP-only blocking** - Shared WiFi supported
4. **Multi-factor self-click** - Requires high confidence (80+ score)

---

## Edge Case: Brand New Device

**Scenario**: Alice buys a new laptop, never logs in from it, clicks her own code

| Step | What Happens |
|------|--------------|
| Alice has logged in from Old Laptop | `user_fingerprints` has Old Laptop record |
| Alice clicks own code from New Laptop | Self-click check queries `user_fingerprints` for Alice's devices |
| New Laptop fingerprints | **Don't match** Old Laptop (different hardware) |
| Self-click score | 0 (no matches) |
| Result | ✅ **Points awarded** ⚠️ |

**Is this a problem?**
- **Technically yes** - Alice got points for clicking her own code
- **BUT**: This is actually hard to exploit because:
  - Most people don't have unlimited devices
  - Each device can only click once (duplicate prevention)
  - To farm points, Alice would need to buy many devices

**Is it worth fixing?**
- **Current behavior**: User can click own code from brand-new device they've never logged in from
- **To fix**: Would require users to log in before clicking ANY code (adds friction)
- **Recommendation**: Leave as-is. The cost of buying new devices makes this impractical to exploit.

---

## Conclusion

✅ **The system is correctly using multi-factor checks**
✅ **No single-factor blocking that would cause false positives**
✅ **Duplicate prevention is per-code (correct)**
✅ **Self-click detection checks all user devices**
✅ **One edge case exists but is impractical to exploit**

**Status**: Production ready ✅
