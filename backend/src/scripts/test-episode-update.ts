/**
 * Test script to manually run episode updates locally
 *
 * Usage:
 *   npm run test-episode-update
 *
 * This script will:
 * 1. Load environment variables from .env
 * 2. Connect to your local PostgreSQL database
 * 3. Fetch the latest episodes from YouTube, Spotify, and Apple Podcasts
 * 4. Update the database with the new links and metadata
 */

import dotenv from 'dotenv';
import { updateAllPlatformLinks } from '../services/latestEpisodeService';
import pool from '../config/database';

// Load environment variables
dotenv.config();

const main = async () => {
  console.log('🚀 Testing Episode Update Functionality\n');
  console.log('Environment Configuration:');
  console.log('  Database:', process.env.DATABASE_URL ? '✅ Configured' : '❌ Not configured');
  console.log('  YouTube API Key:', process.env.YOUTUBE_API_KEY ? '✅ Configured' : '❌ Not configured');
  console.log('  YouTube Channel ID:', process.env.YOUTUBE_CHANNEL_ID ? '✅ Configured' : '❌ Not configured');
  console.log('  Spotify Client ID:', process.env.SPOTIFY_CLIENT_ID ? '✅ Configured' : '❌ Not configured');
  console.log('  Spotify Show ID:', process.env.SPOTIFY_SHOW_ID ? '✅ Configured' : '❌ Not configured');
  console.log('  Apple RSS Feed:', process.env.APPLE_RSS_FEED_URL ? '✅ Configured' : '❌ Not configured');
  console.log('  Apple Podcast ID:', process.env.APPLE_PODCAST_ID ? '✅ Configured' : '❌ Not configured');
  console.log();

  try {
    // Test database connection
    console.log('🔌 Testing database connection...');
    const dbTest = await pool.query('SELECT NOW()');
    console.log('✅ Database connected:', dbTest.rows[0].now);
    console.log();

    // Run the update
    console.log('🔄 Starting episode update...\n');
    const results = await updateAllPlatformLinks();

    // Display results
    console.log('\n📊 Update Results:\n');
    console.log('━'.repeat(60));

    if (results.youtube) {
      console.log('\n✅ YouTube Updated Successfully');
      console.log('   Title:', results.youtube.title);
      console.log('   URL:', results.youtube.url);
      console.log('   Thumbnail:', results.youtube.thumbnail);
    }

    if (results.spotify) {
      console.log('\n✅ Spotify Updated Successfully');
      console.log('   Title:', results.spotify.title);
      console.log('   URL:', results.spotify.url);
      console.log('   Thumbnail:', results.spotify.thumbnail);
    }

    if (results.apple) {
      console.log('\n✅ Apple Podcasts Updated Successfully');
      console.log('   Title:', results.apple.title);
      console.log('   URL:', results.apple.url);
      console.log('   Thumbnail:', results.apple.thumbnail);
    }

    if (results.errors.length > 0) {
      console.log('\n⚠️  Errors Encountered:\n');
      results.errors.forEach((error, index) => {
        console.log(`   ${index + 1}. ${error}`);
      });
    }

    console.log('\n━'.repeat(60));

    // Verify database updates
    console.log('\n🔍 Verifying database updates...\n');
    const settingsResult = await pool.query(
      `SELECT key, value, updated_at
       FROM settings
       WHERE key IN ('redirect_url', 'redirect_url_spotify', 'redirect_url_apple')
       ORDER BY key`
    );

    if (settingsResult.rows.length > 0) {
      console.log('Current settings in database:');
      settingsResult.rows.forEach(row => {
        const platform = row.key === 'redirect_url' ? 'YouTube' :
                        row.key === 'redirect_url_spotify' ? 'Spotify' :
                        'Apple Podcasts';
        console.log(`\n  ${platform}:`);
        console.log(`    URL: ${row.value}`);
        console.log(`    Last Updated: ${row.updated_at}`);
      });
    } else {
      console.log('⚠️  No settings found in database');
    }

    console.log('\n✨ Test completed successfully!\n');

  } catch (error) {
    console.error('\n❌ Test failed with error:\n');
    console.error(error);
    process.exit(1);
  } finally {
    // Close database connection
    await pool.end();
    console.log('🔌 Database connection closed');
  }
};

// Run the test
main().catch(error => {
  console.error('Unhandled error:', error);
  process.exit(1);
});
