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

    // Check if fraud detection middleware flagged this request
    const skipPointsAward = req.body.skipPointsAward === true;

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

      // Get redirect URL from cache or database
      const redirectCacheKey = 'setting:redirect_url';
      let redirectUrl = await redisClient.get(redirectCacheKey);

      if (!redirectUrl) {
        const settingsResult = await pool.query(
          "SELECT value FROM settings WHERE key = 'redirect_url'"
        );

        redirectUrl = settingsResult.rows[0]?.value || process.env.DEFAULT_REDIRECT_URL || 'https://example.com';

        // Cache for 5 minutes
        await redisClient.setex(redirectCacheKey, 300, redirectUrl as string);
      }

      // Redirect to the configured URL
      res.redirect(redirectUrl as string);
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
