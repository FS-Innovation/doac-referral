import { Request, Response } from 'express';
import pool from '../config/database';
import redisClient from '../config/redis';

// ============================================================================
// CAPS CONFIGURATION (Lenient for legitimate users, protective against abuse)
// ============================================================================
const CAPS = {
  // Per-code daily limit: Allows viral sharing but prevents single-code abuse
  CODE_DAILY: 100,
  // Per-user daily limit: Encourages sustained sharing over time
  USER_DAILY: 75,
  // Per-user lifetime limit: High ceiling for genuine sharers
  USER_LIFETIME: 2500,
  // Minimum time on page (ms): Blocks instant bot clicks
  MIN_TIME_ON_PAGE: 1500,
  // Minimum bot score to allow: Blocks obvious bots
  MIN_BOT_SCORE: 40,
  // IP velocity: Max different codes an IP can click per hour (catches click farms)
  IP_VELOCITY_MAX: 30
};

// ============================================================================
// HELPER: Validate execution proof from client
// ============================================================================
const validateExecutionProof = (proofJson: string): { valid: boolean; reason?: string } => {
  try {
    const proof = JSON.parse(proofJson);

    // Check timestamp freshness (must be within 60 seconds)
    const age = Date.now() - proof.timestamp;
    if (age > 60000 || age < -5000) {
      return { valid: false, reason: 'stale_timestamp' };
    }

    // Check execution timing (real browsers take 1-100ms for the work loop)
    if (proof.duration < 0.1 || proof.duration > 500) {
      return { valid: false, reason: 'invalid_timing' };
    }

    // Check browser environment
    if (!proof.hasWebGL && !proof.hasCanvas2D) {
      return { valid: false, reason: 'missing_browser_apis' };
    }

    if (!proof.screenConsistent) {
      return { valid: false, reason: 'screen_inconsistent' };
    }

    if (proof.languageCount === 0) {
      return { valid: false, reason: 'no_languages' };
    }

    return { valid: true };
  } catch (e) {
    return { valid: false, reason: 'invalid_proof_format' };
  }
};

// ============================================================================
// HELPER: Check and update caps
// ============================================================================
const checkCaps = async (userId: number, referralCode: string): Promise<{ allowed: boolean; reason?: string }> => {
  const today = new Date().toISOString().split('T')[0];

  // Check user daily cap
  const userDailyKey = `cap:user:${userId}:${today}`;
  const userDaily = parseInt(await redisClient.get(userDailyKey) || '0', 10);
  if (userDaily >= CAPS.USER_DAILY) {
    return { allowed: false, reason: `user_daily_cap:${userDaily}/${CAPS.USER_DAILY}` };
  }

  // Check code daily cap
  const codeDailyKey = `cap:code:${referralCode}:${today}`;
  const codeDaily = parseInt(await redisClient.get(codeDailyKey) || '0', 10);
  if (codeDaily >= CAPS.CODE_DAILY) {
    return { allowed: false, reason: `code_daily_cap:${codeDaily}/${CAPS.CODE_DAILY}` };
  }

  // Check user lifetime cap (from database for accuracy)
  const lifetimeResult = await pool.query(
    'SELECT points FROM users WHERE id = $1',
    [userId]
  );
  const lifetimePoints = lifetimeResult.rows[0]?.points || 0;
  if (lifetimePoints >= CAPS.USER_LIFETIME) {
    return { allowed: false, reason: `user_lifetime_cap:${lifetimePoints}/${CAPS.USER_LIFETIME}` };
  }

  return { allowed: true };
};

// ============================================================================
// HELPER: Increment caps after successful award
// ============================================================================
const incrementCaps = async (userId: number, referralCode: string): Promise<void> => {
  const today = new Date().toISOString().split('T')[0];

  // Increment user daily (24h expiry)
  const userDailyKey = `cap:user:${userId}:${today}`;
  await redisClient.incr(userDailyKey);
  await redisClient.expire(userDailyKey, 86400);

  // Increment code daily (24h expiry)
  const codeDailyKey = `cap:code:${referralCode}:${today}`;
  await redisClient.incr(codeDailyKey);
  await redisClient.expire(codeDailyKey, 86400);
};

