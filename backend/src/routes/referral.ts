import { Router } from 'express';
import { trackReferralClick, getSettings, awardPoints } from '../controllers/referralController';
import { referralClickLimiter, detectReferralFraud, platformButtonLimiter, ipBlocklist } from '../middleware/rateLimiter';

const router = Router();

// IMPORTANT: Specific routes MUST come before parameterized routes
// Otherwise /:code will match 'settings' and 'award-points'

// Get platform settings (for landing page)
router.get('/settings', getSettings);

// Award points when user clicks platform button on landing page
router.post('/award-points', ipBlocklist, platformButtonLimiter, awardPoints);

// Public route with fraud protection
// Apply IP blocklist first, then rate limiting and fraud detection
// This MUST be last because it catches all GET /:code
router.get('/:code',
  ipBlocklist,
  referralClickLimiter,
  detectReferralFraud,
  trackReferralClick
);

export default router;
