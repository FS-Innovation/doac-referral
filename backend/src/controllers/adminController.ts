import { Response } from 'express';
import pool from '../config/database';
import { AuthRequest } from '../types';
import { updateAllPlatformLinks } from '../services/latestEpisodeService';

// Product management functions removed - replaced by prize system (migration 012)

// User Management
export const getAllUsers = async (req: AuthRequest, res: Response) => {
  try {
    const result = await pool.query(
      `SELECT
         u.id,
         u.email,
         u.referral_code,
         u.points,
         u.is_admin,
         u.email_verified,
         u.created_at,
         COUNT(DISTINCT rc.id) as total_clicks,
         COUNT(DISTINCT upc.id) as total_prize_claims
       FROM users u
       LEFT JOIN referral_clicks rc ON u.id = rc.user_id
       LEFT JOIN user_prize_claims upc ON u.id = upc.user_id
       GROUP BY u.id
       ORDER BY u.created_at DESC`
    );

    res.json({
      users: result.rows.map(user => ({
        id: user.id,
        email: user.email,
        referralCode: user.referral_code,
        points: user.points,
        isAdmin: user.is_admin,
        emailVerified: user.email_verified,
        createdAt: user.created_at,
        totalClicks: parseInt(user.total_clicks),
        totalPrizeClaims: parseInt(user.total_prize_claims)
      }))
    });
  } catch (error) {
    console.error('Get all users error:', error);
    res.status(500).json({ error: 'Failed to fetch users' });
  }
};

