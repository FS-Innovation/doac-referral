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

// CRITICAL: Referral click fraud protection - removed IP-only rate limiting
// The fraud detection middleware handles device/fingerprint-based detection
export const referralClickLimiter = rateLimit({
  store: redisAvailable ? new RedisStore({
    // @ts-ignore
    sendCommand: (...args: any[]) => redisClient.call(...args),
    prefix: 'rl:referral:',
  }) : undefined,
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 100, // High limit - actual fraud prevention is done by device/fingerprint checks
  message: 'Too many requests. Please try again later.',
  skip: (req: Request) => {
    // Skip rate limiting in development or if Redis is down
    return process.env.NODE_ENV === 'development' || (!redisAvailable && process.env.NODE_ENV === 'production');
  },
  handler: (req: Request, _res: Response, next: NextFunction) => {
    console.warn(`⚠️  Rate limit exceeded for referral click from IP: ${req.ip} (will redirect without points)`);
    // Set flag to skip points award, but still redirect to video
    req.body.skipPointsAward = true;
    next();
  },
});

// Advanced fraud detection middleware
export const detectReferralFraud = async (
  req: Request,
  _res: Response,
  next: NextFunction
) => {
  const ipAddress = req.ip || req.socket.remoteAddress || 'unknown';
  const userAgent = req.get('user-agent') || 'unknown';
  const { code } = req.params;

  // Get all three device/browser identifiers from headers (sent by frontend)
  const deviceId = req.get('x-device-id') || '';
  const deviceFingerprint = req.get('x-device-fingerprint') || '';
  const browserFingerprint = req.get('x-browser-fingerprint') || '';

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
        req.body.skipPointsAward = true;
      } else {
        await redisClient.setex(deviceFpKey, 86400, ipAddress);
      }
    }

    // Check 3: Suspicious user agent patterns (bots)
    const botPatterns = [
      /bot/i,
      /crawl/i,
      /spider/i,
      /slurp/i,
      /curl/i,
      /wget/i,
      /python/i,
      /java(?!script)/i,
      /go-http/i,
      /node-fetch/i,
      /axios/i,
    ];

    const isSuspiciousUserAgent = botPatterns.some(pattern => pattern.test(userAgent));

    if (isSuspiciousUserAgent) {
      console.warn(`🚨 Suspicious user agent detected (will redirect without points): ${userAgent} from IP: ${ipAddress}`);
      // Still redirect to video, but don't award points
      req.body.skipPointsAward = true;
    }

    // Check 4: Track click velocity per IP (multiple clicks in short time)
    const velocityKey = `velocity:${ipAddress}`;
    const clickCount = await redisClient.incr(velocityKey);

    if (clickCount === 1) {
      // First click from this IP, set expiry of 1 minute
      await redisClient.expire(velocityKey, 60);
    }

    // If more than 3 clicks per minute from same IP, flag as spam
    if (clickCount > 3) {
      console.warn(`🚨 High velocity clicks detected (will redirect without points): IP ${ipAddress} (${clickCount} clicks/min)`);
      // Still redirect to video, but don't award points
      req.body.skipPointsAward = true;
    }

    // Check 5: Browser Fingerprint Detection (TERTIARY - Software based)
    // One click per browser fingerprint per referral code per 24 hours
    if (browserFingerprint && browserFingerprint.length > 10) {
      const fpKey = `fraud:${code}:fp:${browserFingerprint}`;
      const fpAlreadyClicked = await redisClient.get(fpKey);

      if (fpAlreadyClicked) {
        console.warn(`🚨 DUPLICATE CLICK: Same browser fingerprint clicked again within 24h for code: ${code}`);
        console.warn(`   Fingerprint: ${browserFingerprint.substring(0, 16)}...`);
        console.warn(`   Current IP: ${ipAddress}, Previous IP: ${fpAlreadyClicked}`);
        // Still redirect, but don't award points
        req.body.skipPointsAward = true;
      } else {
        // Store fingerprint with current IP for 24 hours
        await redisClient.setex(fpKey, 86400, ipAddress);
      }
    }

    // Check 6: IP-based duplicate detection removed
    // We rely on device ID, device fingerprint, and browser fingerprint instead
    // This allows multiple people on same WiFi to click different referral links

    // Check 7: Detect if same IP is clicking multiple different referral codes
    const ipClicksKey = `ipclicks:${ipAddress}`;
    await redisClient.sadd(ipClicksKey, code);
    await redisClient.expire(ipClicksKey, 3600); // 1 hour expiry

    const uniqueCodesClicked = await redisClient.scard(ipClicksKey);

    // If same IP clicks more than 5 different codes in an hour, likely fraud
    if (uniqueCodesClicked > 5) {
      console.warn(`🚨 Mass fraud detected (will redirect without points): IP ${ipAddress} (${uniqueCodesClicked} codes clicked)`);
      // Still redirect to video, but don't award points
      req.body.skipPointsAward = true;
    }

    // Log suspicious activity for monitoring
    if (uniqueCodesClicked > 3) {
      console.warn(`⚠️  IP ${ipAddress} has clicked ${uniqueCodesClicked} different referral codes in the last hour`);
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
