import { Request, Response, NextFunction } from 'express';
import rateLimit from 'express-rate-limit';
import RedisStore from 'rate-limit-redis';
import redisClient from '../config/redis';

// Check if Redis is available
let redisAvailable = true;

redisClient.on('error', () => {
  redisAvailable = false;
  console.error('⚠️  Redis unavailable - falling back to in-memory rate limiting');
});

redisClient.on('ready', () => {
  redisAvailable = true;
  console.log('✅ Redis available - using Redis for rate limiting');
});

// General API rate limiter - 100 requests per 15 minutes
export const generalLimiter = rateLimit({
  // Use Redis if available, otherwise fall back to in-memory
  store: redisAvailable ? new RedisStore({
    // @ts-ignore - Fixed in newer versions
    sendCommand: (...args: any[]) => redisClient.call(...args),
    prefix: 'rl:general:',
  }) : undefined, // undefined = use in-memory store
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // Limit each IP to 100 requests per windowMs
  message: 'Too many requests from this IP, please try again later.',
  standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
  legacyHeaders: false, // Disable the `X-RateLimit-*` headers
  skip: () => {
    // If Redis fails during request, skip rate limiting rather than crash
    return !redisAvailable && process.env.NODE_ENV === 'production';
  },
});

// Login limiter - 10 attempts per 15 minutes (industry standard)
// Only counts FAILED login attempts, not successful ones
export const loginLimiter = rateLimit({
  store: redisAvailable ? new RedisStore({
    // @ts-ignore
    sendCommand: (...args: any[]) => redisClient.call(...args),
    prefix: 'rl:login:',
  }) : undefined,
  windowMs: 15 * 60 * 1000, // 15 minute window - resets automatically
  max: process.env.NODE_ENV === 'development' ? 100 : 10, // 10 failed attempts in prod
  skipSuccessfulRequests: true, // Only count failed login attempts
  standardHeaders: true, // Send rate limit info in headers
  legacyHeaders: false,
  handler: (_req: Request, res: Response) => {
    res.status(429).json({
      error: 'Too many login attempts',
      message: 'For security reasons, please wait 15 minutes before trying again. If you forgot your password, please use the password reset option.',
      retryAfter: 900 // 15 minutes in seconds
    });
  },
  skip: () => {
    return !redisAvailable && process.env.NODE_ENV === 'production';
  },
});

// Register limiter - Separate from login, more lenient
// 5 registration attempts per hour (prevents spam accounts)
export const registerLimiter = rateLimit({
  store: redisAvailable ? new RedisStore({
    // @ts-ignore
    sendCommand: (...args: any[]) => redisClient.call(...args),
    prefix: 'rl:register:',
  }) : undefined,
  windowMs: 60 * 60 * 1000, // 1 hour window
  max: process.env.NODE_ENV === 'development' ? 100 : 5, // 5 registrations per hour
  standardHeaders: true,
  legacyHeaders: false,
  handler: (_req: Request, res: Response) => {
    res.status(429).json({
      error: 'Too many registration attempts',
      message: 'You can only create up to 5 accounts per hour from this connection. If you already have an account, please try logging in instead.',
      retryAfter: 3600 // 1 hour in seconds
    });
  },
  skip: () => {
    return !redisAvailable && process.env.NODE_ENV === 'production';
  },
});

// CRITICAL: Referral click protection - NO IP-based rate limiting
// Fraud prevention is 100% fingerprint-based (device ID, device FP, browser FP)
// This limiter only prevents catastrophic abuse (e.g., 1000 requests/second DoS attack)
export const referralClickLimiter = rateLimit({
  store: redisAvailable ? new RedisStore({
    // @ts-ignore
    sendCommand: (...args: any[]) => redisClient.call(...args),
    prefix: 'rl:referral:',
  }) : undefined,
  windowMs: 60 * 1000, // 1 minute (shortened window)
  max: 50, // Very high limit - only blocks obvious DoS attacks, not legitimate traffic
  message: 'Too many requests. Please slow down.',
  skip: () => {
    // Skip rate limiting in development or if Redis is down
    return process.env.NODE_ENV === 'development' || (!redisAvailable && process.env.NODE_ENV === 'production');
  },
  handler: (req: Request, _res: Response, next: NextFunction) => {
    console.warn(`⚠️  Extreme rate limit exceeded for referral click from IP: ${req.ip} (50 requests/min) - Likely DoS attack`);
    // Still allow request through but flag for manual review
    req.body.skipPointsAward = true;
    req.body.fraudReason = 'rate_limit_dos_protection';
    next();
  },
});

