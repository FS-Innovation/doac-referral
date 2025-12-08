import { Request, Response } from 'express';
import pool from '../config/database';

// Episode type definition
interface Episode {
  id: number;
  episode_number: number;
  title: string;
  description: string | null;
  youtube_video_id: string;
  duration: number | null;
  published_at: Date;
  view_count: number;
  youtube_url: string;
  spotify_url: string | null;
  apple_url: string | null;
  is_active: boolean;
  created_at: Date;
  updated_at: Date;
}

// Get all active episodes (for the episode selector)
export const getAllEpisodes = async (_req: Request, res: Response) => {
  try {
    const result = await pool.query<Episode>(
      `SELECT id, episode_number, title, description, youtube_video_id, duration,
              published_at, view_count, youtube_url, spotify_url, apple_url
       FROM episodes
       WHERE is_active = true
       ORDER BY published_at DESC`
    );

    res.json({
      episodes: result.rows,
      count: result.rows.length
    });
  } catch (error) {
    console.error('Error fetching episodes:', error);
    res.status(500).json({ error: 'Failed to fetch episodes' });
  }
};

// Get the latest episode (default selection)
export const getLatestEpisode = async (_req: Request, res: Response) => {
  try {
    const result = await pool.query<Episode>(
      `SELECT id, episode_number, title, description, youtube_video_id, duration,
              published_at, view_count, youtube_url, spotify_url, apple_url
       FROM episodes
       WHERE is_active = true
       ORDER BY published_at DESC
       LIMIT 1`
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'No episodes found' });
    }

    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error fetching latest episode:', error);
    res.status(500).json({ error: 'Failed to fetch latest episode' });
  }
};

// Get a specific episode by ID
export const getEpisodeById = async (req: Request, res: Response) => {
  const { id } = req.params;

  try {
    const result = await pool.query<Episode>(
      `SELECT id, episode_number, title, description, youtube_video_id, duration,
              published_at, view_count, youtube_url, spotify_url, apple_url
       FROM episodes
       WHERE id = $1 AND is_active = true`,
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Episode not found' });
    }

    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error fetching episode:', error);
    res.status(500).json({ error: 'Failed to fetch episode' });
  }
};

// Get episode for a referral (by referral code + episode identifier)
// The episode identifier can be either:
// - A numeric database ID (e.g., "45")
// - A YouTube video ID (e.g., "xDQyLnNAXr4")
// This is called from the referral landing page to get the episode to display
export const getEpisodeForReferral = async (req: Request, res: Response) => {
  const { code, episodeId } = req.params;

  try {
    // First verify the referral code is valid
    const userResult = await pool.query(
      'SELECT id FROM users WHERE referral_code = $1',
      [code]
    );

    if (userResult.rows.length === 0) {
      return res.status(404).json({ error: 'Invalid referral code' });
    }

    // If episodeId is provided, fetch that episode
    // Otherwise, fetch the latest episode
    let episodeResult;

    if (episodeId && episodeId !== 'latest') {
      // Check if it's a numeric ID or a YouTube video ID
      const isNumericId = /^\d+$/.test(episodeId);

      if (isNumericId) {
        // Query by database ID
        episodeResult = await pool.query<Episode>(
          `SELECT id, episode_number, title, description, youtube_video_id, duration,
                  published_at, view_count, youtube_url, spotify_url, apple_url
           FROM episodes
           WHERE id = $1 AND is_active = true`,
          [episodeId]
        );
      } else {
        // Query by YouTube video ID
        episodeResult = await pool.query<Episode>(
          `SELECT id, episode_number, title, description, youtube_video_id, duration,
                  published_at, view_count, youtube_url, spotify_url, apple_url
           FROM episodes
           WHERE youtube_video_id = $1 AND is_active = true`,
          [episodeId]
        );
      }
    }

    // If no episode found with the ID, or no ID provided, get latest
    if (!episodeResult || episodeResult.rows.length === 0) {
      episodeResult = await pool.query<Episode>(
        `SELECT id, episode_number, title, description, youtube_video_id, duration,
                published_at, view_count, youtube_url, spotify_url, apple_url
         FROM episodes
         WHERE is_active = true
         ORDER BY published_at DESC
         LIMIT 1`
      );
    }

    if (episodeResult.rows.length === 0) {
      return res.status(404).json({ error: 'No episodes available' });
    }

    res.json(episodeResult.rows[0]);
  } catch (error) {
    console.error('Error fetching episode for referral:', error);
    res.status(500).json({ error: 'Failed to fetch episode' });
  }
};
