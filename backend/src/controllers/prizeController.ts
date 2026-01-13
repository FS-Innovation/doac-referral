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

    // Get user's claims (check if they've EVER claimed each tier)
    const claimsResult = await pool.query(
      `SELECT DISTINCT tier_id,
              (SELECT claimed_at FROM user_prize_claims WHERE user_id = $1 AND tier_id = upc.tier_id ORDER BY claimed_at DESC LIMIT 1) as last_claimed_at,
              (SELECT COUNT(*) FROM user_prize_claims WHERE user_id = $1 AND tier_id = upc.tier_id) as claim_count
       FROM user_prize_claims upc
       WHERE upc.user_id = $1`,
      [userId]
    );

    const claimsMap = new Map(
      claimsResult.rows.map(claim => [
        claim.tier_id,
        { last_claimed_at: claim.last_claimed_at, claim_count: parseInt(claim.claim_count) }
      ])
    );

    // Build response with status for each tier
    // Status is based on CURRENT points, not claim history
    // Users can redeem the same prize multiple times
    const tiersWithStatus: PrizeTierWithStatus[] = tiersResult.rows.map((tier: PrizeTier) => {
      const claimHistory = claimsMap.get(tier.id);
      const progress = Math.min(100, Math.round((userPoints / tier.points_required) * 100));
      const hasClaimedBefore = claimHistory && claimHistory.claim_count > 0;

      // Status based on current points only (not claim history)
      let status: 'locked' | 'unlocked' | 'claimed';
      if (userPoints >= tier.points_required) {
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
        has_claimed_before: hasClaimedBefore || false,
        claim_count: claimHistory?.claim_count || 0,
        last_claimed_at: claimHistory?.last_claimed_at
      };
    });

    // Count eligible (unlocked) prizes
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

      // Users CAN redeem the same prize multiple times if they have enough points
      // No check for existing claims - that's intentional!

      // CRITICAL: Verify user has enough points
      if (userPoints < tier.points_required) {
        await client.query('ROLLBACK');
        return res.status(400).json({
          error: 'Insufficient points to redeem this prize',
          required: tier.points_required,
          current: userPoints
        });
      }

      // Note: Discount codes are handled by Klaviyo automation
      // We just send the reward tier event and Klaviyo sends the coupon
      const prizeCodeId = null;

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
        message: 'Prize redeemed successfully! Check your email for your reward.',
        prize: {
          tierNumber: tier.tier_number,
          name: tier.name,
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
