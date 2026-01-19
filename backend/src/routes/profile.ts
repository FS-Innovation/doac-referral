import { Router } from 'express';
import {
  getCompletionStatus,
  completeProfile,
  skipProfileCompletion,
  getInterests,
  getMarketingChannels,
  getUserInterests,
  getUserMarketingPreferences,
  getUserProfile,
  updateProfile
} from '../controllers/profileController';
import { authenticateToken } from '../middleware/auth';
import { generalLimiter } from '../middleware/rateLimiter';

const router = Router();

// All profile routes require authentication
router.use(authenticateToken);

// Profile completion status
router.get('/completion-status', getCompletionStatus);

// Complete profile (submit profile data)
router.post('/complete', generalLimiter, completeProfile);

// Skip profile completion
router.post('/skip', generalLimiter, skipProfileCompletion);

// Get available options (interests, marketing channels)
router.get('/interests', getInterests);
router.get('/marketing-channels', getMarketingChannels);

// Get user's current selections
router.get('/user-interests', getUserInterests);
router.get('/user-marketing-preferences', getUserMarketingPreferences);

// Full profile management (for edit profile page)
router.get('/me', getUserProfile);
router.put('/me', generalLimiter, updateProfile);

export default router;
