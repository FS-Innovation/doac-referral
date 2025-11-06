import { Router } from 'express';
import { trackReferralClick } from '../controllers/referralController';

const router = Router();

// Public route - no authentication required
router.get('/:code', trackReferralClick);

export default router;
