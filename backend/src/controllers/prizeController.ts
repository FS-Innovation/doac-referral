import { Response } from 'express';
import pool from '../config/database';
import { AuthRequest, PrizeTier, PrizeTierWithStatus } from '../types';

/**
 * Get all prize tiers with user's status for each
 * Returns: locked, unlocked, or claimed status plus progress percentage
 */
export const getPrizeTiers = async (req: AuthRequest, res: Response) => {
  const userId = req.user!.id;

  try {
    // Get user's current points
    const userResult = await pool.query(
      'SELECT points FROM users WHERE id = $1',
      [userId]
    );
    const userPoints = userResult.rows[0]?.points || 0;

    // Get all active tiers
    const tiersResult = await pool.query(
      `SELECT id, tier_number, name, description, points_required,
              prize_type, discount_percentage, is_mystery, is_active
       FROM prize_tiers
       WHERE is_active = true
       ORDER BY tier_number ASC`
    );

    // Get user's claims
    const claimsResult = await pool.query(
      `SELECT upc.tier_id, upc.claimed_at, pc.code
       FROM user_prize_claims upc
       LEFT JOIN prize_codes pc ON upc.prize_code_id = pc.id
       WHERE upc.user_id = $1`,
      [userId]
    );

    const claimsMap = new Map(
      claimsResult.rows.map(claim => [
        claim.tier_id,
        { claimed_at: claim.claimed_at, code: claim.code }
      ])
    );

    // Build response with status for each tier
    const tiersWithStatus: PrizeTierWithStatus[] = tiersResult.rows.map((tier: PrizeTier) => {
      const claim = claimsMap.get(tier.id);
      const progress = Math.min(100, Math.round((userPoints / tier.points_required) * 100));

      let status: 'locked' | 'unlocked' | 'claimed';
      if (claim) {
        status = 'claimed';
      } else if (userPoints >= tier.points_required) {
        status = 'unlocked';
      } else {
        status = 'locked';
      }

      // For mystery tiers, hide details until unlocked
      const displayName = tier.is_mystery && status === 'locked' ? '???' : tier.name;
      const displayDescription = tier.is_mystery && status === 'locked'
        ? 'Keep earning to discover this mystery prize...'
        : tier.description;

      return {
        ...tier,
        name: displayName,
        description: displayDescription,
        status,
        progress,
        claimed_code: claim?.code,
        claimed_at: claim?.claimed_at
      };
    });

    // Count eligible (unlocked but not claimed) prizes
    const eligibleCount = tiersWithStatus.filter(t => t.status === 'unlocked').length;

    res.json({
      tiers: tiersWithStatus,
      userPoints,
      eligibleCount
    });
  } catch (error) {
    console.error('Get prize tiers error:', error);
    res.status(500).json({ error: 'Failed to fetch prize tiers' });
  }
};

/**
 * Claim a prize tier (assigns a discount code to the user)
 * Does NOT deduct points - prizes are rewards for reaching milestones
 */
export const claimPrize = async (req: AuthRequest, res: Response) => {
  const { tierId } = req.params;
  const userId = req.user!.id;

  try {
    const client = await pool.connect();

    try {
      await client.query('BEGIN');

      // Get tier details
      const tierResult = await client.query(
        `SELECT id, tier_number, name, points_required, prize_type, is_mystery, is_active
         FROM prize_tiers WHERE id = $1`,
        [tierId]
      );

      if (tierResult.rows.length === 0) {
        await client.query('ROLLBACK');
        return res.status(404).json({ error: 'Prize tier not found' });
      }

      const tier = tierResult.rows[0];

      if (!tier.is_active) {
        await client.query('ROLLBACK');
        return res.status(400).json({ error: 'This prize tier is no longer available' });
      }

      // Check if already claimed
      const existingClaim = await client.query(
        'SELECT id FROM user_prize_claims WHERE user_id = $1 AND tier_id = $2',
        [userId, tierId]
      );

      if (existingClaim.rows.length > 0) {
        await client.query('ROLLBACK');
        return res.status(400).json({ error: 'You have already claimed this prize' });
      }

      // Get user's points
      const userResult = await client.query(
        'SELECT points FROM users WHERE id = $1',
        [userId]
      );
      const userPoints = userResult.rows[0]?.points || 0;

      if (userPoints < tier.points_required) {
        await client.query('ROLLBACK');
        return res.status(400).json({
          error: 'Insufficient points to claim this prize',
          required: tier.points_required,
          current: userPoints
        });
      }

      // For discount code prizes, assign an available code
      let assignedCode = null;
      let prizeCodeId = null;

      if (tier.prize_type === 'discount_code' || tier.prize_type === 'mystery') {
        // Find an unclaimed code for this tier
        const codeResult = await client.query(
          `SELECT id, code FROM prize_codes
           WHERE tier_id = $1 AND claimed_by IS NULL
           ORDER BY created_at ASC
           LIMIT 1
           FOR UPDATE SKIP LOCKED`,
          [tierId]
        );

        if (codeResult.rows.length === 0) {
          await client.query('ROLLBACK');
          return res.status(400).json({
            error: 'No codes available for this prize. Please contact support.'
          });
        }

        const prizeCode = codeResult.rows[0];
        prizeCodeId = prizeCode.id;
        assignedCode = prizeCode.code;

        // Mark code as claimed
        await client.query(
          `UPDATE prize_codes
           SET claimed_by = $1, claimed_at = CURRENT_TIMESTAMP
           WHERE id = $2`,
          [userId, prizeCodeId]
        );
      }

      // Record the claim
      await client.query(
        `INSERT INTO user_prize_claims (user_id, tier_id, prize_code_id, points_at_claim)
         VALUES ($1, $2, $3, $4)`,
        [userId, tierId, prizeCodeId, userPoints]
      );

      await client.query('COMMIT');

      res.json({
        message: 'Prize claimed successfully!',
        prize: {
          tierNumber: tier.tier_number,
          name: tier.name,
          code: assignedCode,
          isMystery: tier.is_mystery
        }
      });
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  } catch (error) {
    console.error('Claim prize error:', error);
    res.status(500).json({ error: 'Failed to claim prize' });
  }
};

/**
 * Get user's claimed prizes history
 */
export const getClaimedPrizes = async (req: AuthRequest, res: Response) => {
  const userId = req.user!.id;

  try {
    const result = await pool.query(
      `SELECT upc.id, upc.claimed_at, upc.points_at_claim,
              pt.tier_number, pt.name, pt.description, pt.prize_type, pt.is_mystery,
              pc.code, pc.expires_at, pc.is_used
       FROM user_prize_claims upc
       JOIN prize_tiers pt ON upc.tier_id = pt.id
       LEFT JOIN prize_codes pc ON upc.prize_code_id = pc.id
       WHERE upc.user_id = $1
       ORDER BY upc.claimed_at DESC`,
      [userId]
    );

    res.json({
      claims: result.rows.map(claim => ({
        id: claim.id,
        tierNumber: claim.tier_number,
        name: claim.name,
        description: claim.description,
        prizeType: claim.prize_type,
        isMystery: claim.is_mystery,
        code: claim.code,
        expiresAt: claim.expires_at,
        isUsed: claim.is_used,
        claimedAt: claim.claimed_at,
        pointsAtClaim: claim.points_at_claim
      }))
    });
  } catch (error) {
    console.error('Get claimed prizes error:', error);
    res.status(500).json({ error: 'Failed to fetch claimed prizes' });
  }
};
