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

// CRITICAL: Referral click fraud protection - 1 click per IP per hour
export const referralClickLimiter = rateLimit({
  store: redisAvailable ? new RedisStore({
    // @ts-ignore
    sendCommand: (...args: any[]) => redisClient.call(...args),
    prefix: 'rl:referral:',
  }) : undefined,
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 1, // Only 1 referral click per IP per hour
  message: 'You have already clicked this referral link recently. Please try again later.',
  keyGenerator: (req: Request) => {
    // Use IP address as key
    return req.ip || req.socket.remoteAddress || 'unknown';
  },
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

  // Get device identifiers from headers (sent by frontend)
  const deviceId = req.get('x-device-id') || '';
  const browserFingerprint = req.get('x-browser-fingerprint') || '';

  try {
    // IMPORTANT: Track page load time for timing analysis
    const pageLoadTime = req.get('x-page-load-time');
    const timeOnPage = pageLoadTime ? parseInt(pageLoadTime, 10) : 0;

    // Check for suspiciously fast clicks (bots click < 1 second after page load)
    if (timeOnPage > 0 && timeOnPage < 1000) {
      console.warn(`🚨 Suspicious: Too fast click (${timeOnPage}ms) from IP: ${ipAddress}`);
      req.body.skipPointsAward = true;
    }

    // Check 1: Device ID Detection (PRIMARY - Most persistent)
    // Device ID is stored in localStorage and persists across sessions
    // This is the BEST protection against VPN switchers while being GDPR-friendly
    if (deviceId && deviceId.length > 10) {
      const deviceKey = `fraud:${code}:device:${deviceId}`;
      const deviceClicked = await redisClient.get(deviceKey);

      if (deviceClicked) {
        console.warn(`🚨 DEVICE ID MATCH: Same device clicked again for code: ${code}`);
        console.warn(`   Device ID: ${deviceId.substring(0, 16)}...`);
        console.warn(`   Current IP: ${ipAddress}, Previous IP: ${deviceClicked}`);
        // Still redirect, but don't award points
        req.body.skipPointsAward = true;
      } else {
        // Store device ID with current IP for 24 hours
        await redisClient.setex(deviceKey, 86400, ipAddress);
      }
    }

    // Check 2: Suspicious user agent patterns (bots)
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

    // Check 3: Track click velocity per IP (multiple clicks in short time)
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

    // Check 4: Browser Fingerprint Detection (BACKUP - Catches storage clearers)
    // This catches VPN switchers - even if IP changes, fingerprint stays same
    if (browserFingerprint && browserFingerprint.length > 10) {
      const fpKey = `fraud:${code}:fp:${browserFingerprint}`;
      const fpAlreadyClicked = await redisClient.get(fpKey);

      if (fpAlreadyClicked) {
        console.warn(`🚨 VPN DETECTED: Same browser fingerprint with different IP for code: ${code}`);
        console.warn(`   Fingerprint: ${browserFingerprint.substring(0, 16)}...`);
        console.warn(`   Current IP: ${ipAddress}, Previous IP: ${fpAlreadyClicked}`);
        // Still redirect, but don't award points
        req.body.skipPointsAward = true;
      } else {
        // Store fingerprint with current IP for 24 hours
        await redisClient.setex(fpKey, 86400, ipAddress);
      }
    }

    // Check 5: Traditional IP-based duplicate detection (TERTIARY - Fallback)
    const codeIpKey = `fraud:${code}:${ipAddress}`;
    const alreadyClicked = await redisClient.get(codeIpKey);

    if (alreadyClicked) {
      console.warn(`⚠️  Duplicate click detected for code: ${code} from IP: ${ipAddress}`);
      // Still redirect, but don't award points
      req.body.skipPointsAward = true;
    } else {
      // Mark this IP as having clicked this code (expires in 24 hours)
      await redisClient.setex(codeIpKey, 86400, '1');
    }

    // Check 6: Detect if same IP is clicking multiple different referral codes
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
