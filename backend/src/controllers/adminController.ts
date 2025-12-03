import { Response } from 'express';
import pool from '../config/database';
import { AuthRequest } from '../types';
import { updateAllPlatformLinks } from '../services/latestEpisodeService';

// Product Management
export const createProduct = async (req: AuthRequest, res: Response) => {
  const { name, description, pointCost, imageUrl } = req.body;

  try {
    if (!name || !pointCost) {
      return res.status(400).json({ error: 'Name and point cost are required' });
    }

    const result = await pool.query(
      `INSERT INTO products (name, description, point_cost, image_url)
       VALUES ($1, $2, $3, $4)
       RETURNING id, name, description, point_cost, image_url, is_active, created_at`,
      [name, description, pointCost, imageUrl || null]
    );

    const product = result.rows[0];

    res.status(201).json({
      message: 'Product created successfully',
      product: {
        id: product.id,
        name: product.name,
        description: product.description,
        pointCost: product.point_cost,
        imageUrl: product.image_url,
        isActive: product.is_active,
        createdAt: product.created_at
      }
    });
  } catch (error) {
    console.error('Create product error:', error);
    res.status(500).json({ error: 'Failed to create product' });
  }
};

export const updateProduct = async (req: AuthRequest, res: Response) => {
  const { id } = req.params;
  const { name, description, pointCost, imageUrl, isActive } = req.body;

  try {
    const result = await pool.query(
      `UPDATE products
       SET name = COALESCE($1, name),
           description = COALESCE($2, description),
           point_cost = COALESCE($3, point_cost),
           image_url = COALESCE($4, image_url),
           is_active = COALESCE($5, is_active),
           updated_at = CURRENT_TIMESTAMP
       WHERE id = $6
       RETURNING id, name, description, point_cost, image_url, is_active, updated_at`,
      [name, description, pointCost, imageUrl, isActive, id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Product not found' });
    }

    const product = result.rows[0];

    res.json({
      message: 'Product updated successfully',
      product: {
        id: product.id,
        name: product.name,
        description: product.description,
        pointCost: product.point_cost,
        imageUrl: product.image_url,
        isActive: product.is_active,
        updatedAt: product.updated_at
      }
    });
  } catch (error) {
    console.error('Update product error:', error);
    res.status(500).json({ error: 'Failed to update product' });
  }
};

export const deleteProduct = async (req: AuthRequest, res: Response) => {
  const { id } = req.params;

  try {
    const result = await pool.query(
      'DELETE FROM products WHERE id = $1 RETURNING id',
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Product not found' });
    }

    res.json({ message: 'Product deleted successfully' });
  } catch (error) {
    console.error('Delete product error:', error);
    res.status(500).json({ error: 'Failed to delete product' });
  }
};

export const getAllProductsAdmin = async (req: AuthRequest, res: Response) => {
  try {
    const result = await pool.query(
      `SELECT id, name, description, point_cost, image_url, is_active, created_at, updated_at
       FROM products
       ORDER BY created_at DESC`
    );

    res.json({
      products: result.rows.map(product => ({
        id: product.id,
        name: product.name,
        description: product.description,
        pointCost: product.point_cost,
        imageUrl: product.image_url,
        isActive: product.is_active,
        createdAt: product.created_at,
        updatedAt: product.updated_at
      }))
    });
  } catch (error) {
    console.error('Get all products error:', error);
    res.status(500).json({ error: 'Failed to fetch products' });
  }
};

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
         u.created_at,
         COUNT(DISTINCT rc.id) as total_clicks,
         COUNT(DISTINCT p.id) as total_purchases
       FROM users u
       LEFT JOIN referral_clicks rc ON u.id = rc.user_id
       LEFT JOIN purchases p ON u.id = p.user_id
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
        createdAt: user.created_at,
        totalClicks: parseInt(user.total_clicks),
        totalPurchases: parseInt(user.total_purchases)
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
      'SELECT id, email, referral_code, points, is_admin, created_at FROM users WHERE id = $1',
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

    // Get purchase history
    const purchasesResult = await pool.query(
      `SELECT product_name, points_spent, purchased_at
       FROM purchases
       WHERE user_id = $1
       ORDER BY purchased_at DESC`,
      [id]
    );

    res.json({
      user: {
        id: user.id,
        email: user.email,
        referralCode: user.referral_code,
        points: user.points,
        isAdmin: user.is_admin,
        createdAt: user.created_at
      },
      clicks: clicksResult.rows,
      purchases: purchasesResult.rows
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
        (SELECT COUNT(*) FROM referral_clicks) as total_clicks,
        (SELECT COUNT(*) FROM purchases) as total_purchases,
        (SELECT COALESCE(SUM(points_spent), 0) FROM purchases) as total_points_redeemed
    `);

    // Get recent activity
    const recentClicksResult = await pool.query(`
      SELECT u.email, rc.clicked_at
      FROM referral_clicks rc
      JOIN users u ON rc.user_id = u.id
      ORDER BY rc.clicked_at DESC
      LIMIT 10
    `);

    const recentPurchasesResult = await pool.query(`
      SELECT u.email, p.product_name, p.points_spent, p.purchased_at
      FROM purchases p
      JOIN users u ON p.user_id = u.id
      ORDER BY p.purchased_at DESC
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
      recentPurchases: recentPurchasesResult.rows,
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