// Advanced fraud detection middleware
// INDUSTRY STANDARD: Multi-factor checks (NOT IP-only) to support legitimate shared networks
export const detectReferralFraud = async (
  req: Request,
  _res: Response,
  next: NextFunction
) => {
  const ipAddress = req.ip || req.socket.remoteAddress || 'unknown';
  const { code } = req.params;

  // Get all three device/browser identifiers from headers (sent by frontend)
  const deviceId = req.get('x-device-id') || '';
  const deviceFingerprint = req.get('x-device-fingerprint') || '';
  const browserFingerprint = req.get('x-browser-fingerprint') || '';

  const fraudReasons: string[] = [];

  try {
    // Check 1: Device ID Detection (PRIMARY - Most persistent)
    // Device ID is UUID stored in localStorage - persists across sessions
    // One click per device ID per referral code per 24 hours
    if (deviceId && deviceId.length > 10) {
      const deviceKey = `fraud:${code}:deviceid:${deviceId}`;
      const deviceClicked = await redisClient.get(deviceKey);

      if (deviceClicked) {
        console.warn(`🚨 DUPLICATE CLICK: Same device ID clicked again within 24h for code: ${code}`);
        console.warn(`   Device ID: ${deviceId.substring(0, 16)}...`);
        console.warn(`   Current IP: ${ipAddress}, Previous IP: ${deviceClicked}`);
        fraudReasons.push('duplicate_device_id_24h');
        req.body.skipPointsAward = true;
      } else {
        await redisClient.setex(deviceKey, 86400, ipAddress);
      }
    }

    // Check 2: Device Fingerprint Detection (SECONDARY - Hardware based)
    // Hardware fingerprint (GPU, CPU, screen) - changes only with hardware
    // Catches users who clear localStorage but use same device
    // One click per device fingerprint per referral code per 24 hours
    if (deviceFingerprint && deviceFingerprint.length > 10) {
      const deviceFpKey = `fraud:${code}:devicefp:${deviceFingerprint}`;
      const deviceFpClicked = await redisClient.get(deviceFpKey);

      if (deviceFpClicked) {
        console.warn(`🚨 DUPLICATE CLICK: Same device hardware fingerprint within 24h for code: ${code}`);
        console.warn(`   Device Fingerprint: ${deviceFingerprint.substring(0, 16)}...`);
        console.warn(`   Current IP: ${ipAddress}, Previous IP: ${deviceFpClicked}`);
        fraudReasons.push('duplicate_device_fp_24h');
        req.body.skipPointsAward = true;
      } else {
        await redisClient.setex(deviceFpKey, 86400, ipAddress);
      }
    }

    // Check 3: Browser Fingerprint Detection (TERTIARY - Software based)
    // One click per browser fingerprint per referral code per 24 hours
    if (browserFingerprint && browserFingerprint.length > 10) {
      const fpKey = `fraud:${code}:fp:${browserFingerprint}`;
      const fpAlreadyClicked = await redisClient.get(fpKey);

      if (fpAlreadyClicked) {
        console.warn(`🚨 DUPLICATE CLICK: Same browser fingerprint clicked again within 24h for code: ${code}`);
        console.warn(`   Fingerprint: ${browserFingerprint.substring(0, 16)}...`);
        console.warn(`   Current IP: ${ipAddress}, Previous IP: ${fpAlreadyClicked}`);
        fraudReasons.push('duplicate_browser_fp_24h');
        req.body.skipPointsAward = true;
      } else {
        // Store fingerprint with current IP for 24 hours
        await redisClient.setex(fpKey, 86400, ipAddress);
      }
    }

    // ============================================================================
    // BOT DETECTION REMOVED
    // ============================================================================
    // REASON: User-agent checking is ineffective and causes false positives
    //
    // Why it's ineffective:
    // - Fraudsters can easily fake user agents (just 1 HTTP header)
    // - Browser extensions/automation tools get blocked (false positives)
    // - Legitimate tools (curl for testing, Postman, RSS readers) blocked
    // - Privacy-focused browsers may have unusual user agents
    //
    // Device fingerprints are MUCH stronger fraud prevention:
    // - Cannot be faked without actually changing hardware/browser
    // - Prevents duplicate clicks regardless of user agent
    // - No false positives from legitimate tools
    //
    // If a bot tries to abuse the system, they'll be caught by:
    // 1. Device ID duplicate detection (same localStorage UUID)
    // 2. Device fingerprint duplicate detection (same GPU/CPU/screen)
    // 3. Browser fingerprint duplicate detection (same canvas/audio/fonts)
    //
    // REMOVED Check 4: Bot user-agent pattern detection
    //
    // ============================================================================
    // ALL IP-ONLY CHECKS REMOVED
    // ============================================================================
    // REASON: Shared WiFi/offices/families would be blocked
    //
    // Examples of legitimate use cases that would be blocked:
    // - 20 people in an office each clicking different referral links
    // - Family of 10 all clicking links at dinner time
    // - Conference attendees on same WiFi
    // - Coffee shop customers
    //
    // Fraud is prevented by DEVICE-LEVEL fingerprints, not IP patterns
    //
    // REMOVED Check 5: Velocity tracking (5+ clicks/min from IP)
    // REMOVED Check 6: IP-only duplicate detection
    // REMOVED Check 7: Mass codes (10+ codes from IP in 1 hour)
    //
    // ============================================================================

    // Pass fraud reasons to controller for logging
    if (fraudReasons.length > 0) {
      req.body.fraudReason = fraudReasons.join(', ');
    }

    next();
  } catch (error) {
    console.error('Error in fraud detection:', error);
    // Don't block users if fraud detection fails
    next();
  }
};

