import { Router } from 'express';
import {
  getAllUsers,
  getUserDetails,
  updateRedirectUrl,
  getSettings,
  getAnalytics,
  updateLatestEpisodes,
  getCurrentEpisodeLinks
} from '../controllers/adminController';
import { authenticateToken, requireAdmin } from '../middleware/auth';

const router = Router();

// All admin routes require authentication and admin privileges
router.use(authenticateToken);
router.use(requireAdmin);

// Product management routes removed - replaced by prize system (migration 012)

// User management
router.get('/users', getAllUsers);
router.get('/users/:id', getUserDetails);

// Settings
router.get('/settings', getSettings);
router.put('/settings/redirect-url', updateRedirectUrl);

// Analytics
router.get('/analytics', getAnalytics);

// Episode Updates
router.post('/episodes/update', updateLatestEpisodes);
router.get('/episodes/current', getCurrentEpisodeLinks);

export default router;
