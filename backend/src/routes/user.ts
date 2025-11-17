import { Router } from 'express';
import { getReferralStats, getPurchaseHistory, updateRedirectPlatform } from '../controllers/userController';
import { authenticateToken } from '../middleware/auth';

const router = Router();

// All user routes require authentication
router.use(authenticateToken);

router.get('/referral-stats', getReferralStats);
router.get('/purchase-history', getPurchaseHistory);
router.put('/redirect-platform', updateRedirectPlatform);

export default router;
