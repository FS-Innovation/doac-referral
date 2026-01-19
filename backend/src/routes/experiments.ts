import { Router } from 'express';
import {
  getExperimentVariant,
  recordConversion,
  getExperimentStats,
  listExperiments
} from '../controllers/experimentController';
import { authenticateToken, requireAdmin } from '../middleware/auth';
import { generalLimiter } from '../middleware/rateLimiter';

const router = Router();

// All experiment routes require authentication
router.use(authenticateToken);

// Get assigned variant for an experiment (creates assignment if none exists)
router.get('/:slug/variant', getExperimentVariant);

// Record conversion for an experiment
router.post('/:slug/convert', generalLimiter, recordConversion);

// Admin-only routes
router.get('/', requireAdmin, listExperiments);
router.get('/:slug/stats', requireAdmin, getExperimentStats);

export default router;