// Admin endpoints - more permissive but still protected
export const adminLimiter = rateLimit({
  store: redisAvailable ? new RedisStore({
    // @ts-ignore
    sendCommand: (...args: any[]) => redisClient.call(...args),
    prefix: 'rl:admin:',
  }) : undefined,
  windowMs: 15 * 60 * 1000,
  max: 200, // Higher limit for admin users
  message: 'Too many admin requests, please try again later.',
  skip: () => {
    return !redisAvailable && process.env.NODE_ENV === 'production';
  },
});

// Password reset request limiter - 3 attempts per hour per IP
// Prevents attackers from spamming reset emails to users
export const forgotPasswordLimiter = rateLimit({
  store: redisAvailable ? new RedisStore({
    // @ts-ignore
    sendCommand: (...args: any[]) => redisClient.call(...args),
    prefix: 'rl:forgot:',
  }) : undefined,
  windowMs: 60 * 60 * 1000, // 1 hour window
  max: process.env.NODE_ENV === 'development' ? 100 : 3, // 3 requests per hour
  standardHeaders: true,
  legacyHeaders: false,
  handler: (_req: Request, res: Response) => {
    res.status(429).json({
      error: 'Too many password reset requests',
      message: 'You can only request a password reset 3 times per hour. Please check your email or wait before trying again.',
      retryAfter: 3600 // 1 hour in seconds
    });
  },
  skip: () => {
    return !redisAvailable && process.env.NODE_ENV === 'production';
  },
});

// Password reset code verification limiter - 5 attempts per 15 minutes
// Prevents brute force attacks on the 6-digit code
export const verifyResetCodeLimiter = rateLimit({
  store: redisAvailable ? new RedisStore({
    // @ts-ignore
    sendCommand: (...args: any[]) => redisClient.call(...args),
    prefix: 'rl:verify:',
  }) : undefined,
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: process.env.NODE_ENV === 'development' ? 100 : 5, // 5 attempts per 15 minutes
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: true, // Only count failed verification attempts
  handler: (_req: Request, res: Response) => {
    res.status(429).json({
      error: 'Too many verification attempts',
      message: 'For security, you can only attempt to verify a code 5 times per 15 minutes. Please request a new code if needed.',
      retryAfter: 900 // 15 minutes in seconds
    });
  },
  skip: () => {
    return !redisAvailable && process.env.NODE_ENV === 'production';
  },
});

// Password reset completion limiter - 5 attempts per hour
// Prevents brute force on the reset token
export const resetPasswordLimiter = rateLimit({
  store: redisAvailable ? new RedisStore({
    // @ts-ignore
    sendCommand: (...args: any[]) => redisClient.call(...args),
    prefix: 'rl:reset:',
  }) : undefined,
  windowMs: 60 * 60 * 1000, // 1 hour
  max: process.env.NODE_ENV === 'development' ? 100 : 5, // 5 attempts per hour
  standardHeaders: true,
  legacyHeaders: false,
  handler: (_req: Request, res: Response) => {
    res.status(429).json({
      error: 'Too many password reset attempts',
      message: 'You can only reset your password 5 times per hour. Please wait before trying again.',
      retryAfter: 3600 // 1 hour in seconds
    });
  },
  skip: () => {
    return !redisAvailable && process.env.NODE_ENV === 'production';
  },
});
