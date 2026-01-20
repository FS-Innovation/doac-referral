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

// ============================================================================
// WINNER VERIFICATION - Forensic analysis for prize verification
// ============================================================================

// Get leaderboard with fraud indicators
export const getLeaderboard = async (req: AuthRequest, res: Response) => {
  try {
    const limit = parseInt(req.query.limit as string) || 50;

    const result = await pool.query(`
      SELECT
        u.id,
        u.email,
        u.referral_code,
        u.points,
        u.email_verified,
        u.created_at,
        COUNT(DISTINCT pa.id) as total_awards,
        COUNT(DISTINCT CASE WHEN pa.was_awarded THEN pa.id END) as successful_awards,
        COUNT(DISTINCT pa.clicker_device_fp) as unique_devices,
        COUNT(DISTINCT pa.clicker_ip) as unique_ips,
        AVG(pa.bot_score) as avg_bot_score,
        MIN(pa.bot_score) as min_bot_score,
        AVG(pa.time_on_page_ms) as avg_time_on_page,
        COUNT(DISTINCT pa.hour_of_day) as active_hours,
        COUNT(CASE WHEN pa.bot_score < 50 THEN 1 END) as low_bot_score_count,
        COUNT(CASE WHEN pa.time_on_page_ms < 2000 THEN 1 END) as fast_click_count,
        COUNT(CASE WHEN pa.fraud_flags IS NOT NULL AND array_length(pa.fraud_flags, 1) > 0 THEN 1 END) as flagged_click_count
      FROM users u
      LEFT JOIN point_awards pa ON u.id = pa.user_id
      WHERE u.points > 0
      GROUP BY u.id
      ORDER BY u.points DESC
      LIMIT $1
    `, [limit]);

    // Calculate fraud risk score for each user
    const leaderboard = result.rows.map(user => {
      let riskScore = 0;
      const riskFactors: string[] = [];

      // High points but few unique devices = suspicious
      const deviceRatio = user.unique_devices / Math.max(1, user.successful_awards);
      if (deviceRatio < 0.3 && user.successful_awards > 10) {
        riskScore += 30;
        riskFactors.push(`Low device diversity (${Math.round(deviceRatio * 100)}%)`);
      }

      // Low average bot score
      if (user.avg_bot_score && user.avg_bot_score < 60) {
        riskScore += 25;
        riskFactors.push(`Low avg bot score (${Math.round(user.avg_bot_score)})`);
      }

      // Fast average click time
      if (user.avg_time_on_page && user.avg_time_on_page < 3000) {
        riskScore += 20;
        riskFactors.push(`Fast avg clicks (${Math.round(user.avg_time_on_page)}ms)`);
      }

      // Many flagged clicks
      const flaggedRatio = user.flagged_click_count / Math.max(1, user.total_awards);
      if (flaggedRatio > 0.2) {
        riskScore += 25;
        riskFactors.push(`High flag rate (${Math.round(flaggedRatio * 100)}%)`);
      }

      // Limited active hours (bot-like)
      if (user.active_hours && user.active_hours < 4 && user.successful_awards > 20) {
        riskScore += 15;
        riskFactors.push(`Limited active hours (${user.active_hours})`);
      }

      return {
        id: user.id,
        email: user.email,
        referralCode: user.referral_code,
        points: user.points,
        emailVerified: user.email_verified,
        createdAt: user.created_at,
        stats: {
          totalAwards: parseInt(user.total_awards) || 0,
          successfulAwards: parseInt(user.successful_awards) || 0,
          uniqueDevices: parseInt(user.unique_devices) || 0,
          uniqueIps: parseInt(user.unique_ips) || 0,
          avgBotScore: Math.round(user.avg_bot_score) || null,
          avgTimeOnPage: Math.round(user.avg_time_on_page) || null,
          activeHours: parseInt(user.active_hours) || 0,
          lowBotScoreCount: parseInt(user.low_bot_score_count) || 0,
          fastClickCount: parseInt(user.fast_click_count) || 0,
          flaggedClickCount: parseInt(user.flagged_click_count) || 0
        },
        riskAssessment: {
          score: Math.min(100, riskScore),
          level: riskScore >= 50 ? 'high' : riskScore >= 25 ? 'medium' : 'low',
          factors: riskFactors
        }
      };
    });

    res.json({ leaderboard });
  } catch (error) {
    console.error('Get leaderboard error:', error);
    res.status(500).json({ error: 'Failed to fetch leaderboard' });
  }
};