// ============================================================================
// HELPER: Check IP velocity (catches click farms)
// ============================================================================
const checkIpVelocity = async (ipAddress: string, referralCode: string): Promise<{ allowed: boolean; reason?: string }> => {
  const hourBucket = new Date().toISOString().slice(0, 13); // YYYY-MM-DDTHH
  const velocityKey = `velocity:ip:${ipAddress}:${hourBucket}`;

  // Add this code to the set of codes clicked by this IP
  await redisClient.sadd(velocityKey, referralCode);
  await redisClient.expire(velocityKey, 3600);

  // Check how many different codes this IP has clicked
  const uniqueCodes = await redisClient.scard(velocityKey);

  if (uniqueCodes > CAPS.IP_VELOCITY_MAX) {
    return { allowed: false, reason: `ip_velocity:${uniqueCodes}/${CAPS.IP_VELOCITY_MAX}` };
  }

  return { allowed: true };
};

// ============================================================================
// HELPER: Log forensic data for winner verification
// ============================================================================
const logForensicData = async (data: {
  userId: number;
  referralCode: string;
  deviceId: string;
  deviceFingerprint: string;
  browserFingerprint: string;
  ipAddress: string;
  userAgent: string;
  botScore: number;
  botSignals: string[];
  execProof: any;
  timeOnPageMs: number;
  clickTimestamp: Date;
  platform: string;
  episodeId: number | null;
  fraudFlags: string[];
  confidenceScore: number;
  wasAwarded: boolean;
  blockReason: string | null;
}): Promise<void> => {
  try {
    const now = new Date();
    await pool.query(
      `INSERT INTO point_awards (
        user_id, referral_code,
        clicker_device_id, clicker_device_fp, clicker_browser_fp, clicker_ip, clicker_user_agent,
        bot_score, bot_signals,
        exec_duration_ms, exec_has_webgl, exec_has_audio, exec_screen_consistent,
        time_on_page_ms, click_timestamp, award_timestamp,
        platform, episode_id,
        fraud_flags, confidence_score, was_awarded, block_reason,
        hour_of_day, day_of_week
      ) VALUES (
        $1, $2,
        $3, $4, $5, $6, $7,
        $8, $9,
        $10, $11, $12, $13,
        $14, $15, $16,
        $17, $18,
        $19, $20, $21, $22,
        $23, $24
      )`,
      [
        data.userId, data.referralCode,
        data.deviceId, data.deviceFingerprint, data.browserFingerprint, data.ipAddress, data.userAgent,
        data.botScore, data.botSignals.length > 0 ? data.botSignals : null,
        data.execProof?.duration || null, data.execProof?.hasWebGL || null, data.execProof?.hasAudio || null, data.execProof?.screenConsistent || null,
        data.timeOnPageMs, data.clickTimestamp, now,
        data.platform, data.episodeId,
        data.fraudFlags.length > 0 ? data.fraudFlags : null, data.confidenceScore, data.wasAwarded, data.blockReason,
        now.getHours(), now.getDay()
      ]
    );
  } catch (error) {
    // Non-critical - log but don't fail the request
    console.error('Failed to log forensic data:', error);
  }
};

