import { Response } from 'express';
import pool from '../config/database';
import { AuthRequest } from '../types';
import { sendPurchaseNotification } from '../services/emailService';

export const getAllProducts = async (req: AuthRequest, res: Response) => {
  try {
    const result = await pool.query(
      `SELECT id, name, description, point_cost, image_url, is_active, created_at
       FROM products
       WHERE is_active = true
       ORDER BY point_cost ASC`
    );

    res.json({
      products: result.rows.map(product => ({
        id: product.id,
        name: product.name,
        description: product.description,
        pointCost: product.point_cost,
        imageUrl: product.image_url,
        isActive: product.is_active,
        createdAt: product.created_at
      }))
    });
  } catch (error) {
    console.error('Get products error:', error);
    res.status(500).json({ error: 'Failed to fetch products' });
  }
};

export const purchaseProduct = async (req: AuthRequest, res: Response) => {
  const { id } = req.params;
  const userId = req.user!.id;

  try {
    const client = await pool.connect();

    try {
      await client.query('BEGIN');

      // Get product details
      const productResult = await client.query(
        'SELECT id, name, point_cost, is_active FROM products WHERE id = $1',
        [id]
      );

      if (productResult.rows.length === 0) {
        await client.query('ROLLBACK');
        return res.status(404).json({ error: 'Product not found' });
      }

      const product = productResult.rows[0];

      if (!product.is_active) {
        await client.query('ROLLBACK');
        return res.status(400).json({ error: 'Product is no longer available' });
      }

      // Get user's current points
      const userResult = await client.query(
        'SELECT email, points FROM users WHERE id = $1',
        [userId]
      );

      const user = userResult.rows[0];

      if (user.points < product.point_cost) {
        await client.query('ROLLBACK');
        return res.status(400).json({
          error: 'Insufficient points',
          required: product.point_cost,
          current: user.points
        });
      }

      // Deduct points from user
      await client.query(
        'UPDATE users SET points = points - $1 WHERE id = $2',
        [product.point_cost, userId]
      );

      // Record purchase
      const purchaseResult = await client.query(
        `INSERT INTO purchases (user_id, product_id, product_name, points_spent)
         VALUES ($1, $2, $3, $4)
         RETURNING id, purchased_at`,
        [userId, product.id, product.name, product.point_cost]
      );

      await client.query('COMMIT');

      const purchase = purchaseResult.rows[0];

      // Send email notification (non-blocking)
      sendPurchaseNotification({
        userEmail: user.email,
        productName: product.name,
        pointsSpent: product.point_cost,
        remainingPoints: user.points - product.point_cost
      }).catch(err => console.error('Email notification failed:', err));

      res.json({
        message: 'Purchase successful',
        purchase: {
          id: purchase.id,
          productName: product.name,
          pointsSpent: product.point_cost,
          purchasedAt: purchase.purchased_at
        },
        remainingPoints: user.points - product.point_cost
      });
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  } catch (error) {
    console.error('Purchase error:', error);
    res.status(500).json({ error: 'Failed to complete purchase' });
  }
};
