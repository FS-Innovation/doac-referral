import { Response } from 'express';
import pool from '../config/database';
import { AuthRequest, PrizeTier, PrizeTierWithStatus } from '../types';

/**
 * Klaviyo API integration for prize redemption events
 * Sends event to Klaviyo to trigger automated email with discount code
 */
async function sendKlaviyoRedemptionEvent(
  userEmail: string,
  rewardTierCode: string,
  discountPercentage: number | null,
  prizeName: string
): Promise<boolean> {
  const klaviyoApiKey = process.env.KLAVIYO_API_KEY;

  if (!klaviyoApiKey) {
    console.error('KLAVIYO_API_KEY not configured - skipping Klaviyo event');
    return false;
  }

  try {
    const response = await fetch('https://a.klaviyo.com/api/events', {
      method: 'POST',
      headers: {
        'Authorization': `Klaviyo-API-Key ${klaviyoApiKey}`,
        'Content-Type': 'application/json',
        'revision': '2023-06-15'
      },
      body: JSON.stringify({
        data: {
          type: 'event',
          attributes: {
            profile: {
              $email: userEmail
            },
            metric: {
              name: 'Perks Reward Redeemed'
            },
            properties: {
              reward_tier: rewardTierCode,
              discount_percent: discountPercentage,
              prize_name: prizeName
            }
          }
        }
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Klaviyo API error:', response.status, errorText);
      return false;
    }

    console.log(`Klaviyo event sent successfully for ${userEmail} - ${rewardTierCode}`);
    return true;
  } catch (error) {
    console.error('Klaviyo API request failed:', error);
    return false;
  }
}

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
              prize_type, discount_percentage, reward_tier_code, is_mystery, is_active
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
 * Redeem a prize tier
 * - Validates user has enough points
 * - Deducts points from user's balance
 * - Assigns discount code if applicable
 * - Sends Klaviyo event to trigger email with coupon
 *
 * SECURITY: All validation happens server-side. Points are deducted atomically.
 */
export const claimPrize = async (req: AuthRequest, res: Response) => {
  const { tierId } = req.params;
  const userId = req.user!.id;

  // Validate tierId is a number
  const tierIdNum = parseInt(tierId, 10);
  if (isNaN(tierIdNum) || tierIdNum <= 0) {
    return res.status(400).json({ error: 'Invalid prize tier ID' });
  }

  try {
    const client = await pool.connect();

    try {
      await client.query('BEGIN');

      // Lock the user row to prevent race conditions on points
      const userResult = await client.query(
        'SELECT id, points, email FROM users WHERE id = $1 FOR UPDATE',
        [userId]
      );

      if (userResult.rows.length === 0) {
        await client.query('ROLLBACK');
        return res.status(404).json({ error: 'User not found' });
      }

      const userPoints = userResult.rows[0].points;
      const actualEmail = userResult.rows[0].email;

      // Get tier details with lock
      const tierResult = await client.query(
        `SELECT id, tier_number, name, description, points_required, prize_type,
                discount_percentage, reward_tier_code, is_mystery, is_active
         FROM prize_tiers WHERE id = $1 FOR UPDATE`,
        [tierIdNum]
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
        [userId, tierIdNum]
      );

      if (existingClaim.rows.length > 0) {
        await client.query('ROLLBACK');
        return res.status(400).json({ error: 'You have already redeemed this prize' });
      }

      // CRITICAL: Verify user has enough points
      if (userPoints < tier.points_required) {
        await client.query('ROLLBACK');
        return res.status(400).json({
          error: 'Insufficient points to redeem this prize',
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
          [tierIdNum]
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

      // CRITICAL: Deduct points from user's balance
      await client.query(
        'UPDATE users SET points = points - $1 WHERE id = $2',
        [tier.points_required, userId]
      );

      // Record the claim with points spent
      await client.query(
        `INSERT INTO user_prize_claims (user_id, tier_id, prize_code_id, points_spent, points_at_claim, klaviyo_event_sent)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [userId, tierIdNum, prizeCodeId, tier.points_required, userPoints, false]
      );

      await client.query('COMMIT');

      // Send Klaviyo event AFTER successful commit (don't rollback on Klaviyo failure)
      let klaviyoSent = false;
      if (tier.reward_tier_code) {
        klaviyoSent = await sendKlaviyoRedemptionEvent(
          actualEmail,
          tier.reward_tier_code,
          tier.discount_percentage,
          tier.name
        );

        // Update klaviyo_event_sent status (non-critical, don't fail if this fails)
        if (klaviyoSent) {
          try {
            await pool.query(
              `UPDATE user_prize_claims
               SET klaviyo_event_sent = true
               WHERE user_id = $1 AND tier_id = $2`,
              [userId, tierIdNum]
            );
          } catch (updateError) {
            console.error('Failed to update klaviyo_event_sent:', updateError);
          }
        }
      }

      // Calculate new points balance
      const newPointsBalance = userPoints - tier.points_required;

      res.json({
        message: 'Prize redeemed successfully!',
        prize: {
          tierNumber: tier.tier_number,
          name: tier.name,
          code: assignedCode,
          isMystery: tier.is_mystery,
          rewardTier: tier.reward_tier_code
        },
        pointsSpent: tier.points_required,
        newPointsBalance,
        klaviyoEventSent: klaviyoSent
      });
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  } catch (error) {
    console.error('Claim prize error:', error);
    res.status(500).json({ error: 'Failed to redeem prize' });
  }
};

/**
 * Get user's claimed prizes history
 */
export const getClaimedPrizes = async (req: AuthRequest, res: Response) => {
  const userId = req.user!.id;

  try {
    const result = await pool.query(
      `SELECT upc.id, upc.claimed_at, upc.points_at_claim, upc.points_spent,
              pt.tier_number, pt.name, pt.description, pt.prize_type, pt.is_mystery,
              pt.reward_tier_code,
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
        rewardTier: claim.reward_tier_code,
        code: claim.code,
        expiresAt: claim.expires_at,
        isUsed: claim.is_used,
        claimedAt: claim.claimed_at,
        pointsAtClaim: claim.points_at_claim,
        pointsSpent: claim.points_spent
      }))
    });
  } catch (error) {
    console.error('Get claimed prizes error:', error);
    res.status(500).json({ error: 'Failed to fetch claimed prizes' });
  }
};
