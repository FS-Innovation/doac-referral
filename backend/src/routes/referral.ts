import { Router } from 'express';
import { trackReferralClick } from '../controllers/referralController';
import { referralClickLimiter, detectReferralFraud } from '../middleware/rateLimiter';

const router = Router();

// Public route with fraud protection
// Apply rate limiting (1 click per IP per hour) and fraud detection
router.get('/:code',
  referralClickLimiter,
  detectReferralFraud,
  trackReferralClick
);

export default router;