export const getUserDetails = async (req: AuthRequest, res: Response) => {
  const { id } = req.params;

  try {
    // Get user info
    const userResult = await pool.query(
      `SELECT id, email, referral_code, points, is_admin, email_verified,
              first_name, age_range, country, terms_accepted_at, created_at
       FROM users WHERE id = $1`,
      [id]
    );

    if (userResult.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    const user = userResult.rows[0];

    // Get recent clicks
    const clicksResult = await pool.query(
      `SELECT ip_address, user_agent, clicked_at
       FROM referral_clicks
       WHERE user_id = $1
       ORDER BY clicked_at DESC
       LIMIT 20`,
      [id]
    );

    // Get prize claim history (replaced purchases)
    const claimsResult = await pool.query(
      `SELECT pt.name as prize_name, upc.points_spent, upc.claimed_at
       FROM user_prize_claims upc
       JOIN prize_tiers pt ON upc.tier_id = pt.id
       WHERE upc.user_id = $1
       ORDER BY upc.claimed_at DESC`,
      [id]
    );

    res.json({
      user: {
        id: user.id,
        email: user.email,
        referralCode: user.referral_code,
        points: user.points,
        isAdmin: user.is_admin,
        emailVerified: user.email_verified,
        firstName: user.first_name,
        ageRange: user.age_range,
        country: user.country,
        termsAcceptedAt: user.terms_accepted_at,
        createdAt: user.created_at
      },
      clicks: clicksResult.rows,
      prizeClaims: claimsResult.rows
    });
  } catch (error) {
    console.error('Get user details error:', error);
    res.status(500).json({ error: 'Failed to fetch user details' });
  }
};

// Settings Management
export const updateRedirectUrl = async (req: AuthRequest, res: Response) => {
  const { url, platform } = req.body;

  try {
    if (!url) {
      return res.status(400).json({ error: 'URL is required' });
    }

    // Validate URL format
    try {
      new URL(url);
    } catch {
      return res.status(400).json({ error: 'Invalid URL format' });
    }

    // Determine which setting key to update based on platform
    let settingKey = 'redirect_url'; // Default to YouTube
    if (platform === 'spotify') {
      settingKey = 'redirect_url_spotify';
    } else if (platform === 'apple') {
      settingKey = 'redirect_url_apple';
    }

    await pool.query(
      `INSERT INTO settings (key, value, updated_at)
       VALUES ($1, $2, CURRENT_TIMESTAMP)
       ON CONFLICT (key)
       DO UPDATE SET value = $2, updated_at = CURRENT_TIMESTAMP`,
      [settingKey, url]
    );

    res.json({
      message: `${platform || 'YouTube'} redirect URL updated successfully`,
      platform: platform || 'youtube',
      redirectUrl: url
    });
  } catch (error) {
    console.error('Update redirect URL error:', error);
    res.status(500).json({ error: 'Failed to update redirect URL' });
  }
};

export const getSettings = async (req: AuthRequest, res: Response) => {
  try {
    const result = await pool.query(
      "SELECT value FROM settings WHERE key = 'redirect_url'"
    );

    res.json({
      redirectUrl: result.rows[0]?.value || 'https://example.com'
    });
  } catch (error) {
    console.error('Get settings error:', error);
    res.status(500).json({ error: 'Failed to fetch settings' });
  }
};

// Analytics
export const getAnalytics = async (req: AuthRequest, res: Response) => {
  try {
    // Get total stats
    const statsResult = await pool.query(`
      SELECT
        (SELECT COUNT(*) FROM users) as total_users,
        (SELECT COUNT(*) FROM users WHERE email_verified = true) as verified_users,
        (SELECT COUNT(*) FROM referral_clicks) as total_clicks,
        (SELECT COUNT(*) FROM user_prize_claims) as total_prize_claims,
        (SELECT COALESCE(SUM(points_spent), 0) FROM user_prize_claims) as total_points_redeemed,
        (SELECT COALESCE(SUM(points), 0) FROM users) as total_points_in_system
    `);

    // Get recent activity
    const recentClicksResult = await pool.query(`
      SELECT u.email, rc.clicked_at
      FROM referral_clicks rc
      JOIN users u ON rc.user_id = u.id
      ORDER BY rc.clicked_at DESC
      LIMIT 10
    `);

    // Get recent prize claims (replaced purchases)
    const recentClaimsResult = await pool.query(`
      SELECT u.email, pt.name as prize_name, upc.points_spent, upc.claimed_at
      FROM user_prize_claims upc
      JOIN users u ON upc.user_id = u.id
      JOIN prize_tiers pt ON upc.tier_id = pt.id
      ORDER BY upc.claimed_at DESC
      LIMIT 10
    `);

    // Get top referrers
    const topReferrersResult = await pool.query(`
      SELECT
        u.email,
        u.points,
        COUNT(rc.id) as click_count
      FROM users u
      LEFT JOIN referral_clicks rc ON u.id = rc.user_id
      GROUP BY u.id, u.email, u.points
      ORDER BY click_count DESC
      LIMIT 10
    `);

    res.json({
      stats: statsResult.rows[0],
      recentClicks: recentClicksResult.rows,
      recentPrizeClaims: recentClaimsResult.rows,
      topReferrers: topReferrersResult.rows
    });
  } catch (error) {
    console.error('Get analytics error:', error);
    res.status(500).json({ error: 'Failed to fetch analytics' });
  }
};

// Episode Updates
export const updateLatestEpisodes = async (req: AuthRequest, res: Response) => {
  try {
    console.log('🔄 Manual episode update triggered by admin');

    const results = await updateAllPlatformLinks();

    // Build response
    const response: any = {
      message: 'Episode update completed',
      timestamp: new Date().toISOString(),
      results: {}
    };

    if (results.youtube) {
      response.results.youtube = {
        success: true,
        title: results.youtube.title,
        url: results.youtube.url,
        thumbnail: results.youtube.thumbnail
      };
    }

    if (results.spotify) {
      response.results.spotify = {
        success: true,
        title: results.spotify.title,
        url: results.spotify.url,
        thumbnail: results.spotify.thumbnail
      };
    }

    if (results.apple) {
      response.results.apple = {
        success: true,
        title: results.apple.title,
        url: results.apple.url,
        thumbnail: results.apple.thumbnail
      };
    }

    if (results.errors.length > 0) {
      response.errors = results.errors;
      response.message = 'Episode update completed with some errors';
    }

    const allFailed = !results.youtube && !results.spotify && !results.apple;
    if (allFailed) {
      return res.status(500).json({
        error: 'All platform updates failed',
        errors: results.errors
      });
    }

    res.json(response);
  } catch (error) {
    console.error('Update latest episodes error:', error);
    res.status(500).json({
      error: 'Failed to update episodes',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
};

export const getCurrentEpisodeLinks = async (req: AuthRequest, res: Response) => {
  try {
    const result = await pool.query(
      `SELECT key, value, updated_at
       FROM settings
       WHERE key IN ('redirect_url', 'redirect_url_spotify', 'redirect_url_apple')
       ORDER BY key`
    );

    const links: any = {
      youtube: null,
      spotify: null,
      apple: null
    };

    result.rows.forEach(row => {
      if (row.key === 'redirect_url') {
        links.youtube = {
          url: row.value,
          lastUpdated: row.updated_at
        };
      } else if (row.key === 'redirect_url_spotify') {
        links.spotify = {
          url: row.value,
          lastUpdated: row.updated_at
        };
      } else if (row.key === 'redirect_url_apple') {
        links.apple = {
          url: row.value,
          lastUpdated: row.updated_at
        };
      }
    });

    res.json({
      message: 'Current episode links',
      links
    });
  } catch (error) {
    console.error('Get current episode links error:', error);
    res.status(500).json({ error: 'Failed to fetch current episode links' });
  }
};
