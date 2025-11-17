import { Request, Response } from 'express';
import pool from '../config/database';
import redisClient from '../config/redis';

export const trackReferralClick = async (req: Request, res: Response) => {
  const { code } = req.params;

  try {
    // Check Redis cache for referral code first (performance optimization)
    const cacheKey = `referral:${code}`;
    const cachedUserId = await redisClient.get(cacheKey);

    let userId: number;

    if (cachedUserId) {
      // Cache hit - use cached user ID
      userId = parseInt(cachedUserId, 10);
    } else {
      // Cache miss - query database
      const userResult = await pool.query(
        'SELECT id FROM users WHERE referral_code = $1',
        [code]
      );

      if (userResult.rows.length === 0) {
        return res.status(404).json({ error: 'Invalid referral code' });
      }

      userId = userResult.rows[0].id;

      // Cache the result for 1 hour
      await redisClient.setex(cacheKey, 3600, userId.toString());
    }

    // Get IP address and user agent
    const ipAddress = req.ip || req.socket.remoteAddress || 'unknown';
    const userAgent = req.get('user-agent') || 'unknown';

    // Debug logging for IP detection
    console.log(`📍 Referral click from IP: ${ipAddress}, Code: ${code}`);

    // CRITICAL: Prevent self-clicking by comparing clicker's fingerprints with referral owner's
    // INDUSTRY STANDARD: Multi-factor matching (device ID + fingerprints) WITHOUT IP requirement
    // IP-only blocking REMOVED to support shared WiFi / VPN / legitimate IP changes
    const deviceId = req.get('x-device-id') || '';
    const deviceFingerprint = req.get('x-device-fingerprint') || '';
    const browserFingerprint = req.get('x-browser-fingerprint') || '';

    let skipPointsAward = req.body.skipPointsAward === true;
    let selfClickReason = '';
    let matchScore = 0;

    // STEP 1: Try Redis cache first (fast path - 24 hour cache)
    const ownerDeviceId = await redisClient.get(`user:${userId}:deviceid`);
    const ownerDeviceFp = await redisClient.get(`user:${userId}:devicefp`);
    const ownerBrowserFp = await redisClient.get(`user:${userId}:browserfp`);

    // STEP 2: Check database for persistent fingerprints (survives Redis expiry)
    // Query all fingerprints for this user from last 90 days
    let ownerFingerprints: any[] = [];
    try {
      const fpResult = await pool.query(
        `SELECT device_id, device_fingerprint, browser_fingerprint, last_seen
         FROM user_fingerprints
         WHERE user_id = $1
           AND last_seen > NOW() - INTERVAL '90 days'
         ORDER BY last_seen DESC`,
        [userId]
      );
      ownerFingerprints = fpResult.rows;
    } catch (error) {
      console.error('Error querying user fingerprints:', error);
    }

    // STEP 3: Multi-factor matching algorithm (INDUSTRY STANDARD)
    // PRIORITY: Device ID is the STRONGEST signal and should ALWAYS be checked first
    // IP is used as TIEBREAKER ONLY when fingerprints are ambiguous

    const checkMatch = (storedDeviceId: string | null, storedDeviceFp: string | null, storedBrowserFp: string | null, storedIp: string | null) => {
      let score = 0;
      const reasons: string[] = [];

      // 1. DEVICE ID - Highest priority (UUID in localStorage)
      // If Device ID matches, it's DEFINITELY the same device - INSTANT BLOCK
      if (deviceId && storedDeviceId && deviceId === storedDeviceId) {
        score += 100; // Overwhelming score - definitive match
        reasons.push('Device ID match');
        return { score, reasons }; // Return immediately - no need to check further
      }

      // 2. DEVICE FINGERPRINT - Hardware-based (GPU, CPU, screen)
      if (deviceFingerprint && storedDeviceFp && deviceFingerprint === storedDeviceFp) {
        score += 50;
        reasons.push('Device fingerprint match');
      }

      // 3. BROWSER FINGERPRINT - Software-based (canvas, audio, fonts)
      if (browserFingerprint && storedBrowserFp && browserFingerprint === storedBrowserFp) {
        score += 30;
        reasons.push('Browser fingerprint match');
      }

      // 4. IP ADDRESS - TIEBREAKER ONLY (not primary signal)
      // Used to distinguish between:
      //   - Rare collision: Two people with similar hardware (allow)
      //   - Same person, fingerprint changed slightly (block)
      const ipMatches = storedIp && ipAddress && storedIp === ipAddress;
      if (ipMatches && score > 0) {
        score += 10; // Bonus points if IP also matches (increases confidence)
        reasons.push('IP match (tiebreaker)');
      }

      return { score, reasons };
    };

    // Check Redis cached fingerprints
    const ownerIp = await redisClient.get(`user:${userId}:ip`);
    const redisMatch = checkMatch(ownerDeviceId, ownerDeviceFp, ownerBrowserFp, ownerIp);

    // Device ID match = instant block (score 100)
    // Device FP + Browser FP = high confidence (score 80)
    // Device FP + Browser FP + IP = very high confidence (score 90)
    if (redisMatch.score >= 80) {
      matchScore = redisMatch.score;
      selfClickReason = `Redis cache: ${redisMatch.reasons.join(' + ')}`;
    }

    // Check database fingerprints (only if Redis didn't find strong match)
    if (!selfClickReason && ownerFingerprints.length > 0) {
      for (const fp of ownerFingerprints) {
        const dbMatch = checkMatch(fp.device_id, fp.device_fingerprint, fp.browser_fingerprint, fp.ip_address);
        if (dbMatch.score >= 80) {
          matchScore = dbMatch.score;
          selfClickReason = `Database: ${dbMatch.reasons.join(' + ')} (last seen: ${fp.last_seen})`;
          break; // Found strong match, stop checking
        }
      }
    }

    // STEP 4: Block if strong match found
    // Score 100 = Device ID match → BLOCK (100% same device)
    // Score 90 = Device FP + Browser FP + IP → BLOCK (99% same device)
    // Score 80 = Device FP + Browser FP → BLOCK (95% same device)
    // Score <80 = Not enough evidence → ALLOW (protects legitimate users)
    if (selfClickReason) {
      console.warn(`🚨 SELF-CLICK DETECTED: User ${userId} clicked their own referral link`);
      console.warn(`   Match Score: ${matchScore}/18 | Reason: ${selfClickReason}`);
      console.warn(`   Clicker Device ID: ${deviceId.substring(0, 16)}...`);
      skipPointsAward = true;
    }

    // Start a transaction to ensure atomic operations
    const client = await pool.connect();

    try {
      await client.query('BEGIN');

      // Collect all fraud flags for forensic logging
      const fraudFlags: string[] = [];
      if (selfClickReason) fraudFlags.push(`self_click:${selfClickReason}`);
      if (req.body.fraudReason) fraudFlags.push(req.body.fraudReason);

      // Always insert click record with FULL forensic data
      await client.query(
        `INSERT INTO referral_clicks
          (user_id, ip_address, user_agent, device_id, device_fingerprint, browser_fingerprint, fraud_flags, points_awarded)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
        [
          userId,
          ipAddress,
          userAgent,
          deviceId || null,
          deviceFingerprint || null,
          browserFingerprint || null,
          fraudFlags.length > 0 ? fraudFlags : null,
          !skipPointsAward
        ]
      );

      // Only award points if not flagged as potential fraud
      if (!skipPointsAward) {
        await client.query(
          'UPDATE users SET points = points + 1 WHERE id = $1',
          [userId]
        );
        console.log(`✅ Points awarded for code ${code} (IP: ${ipAddress}, Device: ${deviceId.substring(0, 8)}...)`);
      } else {
        console.warn(`⚠️  Points NOT awarded for code ${code} from IP ${ipAddress} (fraud prevention)`);
        console.warn(`   Fraud flags: ${JSON.stringify(fraudFlags)}`);
      }

      await client.query('COMMIT');

      // HARDCODED: Always redirect to YouTube video
      const redirectUrl = 'https://youtu.be/qxxnRMT9C-8';

      // Redirect to the configured URL
      res.redirect(redirectUrl);
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  } catch (error) {
    console.error('Referral tracking error:', error);
    res.status(500).json({ error: 'Failed to track referral click' });
  }
};
