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
    // Require BOTH IP + (device/fingerprint) match to avoid false positives (friends on same WiFi)
    const deviceId = req.get('x-device-id') || '';
    const deviceFingerprint = req.get('x-device-fingerprint') || '';
    const browserFingerprint = req.get('x-browser-fingerprint') || '';

    // Check Redis for the owner's stored fingerprints (stored on login/activity)
    const ownerIpKey = `user:${userId}:ip`;
    const ownerDeviceIdKey = `user:${userId}:deviceid`;
    const ownerDeviceFpKey = `user:${userId}:devicefp`;
    const ownerBrowserFpKey = `user:${userId}:browserfp`;

    const ownerIp = await redisClient.get(ownerIpKey);
    const ownerDeviceId = await redisClient.get(ownerDeviceIdKey);
    const ownerDeviceFp = await redisClient.get(ownerDeviceFpKey);
    const ownerBrowserFp = await redisClient.get(ownerBrowserFpKey);

    let skipPointsAward = req.body.skipPointsAward === true;

    // Multi-layered self-click detection (INDUSTRY STANDARD)
    // Require BOTH IP match AND (device ID OR device fingerprint OR browser fingerprint) match
    let selfClickReason = '';

    const ipMatches = ownerIp && ownerIp === ipAddress;
    const deviceIdMatches = ownerDeviceId && deviceId && ownerDeviceId === deviceId;
    const deviceFpMatches = ownerDeviceFp && deviceFingerprint && ownerDeviceFp === deviceFingerprint;
    const browserFpMatches = ownerBrowserFp && browserFingerprint && ownerBrowserFp === browserFingerprint;

    // Check 1: IP + Device ID match (most reliable - localStorage UUID)
    if (ipMatches && deviceIdMatches) {
      selfClickReason = `IP + Device ID match (${ipAddress}, ${deviceId.substring(0, 16)}...)`;
    }
    // Check 2: IP + Device Fingerprint match (catches localStorage clearers)
    else if (ipMatches && deviceFpMatches) {
      selfClickReason = `IP + Device fingerprint match (${ipAddress}, ${deviceFingerprint.substring(0, 16)}...)`;
    }
    // Check 3: IP + Browser Fingerprint match (catches different browsers on same device)
    else if (ipMatches && browserFpMatches) {
      selfClickReason = `IP + Browser fingerprint match (${ipAddress}, ${browserFingerprint.substring(0, 16)}...)`;
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
