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
    // Get device ID and browser fingerprint from headers (sent by frontend)
    const deviceId = req.get('x-device-id') || '';
    const browserFingerprint = req.get('x-browser-fingerprint') || '';

    // Check Redis for the owner's stored fingerprints (stored on login/activity)
    const ownerIpKey = `user:${userId}:ip`;
    const ownerDeviceKey = `user:${userId}:device`;
    const ownerFingerprintKey = `user:${userId}:fingerprint`;

    const ownerIp = await redisClient.get(ownerIpKey);
    const ownerDevice = await redisClient.get(ownerDeviceKey);
    const ownerFingerprint = await redisClient.get(ownerFingerprintKey);

    let skipPointsAward = req.body.skipPointsAward === true;

    // Multi-layered self-click detection (any match = self-click)
    let selfClickReason = '';

    // Check 1: IP match
    if (ownerIp && ownerIp === ipAddress) {
      selfClickReason = `IP match (${ipAddress})`;
    }

    // Check 2: Device ID match (most reliable - persists across sessions)
    if (!selfClickReason && ownerDevice && deviceId && ownerDevice === deviceId) {
      selfClickReason = `Device ID match (${deviceId.substring(0, 16)}...)`;
    }

    // Check 3: Browser fingerprint match (catches VPN switchers)
    if (!selfClickReason && ownerFingerprint && browserFingerprint && ownerFingerprint === browserFingerprint) {
      selfClickReason = `Browser fingerprint match (${browserFingerprint.substring(0, 16)}...)`;
    }

    if (selfClickReason) {
      console.warn(`🚨 SELF-CLICK DETECTED: User ${userId} clicked their own referral link - ${selfClickReason}`);
      skipPointsAward = true;
    }

    // Start a transaction to ensure atomic operations
    const client = await pool.connect();

    try {
      await client.query('BEGIN');

      // Always insert click record for tracking
      await client.query(
        `INSERT INTO referral_clicks (user_id, ip_address, user_agent)
         VALUES ($1, $2, $3)`,
        [userId, ipAddress, userAgent]
      );

      // Only award points if not flagged as potential fraud
      if (!skipPointsAward) {
        await client.query(
          'UPDATE users SET points = points + 1 WHERE id = $1',
          [userId]
        );
      } else {
        console.warn(`⚠️  Points not awarded for code ${code} from IP ${ipAddress} (fraud prevention)`);
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
