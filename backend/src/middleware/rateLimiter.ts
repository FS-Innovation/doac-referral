import { Request, Response, NextFunction } from 'express';
import rateLimit from 'express-rate-limit';
import RedisStore from 'rate-limit-redis';
import redisClient from '../config/redis';

// General API rate limiter - 100 requests per 15 minutes
export const generalLimiter = rateLimit({
  store: new RedisStore({
    // @ts-ignore - Fixed in newer versions
    sendCommand: (...args: any[]) => redisClient.call(...args),
    prefix: 'rl:general:',
  }),
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // Limit each IP to 100 requests per windowMs
  message: 'Too many requests from this IP, please try again later.',
  standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
  legacyHeaders: false, // Disable the `X-RateLimit-*` headers
});

// Strict limiter for authentication endpoints - 5 attempts per 15 minutes
export const authLimiter = rateLimit({
  store: new RedisStore({
    // @ts-ignore
    sendCommand: (...args: any[]) => redisClient.call(...args),
    prefix: 'rl:auth:',
  }),
  windowMs: 15 * 60 * 1000,
  max: 5,
  message: 'Too many login attempts, please try again after 15 minutes.',
  skipSuccessfulRequests: true, // Don't count successful requests
});

// CRITICAL: Referral click fraud protection - 1 click per IP per hour
export const referralClickLimiter = rateLimit({
  store: new RedisStore({
    // @ts-ignore
    sendCommand: (...args: any[]) => redisClient.call(...args),
    prefix: 'rl:referral:',
  }),
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 1, // Only 1 referral click per IP per hour
  message: 'You have already clicked this referral link recently. Please try again later.',
  keyGenerator: (req: Request) => {
    // Use IP address as key
    return req.ip || req.socket.remoteAddress || 'unknown';
  },
  skip: (req: Request) => {
    // Skip rate limiting in development
    return process.env.NODE_ENV === 'development';
  },
  handler: (req: Request, res: Response) => {
    console.warn(`⚠️  Rate limit exceeded for referral click from IP: ${req.ip}`);
    res.status(429).json({
      error: 'Too many referral clicks from this IP address',
      retryAfter: '1 hour',
      message: 'To prevent fraud, we limit referral clicks to 1 per hour per IP address.'
    });
  },
});

// Advanced fraud detection middleware
export const detectReferralFraud = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  const ipAddress = req.ip || req.socket.remoteAddress || 'unknown';
  const userAgent = req.get('user-agent') || 'unknown';
  const { code } = req.params;

  try {
    // Check 1: Suspicious user agent patterns (bots)
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
      console.warn(`🚨 Suspicious user agent blocked: ${userAgent} from IP: ${ipAddress}`);
      return res.status(403).json({
        error: 'Suspicious activity detected',
        message: 'This request appears to be automated. Please use a regular web browser.'
      });
    }

    // Check 2: Track click velocity per IP (multiple clicks in short time)
    const velocityKey = `velocity:${ipAddress}`;
    const clickCount = await redisClient.incr(velocityKey);

    if (clickCount === 1) {
      // First click from this IP, set expiry of 1 minute
      await redisClient.expire(velocityKey, 60);
    }

    // If more than 3 clicks per minute from same IP, block
    if (clickCount > 3) {
      console.warn(`🚨 High velocity clicks detected from IP: ${ipAddress} (${clickCount} clicks/min)`);
      return res.status(429).json({
        error: 'Too many clicks in a short period',
        message: 'Please slow down and try again in a minute.'
      });
    }

    // Check 3: Track unique IPs per referral code (detect mass fraud attempts)
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

    // Check 4: Detect if same IP is clicking multiple different referral codes
    const ipClicksKey = `ipclicks:${ipAddress}`;
    await redisClient.sadd(ipClicksKey, code);
    await redisClient.expire(ipClicksKey, 3600); // 1 hour expiry

    const uniqueCodesClicked = await redisClient.scard(ipClicksKey);

    // If same IP clicks more than 5 different codes in an hour, likely fraud
    if (uniqueCodesClicked > 5) {
      console.warn(`🚨 Mass fraud detected from IP: ${ipAddress} (${uniqueCodesClicked} codes clicked)`);
      return res.status(403).json({
        error: 'Suspicious activity detected',
        message: 'Your activity appears fraudulent. Please contact support if this is an error.'
      });
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
  store: new RedisStore({
    // @ts-ignore
    sendCommand: (...args: any[]) => redisClient.call(...args),
    prefix: 'rl:admin:',
  }),
  windowMs: 15 * 60 * 1000,
  max: 200, // Higher limit for admin users
  message: 'Too many admin requests, please try again later.',
});
