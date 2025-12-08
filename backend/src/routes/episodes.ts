import { Router } from 'express';
import {
  getAllEpisodes,
  getLatestEpisode,
  getEpisodeById,
  getEpisodeForReferral
} from '../controllers/episodesController';

const router = Router();

// Public routes - no authentication required
// These are used by the landing page to display episode info

// Get the latest episode (default for referrals)
router.get('/latest', getLatestEpisode);

// Get episode for a specific referral code (with optional episodeId)
router.get('/referral/:code/:episodeId?', getEpisodeForReferral);

// Get all active episodes (for episode selector on dashboard)
router.get('/', getAllEpisodes);

// Get a specific episode by ID
router.get('/:id', getEpisodeById);

export default router;