// Get detailed forensic analysis for a specific user
export const verifyWinner = async (req: AuthRequest, res: Response) => {
  const { userId } = req.params;

  try {
    // 1. Basic user info
    const userResult = await pool.query(`
      SELECT id, email, referral_code, points, email_verified, created_at
      FROM users WHERE id = $1
    `, [userId]);

    if (userResult.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    const user = userResult.rows[0];

    // 2. Device diversity analysis
    const deviceAnalysis = await pool.query(`
      SELECT
        COUNT(DISTINCT clicker_device_fp) as unique_devices,
        COUNT(DISTINCT clicker_ip) as unique_ips,
        COUNT(*) as total_awards,
        COUNT(CASE WHEN was_awarded THEN 1 END) as successful_awards
      FROM point_awards
      WHERE user_id = $1
    `, [userId]);

    // 3. Top devices (should be many unique ones)
    const topDevices = await pool.query(`
      SELECT
        clicker_device_fp,
        COUNT(*) as click_count,
        COUNT(CASE WHEN was_awarded THEN 1 END) as awarded_count,
        MIN(click_timestamp) as first_seen,
        MAX(click_timestamp) as last_seen
      FROM point_awards
      WHERE user_id = $1 AND clicker_device_fp IS NOT NULL
      GROUP BY clicker_device_fp
      ORDER BY click_count DESC
      LIMIT 20
    `, [userId]);

    // 4. Time-of-day distribution (bots often click 24/7)
    const hourDistribution = await pool.query(`
      SELECT
        hour_of_day,
        COUNT(*) as click_count,
        AVG(time_on_page_ms) as avg_time_on_page
      FROM point_awards
      WHERE user_id = $1
      GROUP BY hour_of_day
      ORDER BY hour_of_day
    `, [userId]);

    // 5. Bot score distribution
    const botScoreDistribution = await pool.query(`
      SELECT
        CASE
          WHEN bot_score >= 80 THEN '80-100 (Good)'
          WHEN bot_score >= 60 THEN '60-79 (OK)'
          WHEN bot_score >= 40 THEN '40-59 (Suspicious)'
          ELSE '0-39 (Bot)'
        END as score_range,
        COUNT(*) as count
      FROM point_awards
      WHERE user_id = $1
      GROUP BY score_range
      ORDER BY score_range DESC
    `, [userId]);

    // 6. Fraud flags summary
    const fraudFlags = await pool.query(`
      SELECT
        unnest(fraud_flags) as flag,
        COUNT(*) as count
      FROM point_awards
      WHERE user_id = $1 AND fraud_flags IS NOT NULL
      GROUP BY flag
      ORDER BY count DESC
    `, [userId]);

    // 7. Cross-user device analysis (CRITICAL - same device earning for multiple users)
    const crossUserDevices = await pool.query(`
      SELECT
        pa2.user_id as other_user_id,
        u.email as other_user_email,
        COUNT(*) as shared_device_clicks
      FROM point_awards pa1
      JOIN point_awards pa2 ON pa1.clicker_device_fp = pa2.clicker_device_fp
      JOIN users u ON pa2.user_id = u.id
      WHERE pa1.user_id = $1
        AND pa2.user_id != $1
        AND pa1.clicker_device_fp IS NOT NULL
      GROUP BY pa2.user_id, u.email
      HAVING COUNT(*) > 2
      ORDER BY shared_device_clicks DESC
      LIMIT 10
    `, [userId]);

    // 8. Platform distribution
    const platformDistribution = await pool.query(`
      SELECT
        platform,
        COUNT(*) as count
      FROM point_awards
      WHERE user_id = $1
      GROUP BY platform
    `, [userId]);

    // 9. Recent clicks sample (for manual review)
    const recentClicks = await pool.query(`
      SELECT
        clicker_device_fp,
        clicker_ip,
        bot_score,
        time_on_page_ms,
        platform,
        was_awarded,
        fraud_flags,
        click_timestamp
      FROM point_awards
      WHERE user_id = $1
      ORDER BY click_timestamp DESC
      LIMIT 50
    `, [userId]);

    // Calculate overall legitimacy score
    const stats = deviceAnalysis.rows[0];
    const deviceRatio = parseInt(stats.unique_devices) / Math.max(1, parseInt(stats.successful_awards));
    const crossUserIssues = crossUserDevices.rows.length;

    let legitimacyScore = 100;
    const concerns: string[] = [];
    const positives: string[] = [];

    // Positive signals
    if (deviceRatio > 0.7) {
      positives.push(`High device diversity (${Math.round(deviceRatio * 100)}%)`);
    }
    if (hourDistribution.rows.length >= 8) {
      positives.push(`Natural hour distribution (${hourDistribution.rows.length} active hours)`);
    }
    if (user.email_verified) {
      positives.push('Email verified');
    }

    // Concerns
    if (deviceRatio < 0.3) {
      legitimacyScore -= 30;
      concerns.push(`Low device diversity (${Math.round(deviceRatio * 100)}% unique)`);
    }
    if (crossUserIssues > 0) {
      legitimacyScore -= crossUserIssues * 15;
      concerns.push(`Devices shared with ${crossUserIssues} other users`);
    }
    if (hourDistribution.rows.length < 4) {
      legitimacyScore -= 20;
      concerns.push(`Limited active hours (${hourDistribution.rows.length})`);
    }
    if (fraudFlags.rows.length > 0) {
      const totalFlags = fraudFlags.rows.reduce((sum: number, row: any) => sum + parseInt(row.count), 0);
      legitimacyScore -= Math.min(30, totalFlags);
      concerns.push(`${totalFlags} fraud flags detected`);
    }

    res.json({
      user: {
        id: user.id,
        email: user.email,
        referralCode: user.referral_code,
        points: user.points,
        emailVerified: user.email_verified,
        createdAt: user.created_at
      },
      summary: {
        totalAwards: parseInt(stats.total_awards),
        successfulAwards: parseInt(stats.successful_awards),
        uniqueDevices: parseInt(stats.unique_devices),
        uniqueIps: parseInt(stats.unique_ips),
        deviceRatio: Math.round(deviceRatio * 100)
      },
      legitimacyAssessment: {
        score: Math.max(0, legitimacyScore),
        verdict: legitimacyScore >= 70 ? 'LIKELY LEGITIMATE' : legitimacyScore >= 40 ? 'NEEDS REVIEW' : 'SUSPICIOUS',
        concerns,
        positives
      },
      analysis: {
        topDevices: topDevices.rows.map(d => ({
          deviceFp: d.clicker_device_fp?.substring(0, 16) + '...',
          clickCount: parseInt(d.click_count),
          awardedCount: parseInt(d.awarded_count),
          firstSeen: d.first_seen,
          lastSeen: d.last_seen
        })),
        hourDistribution: hourDistribution.rows.map(h => ({
          hour: parseInt(h.hour_of_day),
          clicks: parseInt(h.click_count),
          avgTimeOnPage: Math.round(h.avg_time_on_page)
        })),
        botScoreDistribution: botScoreDistribution.rows,
        platformDistribution: platformDistribution.rows,
        fraudFlags: fraudFlags.rows,
        crossUserDevices: crossUserDevices.rows.map(c => ({
          otherUserId: c.other_user_id,
          otherUserEmail: c.other_user_email,
          sharedClicks: parseInt(c.shared_device_clicks)
        }))
      },
      recentClicks: recentClicks.rows.map(c => ({
        deviceFp: c.clicker_device_fp?.substring(0, 12) + '...',
        ip: c.clicker_ip,
        botScore: c.bot_score,
        timeOnPage: c.time_on_page_ms,
        platform: c.platform,
        wasAwarded: c.was_awarded,
        fraudFlags: c.fraud_flags,
        timestamp: c.click_timestamp
      }))
    });
  } catch (error) {
    console.error('Verify winner error:', error);
    res.status(500).json({ error: 'Failed to verify winner' });
  }
};