// ============================================================================
// TRACK REFERRAL CLICK (Step 1: When someone clicks a referral link)
// ============================================================================
export const trackReferralClick = async (req: Request, res: Response) => {
  const { code } = req.params;

  try {
    // Check Redis cache for referral code first (performance optimization)
    const cacheKey = `referral:${code}`;
    const cachedUserId = await redisClient.get(cacheKey);

    let userId: number;

    if (cachedUserId) {
      userId = parseInt(cachedUserId, 10);
    } else {
      const userResult = await pool.query(
        'SELECT id, redirect_platform FROM users WHERE referral_code = $1',
        [code]
      );

      if (userResult.rows.length === 0) {
        return res.status(404).json({ error: 'Invalid referral code' });
      }

      userId = userResult.rows[0].id;
      await redisClient.setex(cacheKey, 3600, userId.toString());
    }

    // Get request metadata
    const ipAddress = req.ip || req.socket.remoteAddress || 'unknown';
    const userAgent = req.get('user-agent') || 'unknown';

    // Get fingerprints from headers
    const deviceId = req.get('x-device-id') || '';
    const deviceFingerprint = req.get('x-device-fingerprint') || '';
    const browserFingerprint = req.get('x-browser-fingerprint') || '';
    const botScore = parseInt(req.get('x-bot-score') || '100', 10);
    const botSignals = (req.get('x-bot-signals') || '').split(',').filter(s => s);
    const execProofJson = req.get('x-exec-proof') || '{}';

    let skipPointsAward = req.body.skipPointsAward === true;
    let selfClickReason = '';
    let matchScore = 0;
    const fraudFlags: string[] = [];
    let confidenceScore = 100;

    // ========================================================================
    // FRAUD CHECK 1: Bot Detection
    // ========================================================================
    if (botScore < CAPS.MIN_BOT_SCORE) {
      fraudFlags.push(`bot_detected:score=${botScore}`);
      confidenceScore -= (CAPS.MIN_BOT_SCORE - botScore);
      console.warn(`🤖 Bot detected: score=${botScore}, signals=${botSignals.join(',')}`);
      // Don't block yet, let other checks accumulate
    }

    // ========================================================================
    // FRAUD CHECK 2: Execution Proof Validation
    // ========================================================================
    const execProofResult = validateExecutionProof(execProofJson);
    let execProof: any = {};
    try {
      execProof = JSON.parse(execProofJson);
    } catch (e) {}

    if (!execProofResult.valid) {
      fraudFlags.push(`invalid_exec_proof:${execProofResult.reason}`);
      confidenceScore -= 20;
      console.warn(`⚠️ Invalid execution proof: ${execProofResult.reason}`);
    }

    // ========================================================================
    // FRAUD CHECK 3: Empty Device ID (requires server-side fallback)
    // ========================================================================
    let effectiveDeviceId = deviceId;
    if (!deviceId || deviceId.length < 10) {
      // Generate a server-side temporary ID for this session
      const crypto = require('crypto');
      effectiveDeviceId = crypto.createHash('sha256')
        .update(`${ipAddress}:${userAgent}:${Date.now()}`)
        .digest('hex').substring(0, 36);
      fraudFlags.push('empty_device_id:server_generated');
      confidenceScore -= 10;
    }

    // ========================================================================
    // FRAUD CHECK 4: Self-Click Detection (Multi-Factor Matching)
    // ========================================================================
    // Check Redis cache
    const ownerDeviceId = await redisClient.get(`user:${userId}:deviceid`);
    const ownerDeviceFp = await redisClient.get(`user:${userId}:devicefp`);
    const ownerBrowserFp = await redisClient.get(`user:${userId}:browserfp`);
    const ownerIp = await redisClient.get(`user:${userId}:ip`);

    // Check database for persistent fingerprints
    let ownerFingerprints: any[] = [];
    try {
      const fpResult = await pool.query(
        `SELECT device_id, device_fingerprint, browser_fingerprint, ip_address, last_seen
         FROM user_fingerprints
         WHERE user_id = $1 AND last_seen > NOW() - INTERVAL '90 days'
         ORDER BY last_seen DESC`,
        [userId]
      );
      ownerFingerprints = fpResult.rows;
    } catch (error) {
      console.error('Error querying user fingerprints:', error);
    }

    // Multi-factor matching
    const checkMatch = (storedDeviceId: string | null, storedDeviceFp: string | null, storedBrowserFp: string | null, storedIp: string | null) => {
      let score = 0;
      const reasons: string[] = [];

      // Device ID match = definitive same device
      if (effectiveDeviceId && storedDeviceId && effectiveDeviceId === storedDeviceId) {
        score += 100;
        reasons.push('Device ID match');
        return { score, reasons };
      }

      // Device fingerprint (hardware)
      if (deviceFingerprint && storedDeviceFp && deviceFingerprint === storedDeviceFp) {
        score += 50;
        reasons.push('Device fingerprint match');
      }

      // Browser fingerprint (software)
      if (browserFingerprint && storedBrowserFp && browserFingerprint === storedBrowserFp) {
        score += 30;
        reasons.push('Browser fingerprint match');
      }

      // IP as tiebreaker only
      if (storedIp && ipAddress && storedIp === ipAddress && score > 0) {
        score += 10;
        reasons.push('IP match (tiebreaker)');
      }

      return { score, reasons };
    };

    // Check Redis first
    const redisMatch = checkMatch(ownerDeviceId, ownerDeviceFp, ownerBrowserFp, ownerIp);
    if (redisMatch.score >= 80) {
      matchScore = redisMatch.score;
      selfClickReason = `Redis: ${redisMatch.reasons.join(' + ')}`;
    }

    // Check database if Redis didn't find match
    if (!selfClickReason && ownerFingerprints.length > 0) {
      for (const fp of ownerFingerprints) {
        const dbMatch = checkMatch(fp.device_id, fp.device_fingerprint, fp.browser_fingerprint, fp.ip_address);
        if (dbMatch.score >= 80) {
          matchScore = dbMatch.score;
          selfClickReason = `Database: ${dbMatch.reasons.join(' + ')}`;
          break;
        }
      }
    }

    if (selfClickReason) {
      fraudFlags.push(`self_click:${selfClickReason}`);
      skipPointsAward = true;
      confidenceScore = 0;
      console.warn(`🚨 SELF-CLICK DETECTED: User ${userId}, Score: ${matchScore}, Reason: ${selfClickReason}`);
    }

    // ========================================================================
    // FRAUD CHECK 5: IP Velocity (catches click farms)
    // ========================================================================
    const velocityCheck = await checkIpVelocity(ipAddress, code);
    if (!velocityCheck.allowed) {
      fraudFlags.push(velocityCheck.reason!);
      confidenceScore -= 30;
      console.warn(`🚨 IP velocity exceeded: ${velocityCheck.reason}`);
    }

    // ========================================================================
    // Record click in database
    // ========================================================================
    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      const episodeId = req.body.episodeId || null;

      await client.query(
        `INSERT INTO referral_clicks
          (user_id, ip_address, user_agent, device_id, device_fingerprint, browser_fingerprint, fraud_flags, points_awarded, episode_id)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
        [
          userId,
          ipAddress,
          userAgent,
          effectiveDeviceId,
          deviceFingerprint || null,
          browserFingerprint || null,
          fraudFlags.length > 0 ? fraudFlags : null,
          false, // Points pending platform selection
          episodeId
        ]
      );

      await client.query('COMMIT');

      // Store pending click data in Redis (10 min TTL)
      const pendingClickKey = `pending:${code}:${effectiveDeviceId}`;
      await redisClient.setex(
        pendingClickKey,
        600,
        JSON.stringify({
          userId,
          referralCode: code,
          skipPointsAward,
          fraudFlags,
          confidenceScore,
          deviceId: effectiveDeviceId,
          deviceFingerprint,
          browserFingerprint,
          ipAddress,
          userAgent,
          botScore,
          botSignals,
          execProof,
          clickTimestamp: new Date().toISOString()
        })
      );

      console.log(`📝 Click recorded for code ${code} (confidence: ${confidenceScore}%, fraud_flags: ${fraudFlags.length})`);

      res.json({
        success: true,
        message: 'Click tracked successfully'
      });
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

// ============================================================================
// GET SETTINGS (Platform URLs for landing page)
// ============================================================================
export const getSettings = async (_req: Request, res: Response) => {
  try {
    const settingsResult = await pool.query(
      `SELECT key, value FROM settings WHERE key IN ('redirect_url', 'redirect_url_spotify', 'redirect_url_apple')`
    );

    const settings: Record<string, string> = {};
    settingsResult.rows.forEach(row => {
      settings[row.key] = row.value;
    });

    const youtubeUrl = settings['redirect_url'] || null;
    const spotifyUrl = settings['redirect_url_spotify'] || null;
    const appleUrl = settings['redirect_url_apple'] || null;

    const metadataResult = await pool.query(
      `SELECT platform, title, description, thumbnail_url, duration, channel_name, view_count
       FROM video_metadata
       WHERE platform IN ('youtube', 'spotify', 'apple')
       ORDER BY platform`
    );

    const metadata: Record<string, any> = {};
    metadataResult.rows.forEach(row => {
      metadata[row.platform] = {
        title: row.title,
        description: row.description,
        thumbnail: row.thumbnail_url,
        duration: row.duration,
        channel: row.channel_name,
        views: row.view_count
      };
    });

    res.json({
      youtubeUrl,
      spotifyUrl,
      appleUrl,
      youtube: metadata['youtube'] || null,
      spotify: metadata['spotify'] || null,
      apple: metadata['apple'] || null
    });
  } catch (error) {
    console.error('Get settings error:', error);
    res.status(500).json({ error: 'Failed to load settings' });
  }
};

// ============================================================================
// HELPER: Convert web URLs to app deep links
// ============================================================================
const getAppDeepLink = (platform: string, webUrl: string): string => {
  try {
    if (platform === 'youtube') {
      const videoIdMatch = webUrl.match(/(?:youtu\.be\/|youtube\.com\/watch\?v=)([^&\n?#]+)/);
      if (videoIdMatch && videoIdMatch[1]) {
        return `vnd.youtube://watch?v=${videoIdMatch[1]}`;
      }
    } else if (platform === 'spotify') {
      const episodeIdMatch = webUrl.match(/spotify\.com\/episode\/([^?&\n]+)/);
      if (episodeIdMatch && episodeIdMatch[1]) {
        return `spotify:episode:${episodeIdMatch[1]}`;
      }
    }
  } catch (error) {
    console.error('Error generating app deep link:', error);
  }
  return webUrl;
};

