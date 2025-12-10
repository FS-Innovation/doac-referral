import { Router } from 'express';
import { getPrizeTiers, claimPrize, getClaimedPrizes } from '../controllers/prizeController';
import { authenticateToken } from '../middleware/auth';

const router = Router();

// All prize routes require authentication
router.use(authenticateToken);

// Get all prize tiers with user's eligibility status
router.get('/', getPrizeTiers);

// Get user's claimed prizes history
router.get('/claimed', getClaimedPrizes);

// Claim a prize tier
router.post('/claim/:tierId', claimPrize);

export default router;
