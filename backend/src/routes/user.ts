import { Router } from 'express';
import { getReferralStats, getPurchaseHistory } from '../controllers/userController';
import { authenticateToken } from '../middleware/auth';

const router = Router();

// All user routes require authentication
router.use(authenticateToken);

router.get('/referral-stats', getReferralStats);
router.get('/purchase-history', getPurchaseHistory);

export default router;