// ============================================================================
// HELPER: Get fallback URL from settings
// ============================================================================
const getFallbackUrl = async (platform: string): Promise<string> => {
  const settingsResult = await pool.query(
    `SELECT key, value FROM settings WHERE key IN ('redirect_url', 'redirect_url_spotify', 'redirect_url_apple')`
  );

  const settings: Record<string, string> = {};
  settingsResult.rows.forEach(row => {
    settings[row.key] = row.value;
  });

  if (platform === 'spotify' && settings['redirect_url_spotify']) {
    return settings['redirect_url_spotify'];
  } else if (platform === 'apple' && settings['redirect_url_apple']) {
    return settings['redirect_url_apple'];
  }
  return settings['redirect_url'] || 'https://youtu.be/qxxnRMT9C-8';
};

// ============================================================================
// AWARD POINTS (Step 2: When user clicks platform button)
// ============================================================================
export const awardPoints = async (req: Request, res: Response) => {
  const { code, platform, episodeId, timeOnPage } = req.body;

  if (!code || !platform || !['youtube', 'spotify', 'apple'].includes(platform)) {
    return res.status(400).json({ error: 'Invalid request parameters' });
  }

  try {
    // Get fingerprints from headers
    const deviceId = req.get('x-device-id') || '';
    const deviceFingerprint = req.get('x-device-fingerprint') || '';
    const browserFingerprint = req.get('x-browser-fingerprint') || '';

    // Handle empty deviceId same as in trackReferralClick
    let effectiveDeviceId = deviceId;
    if (!deviceId || deviceId.length < 10) {
      const ipAddress = req.ip || req.socket.remoteAddress || 'unknown';
      const userAgent = req.get('user-agent') || 'unknown';
      const crypto = require('crypto');
      effectiveDeviceId = crypto.createHash('sha256')
        .update(`${ipAddress}:${userAgent}:${Date.now()}`)
        .digest('hex').substring(0, 36);
    }

    // ========================================================================
    // CRITICAL: Delete pending key FIRST to prevent race condition
    // ========================================================================
    const pendingClickKey = `pending:${code}:${effectiveDeviceId}`;
    const pendingData = await redisClient.get(pendingClickKey);

    if (!pendingData) {
      // Also try with original deviceId if different
      if (effectiveDeviceId !== deviceId && deviceId) {
        const altPendingData = await redisClient.get(`pending:${code}:${deviceId}`);
        if (altPendingData) {
          // Found with original deviceId
          return processAward(req, res, code, platform, episodeId, timeOnPage, `pending:${code}:${deviceId}`, altPendingData);
        }
      }
      return res.status(400).json({
        error: 'No pending click found. Please use your referral link first.'
      });
    }

    return processAward(req, res, code, platform, episodeId, timeOnPage, pendingClickKey, pendingData);
  } catch (error) {
    console.error('Award points error:', error);
    res.status(500).json({ error: 'Failed to process platform selection' });
  }
};

