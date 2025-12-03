import { Router } from 'express';
import {
  createProduct,
  updateProduct,
  deleteProduct,
  getAllProductsAdmin,
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

// Product management
router.get('/products', getAllProductsAdmin);
router.post('/products', createProduct);
router.put('/products/:id', updateProduct);
router.delete('/products/:id', deleteProduct);

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
