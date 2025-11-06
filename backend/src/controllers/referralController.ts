import { Request, Response } from 'express';
import pool from '../config/database';

export const trackReferralClick = async (req: Request, res: Response) => {
  const { code } = req.params;

  try {
    // Find user by referral code
    const userResult = await pool.query(
      'SELECT id FROM users WHERE referral_code = $1',
      [code]
    );

    if (userResult.rows.length === 0) {
      return res.status(404).json({ error: 'Invalid referral code' });
    }

    const userId = userResult.rows[0].id;

    // Get IP address and user agent
    const ipAddress = req.ip || req.socket.remoteAddress || 'unknown';
    const userAgent = req.get('user-agent') || 'unknown';

    // Start a transaction to ensure atomic operations
    const client = await pool.connect();

    try {
      await client.query('BEGIN');

      // Insert click record
      await client.query(
        `INSERT INTO referral_clicks (user_id, ip_address, user_agent)
         VALUES ($1, $2, $3)`,
        [userId, ipAddress, userAgent]
      );

      // Award 1 point to the user
      await client.query(
        'UPDATE users SET points = points + 1 WHERE id = $1',
        [userId]
      );

      await client.query('COMMIT');

      // Get redirect URL from settings
      const settingsResult = await pool.query(
        "SELECT value FROM settings WHERE key = 'redirect_url'"
      );

      const redirectUrl = settingsResult.rows[0]?.value || 'https://example.com';

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
