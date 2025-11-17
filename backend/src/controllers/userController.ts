import { Response } from 'express';
import pool from '../config/database';
import { AuthRequest } from '../types';

export const getReferralStats = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user!.id;

    // Get user's referral code and points
    const userResult = await pool.query(
      'SELECT referral_code, points FROM users WHERE id = $1',
      [userId]
    );

    if (userResult.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    const { referral_code, points } = userResult.rows[0];

    // Get total click count
    const clickCountResult = await pool.query(
      'SELECT COUNT(*) as total_clicks FROM referral_clicks WHERE user_id = $1',
      [userId]
    );

    const totalClicks = parseInt(clickCountResult.rows[0].total_clicks);

    // Get recent clicks (last 10)
    const recentClicksResult = await pool.query(
      `SELECT ip_address, user_agent, clicked_at
       FROM referral_clicks
       WHERE user_id = $1
       ORDER BY clicked_at DESC
       LIMIT 10`,
      [userId]
    );

    // Generate full referral URL - PRODUCTION SAFE
    const referralUrl = `${process.env.FRONTEND_URL || (process.env.NODE_ENV === 'production' ? 'https://doac-perks.com' : 'http://localhost:3000')}/r/${referral_code}`;

    res.json({
      referralCode: referral_code,
      referralUrl,
      points,
      totalClicks,
      recentClicks: recentClicksResult.rows.map(click => ({
        ipAddress: click.ip_address,
        userAgent: click.user_agent,
        clickedAt: click.clicked_at
      }))
    });
  } catch (error) {
    console.error('Get referral stats error:', error);
    res.status(500).json({ error: 'Failed to fetch referral stats' });
  }
};

export const getPurchaseHistory = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user!.id;

    const result = await pool.query(
      `SELECT id, product_name, points_spent, purchased_at
       FROM purchases
       WHERE user_id = $1
       ORDER BY purchased_at DESC`,
      [userId]
    );

    res.json({
      purchases: result.rows.map(purchase => ({
        id: purchase.id,
        productName: purchase.product_name,
        pointsSpent: purchase.points_spent,
        purchasedAt: purchase.purchased_at
      }))
    });
  } catch (error) {
    console.error('Get purchase history error:', error);
    res.status(500).json({ error: 'Failed to fetch purchase history' });
  }
};
