/**
 * Auto-initialize video metadata on server startup
 * - Checks if metadata exists in database
 * - If missing, fetches from APIs automatically
 * - Runs in background, doesn't block server startup
 * - Perfect for Google Cloud Run auto-scaling
 */

import pool from '../config/database';
import { fetchAndCacheMetadata } from '../services/videoMetadataService';

export async function initializeMetadata(): Promise<void> {
  try {
    console.log('🔍 Checking video metadata cache...');

    // Check if metadata already exists
    const existingMetadata = await pool.query(
      'SELECT COUNT(*) as count FROM video_metadata WHERE platform IN ($1, $2, $3)',
      ['youtube', 'spotify', 'apple']
    );

    const metadataCount = parseInt(existingMetadata.rows[0].count);

    if (metadataCount >= 3) {
      console.log(`✅ Video metadata already cached (${metadataCount} platforms)`);
      return;
    }

    console.log('📥 Metadata missing or incomplete - fetching from APIs...');

    // Get video URLs from settings
    const settingsResult = await pool.query(
      `SELECT key, value FROM settings WHERE key IN ('redirect_url', 'redirect_url_spotify', 'redirect_url_apple')`
    );

    const settings: Record<string, string> = {};
    settingsResult.rows.forEach(row => {
      settings[row.key] = row.value;
    });

    const youtubeUrl = settings['redirect_url'];
    const spotifyUrl = settings['redirect_url_spotify'];
    const appleUrl = settings['redirect_url_apple'];

    // Fetch metadata in parallel for speed
    const promises = [];

    if (youtubeUrl) {
      console.log('📺 Fetching YouTube metadata...');
      promises.push(
        fetchAndCacheMetadata('youtube', youtubeUrl)
          .then(meta => console.log(`✅ YouTube cached: ${meta.title}`))
          .catch(err => console.error('❌ YouTube fetch failed:', err.message))
      );
    }

    if (spotifyUrl) {
      console.log('🎵 Fetching Spotify metadata...');
      promises.push(
        fetchAndCacheMetadata('spotify', spotifyUrl)
          .then(meta => console.log(`✅ Spotify cached: ${meta.title}`))
          .catch(err => console.error('❌ Spotify fetch failed:', err.message))
      );
    }

    if (appleUrl) {
      console.log('🍎 Fetching Apple Podcasts metadata...');
      promises.push(
        fetchAndCacheMetadata('apple', appleUrl)
          .then(meta => console.log(`✅ Apple Podcasts cached: ${meta.title}`))
          .catch(err => console.error('❌ Apple Podcasts fetch failed:', err.message))
      );
    }

    await Promise.all(promises);

    console.log('🎉 Video metadata initialization complete!');
  } catch (error) {
    console.error('⚠️ Failed to initialize metadata (will use fallback):', error);
    // Don't crash the server - metadata has fallbacks
  }
}

/**
 * Run metadata check in background after server starts
 * Doesn't block the server from accepting requests
 */
export function initializeMetadataBackground(): void {
  setTimeout(() => {
    initializeMetadata().catch(err => {
      console.error('Background metadata initialization failed:', err);
    });
  }, 5000); // Wait 5 seconds after server start to avoid blocking
}