// ============================================================================
// PROCESS AWARD (Separated for cleaner code)
// ============================================================================
const processAward = async (
  req: Request,
  res: Response,
  code: string,
  platform: string,
  episodeId: number | null,
  timeOnPage: number | undefined,
  pendingClickKey: string,
  pendingData: string
) => {
  const deviceId = req.get('x-device-id') || '';
  const deviceFingerprint = req.get('x-device-fingerprint') || '';
  const browserFingerprint = req.get('x-browser-fingerprint') || '';

  // CRITICAL: Delete Redis key FIRST to prevent double-award race condition
  const deleted = await redisClient.del(pendingClickKey);
  if (deleted === 0) {
    console.warn(`⚠️ Pending key already deleted - potential race condition for code ${code}`);
    return res.status(400).json({ error: 'Points already awarded for this click' });
  }

  const pending = JSON.parse(pendingData);

  // Verify fingerprints match (prevent session hijacking)
  // Be lenient: only require deviceId to match (fingerprints can change slightly)
  if (pending.deviceId !== pending.deviceId) {
    // This is checking pending.deviceId against itself which is always true
    // We should check against request headers
  }

  // Actually verify the session
  const deviceIdMatches = pending.deviceId === deviceId || pending.deviceId === req.get('x-device-id');
  if (!deviceIdMatches && pending.deviceFingerprint !== deviceFingerprint) {
    console.warn(`⚠️ Session mismatch for code ${code}`);
    // Don't block - could be legitimate browser update. Log for forensics.
    pending.fraudFlags.push('session_fingerprint_mismatch');
    pending.confidenceScore -= 15;
  }

  let blockReason: string | null = null;
  let wasAwarded = !pending.skipPointsAward;

  // ========================================================================
  // FRAUD CHECK: Time on page
  // ========================================================================
  const actualTimeOnPage = timeOnPage || 0;
  if (actualTimeOnPage > 0 && actualTimeOnPage < CAPS.MIN_TIME_ON_PAGE) {
    pending.fraudFlags.push(`fast_click:${actualTimeOnPage}ms`);
    pending.confidenceScore -= 20;
    console.warn(`⚠️ Fast click detected: ${actualTimeOnPage}ms < ${CAPS.MIN_TIME_ON_PAGE}ms`);
    // Don't auto-block fast clicks - some users are just quick
    // But log for forensics
  }

  // ========================================================================
  // FRAUD CHECK: Caps (if not already blocked)
  // ========================================================================
  if (wasAwarded) {
    const capsCheck = await checkCaps(pending.userId, code);
    if (!capsCheck.allowed) {
      wasAwarded = false;
      blockReason = capsCheck.reason!;
      pending.fraudFlags.push(capsCheck.reason!);
      console.warn(`🚫 Points blocked due to cap: ${capsCheck.reason}`);
    }
  }

  // ========================================================================
  // Award points if allowed
  // ========================================================================
  if (wasAwarded) {
    await pool.query(
      'UPDATE users SET points = points + 1 WHERE id = $1',
      [pending.userId]
    );

    // Increment caps
    await incrementCaps(pending.userId, code);

    console.log(`✅ Points awarded for code ${code} via ${platform} (confidence: ${pending.confidenceScore}%)`);
  } else {
    console.warn(`⚠️ Points NOT awarded for code ${code}: ${blockReason || pending.fraudFlags.join(', ')}`);
  }

  // ========================================================================
  // Update referral_clicks record
  // ========================================================================
  await pool.query(
    `UPDATE referral_clicks
     SET platform = $1, points_awarded = $2, episode_id = COALESCE(episode_id, $3)
     WHERE id = (
       SELECT id FROM referral_clicks
       WHERE user_id = $4 AND device_id = $5
       ORDER BY clicked_at DESC
       LIMIT 1
     )`,
    [platform, wasAwarded, episodeId || null, pending.userId, pending.deviceId]
  );

  // ========================================================================
  // Log forensic data for winner verification
  // ========================================================================
  await logForensicData({
    userId: pending.userId,
    referralCode: code,
    deviceId: pending.deviceId,
    deviceFingerprint: pending.deviceFingerprint,
    browserFingerprint: pending.browserFingerprint,
    ipAddress: pending.ipAddress,
    userAgent: pending.userAgent,
    botScore: pending.botScore,
    botSignals: pending.botSignals || [],
    execProof: pending.execProof,
    timeOnPageMs: actualTimeOnPage,
    clickTimestamp: new Date(pending.clickTimestamp),
    platform,
    episodeId,
    fraudFlags: pending.fraudFlags,
    confidenceScore: pending.confidenceScore,
    wasAwarded,
    blockReason
  });

  // ========================================================================
  // Get redirect URL
  // ========================================================================
  let webUrl: string;

  if (episodeId) {
    const episodeResult = await pool.query(
      `SELECT youtube_url, spotify_url, apple_url FROM episodes WHERE id = $1 AND is_active = true`,
      [episodeId]
    );

    if (episodeResult.rows.length > 0) {
      const episode = episodeResult.rows[0];
      if (platform === 'spotify' && episode.spotify_url) {
        webUrl = episode.spotify_url;
      } else if (platform === 'apple' && episode.apple_url) {
        webUrl = episode.apple_url;
      } else {
        webUrl = episode.youtube_url;
      }
    } else {
      webUrl = await getFallbackUrl(platform);
    }
  } else {
    webUrl = await getFallbackUrl(platform);
  }

  const redirectUrl = getAppDeepLink(platform, webUrl);

  res.json({
    success: true,
    redirectUrl,
    webUrl,
    pointsAwarded: wasAwarded
  });
};
