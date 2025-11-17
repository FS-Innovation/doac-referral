import { Response } from 'express';
import { AuthRequest } from '../types';
import { fetchAndCacheMetadata, getVideoMetadata } from '../services/videoMetadataService';
import pool from '../config/database';

// Admin endpoint: Refresh video metadata from YouTube/Spotify APIs
export const refreshMetadata = async (req: AuthRequest, res: Response) => {
  try {
    const { platform, videoUrl } = req.body;

    if (!platform || !['youtube', 'spotify'].includes(platform)) {
      return res.status(400).json({ error: 'Invalid platform. Must be youtube or spotify' });
    }

    if (!videoUrl) {
      return res.status(400).json({ error: 'Video URL is required' });
    }

    console.log(`🔄 Admin refreshing ${platform} metadata...`);

    // Fetch from API and cache in database
    const metadata = await fetchAndCacheMetadata(platform, videoUrl);

    res.json({
      success: true,
      message: `${platform} metadata refreshed successfully`,
      metadata: {
        title: metadata.title,
        description: metadata.description,
        thumbnail: metadata.thumbnail_url,
        duration: metadata.duration,
        channel: metadata.channel_name,
        views: metadata.view_count
      }
    });
  } catch (error) {
    console.error('Refresh metadata error:', error);
    res.status(500).json({ error: 'Failed to refresh metadata' });
  }
};

// Admin endpoint: Get current cached metadata
export const getCachedMetadata = async (req: AuthRequest, res: Response) => {
  try {
    const result = await pool.query(
      `SELECT
        platform,
        video_url,
        video_id,
        title,
        description,
        thumbnail_url,
        duration,
        channel_name,
        view_count,
        last_updated
       FROM video_metadata
       ORDER BY platform`
    );

    res.json({
      metadata: result.rows.map(row => ({
        platform: row.platform,
        videoUrl: row.video_url,
        videoId: row.video_id,
        title: row.title,
        description: row.description,
        thumbnail: row.thumbnail_url,
        duration: row.duration,
        channel: row.channel_name,
        views: row.view_count,
        lastUpdated: row.last_updated
      }))
    });
  } catch (error) {
    console.error('Get cached metadata error:', error);
    res.status(500).json({ error: 'Failed to get cached metadata' });
  }
};
