// Script to fetch and cache video metadata from YouTube/Spotify APIs
// Run this once to populate the video_metadata table
// Usage: npm run cache-metadata

import dotenv from 'dotenv';
import pool from '../config/database';
import { fetchAndCacheMetadata } from '../services/videoMetadataService';

dotenv.config();

async function cacheMetadata() {
  try {
    console.log('🚀 Fetching video metadata from APIs...\n');

    // Get current video URLs from settings
    const settingsResult = await pool.query(
      `SELECT key, value FROM settings WHERE key IN ('redirect_url', 'redirect_url_spotify', 'redirect_url_apple')`
    );

    const settings: Record<string, string> = {};
    settingsResult.rows.forEach(row => {
      settings[row.key] = row.value;
    });

    const youtubeUrl = settings['redirect_url'] || 'https://youtu.be/qxxnRMT9C-8';
    const spotifyUrl = settings['redirect_url_spotify'] || 'https://open.spotify.com/episode/6L11cxCLi0V6mhlpdzLokR';
    const appleUrl = settings['redirect_url_apple'] || '';

    console.log(`📺 YouTube URL: ${youtubeUrl}`);
    console.log(`🎵 Spotify URL: ${spotifyUrl}`);
    console.log(`🍎 Apple Podcasts URL: ${appleUrl}\n`);

    // Fetch and cache YouTube metadata
    console.log('Fetching YouTube metadata...');
    const youtubeMetadata = await fetchAndCacheMetadata('youtube', youtubeUrl);
    console.log(`✅ YouTube: ${youtubeMetadata.title}`);
    console.log(`   Thumbnail: ${youtubeMetadata.thumbnail_url}`);
    console.log(`   Channel: ${youtubeMetadata.channel_name}`);
    if (youtubeMetadata.view_count) {
      console.log(`   Views: ${youtubeMetadata.view_count.toLocaleString()}`);
    }
    console.log('');

    // Fetch and cache Spotify metadata
    console.log('Fetching Spotify metadata...');
    const spotifyMetadata = await fetchAndCacheMetadata('spotify', spotifyUrl);
    console.log(`✅ Spotify: ${spotifyMetadata.title}`);
    console.log(`   Thumbnail: ${spotifyMetadata.thumbnail_url}`);
    console.log(`   Channel: ${spotifyMetadata.channel_name}`);
    console.log('');

    // Fetch and cache Apple Podcasts metadata
    if (appleUrl) {
      console.log('Fetching Apple Podcasts metadata...');
      const appleMetadata = await fetchAndCacheMetadata('apple', appleUrl);
      console.log(`✅ Apple Podcasts: ${appleMetadata.title}`);
      console.log(`   Thumbnail: ${appleMetadata.thumbnail_url}`);
      console.log(`   Channel: ${appleMetadata.channel_name}`);
      console.log('');
    }

    console.log('🎉 All metadata cached successfully!');
    console.log('\n💡 Next steps:');
    console.log('   1. Metadata is now cached in the database');
    console.log('   2. Landing page will load instantly from cache');
    console.log('   3. Run this script again when you update video URLs');

    await pool.end();
    process.exit(0);
  } catch (error) {
    console.error('❌ Error caching metadata:', error);
    await pool.end();
    process.exit(1);
  }
}

cacheMetadata();
