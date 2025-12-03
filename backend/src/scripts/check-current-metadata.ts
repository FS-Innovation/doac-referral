import dotenv from 'dotenv';
import pool from '../config/database';

dotenv.config();

const main = async () => {
  console.log('🔍 Checking current video metadata in database...\n');

  try {
    // Check video_metadata table
    const metadataResult = await pool.query(
      `SELECT platform, title, thumbnail_url, video_url, last_updated
       FROM video_metadata
       WHERE platform IN ('youtube', 'spotify', 'apple')
       ORDER BY platform`
    );

    if (metadataResult.rows.length === 0) {
      console.log('❌ No video metadata found in database');
      console.log('   The video_metadata table is empty.');
      console.log('   Title and thumbnail will show as null on landing page.\n');
    } else {
      console.log('✅ Found metadata in database:\n');
      metadataResult.rows.forEach(row => {
        console.log(`Platform: ${row.platform.toUpperCase()}`);
        console.log(`  Title: ${row.title}`);
        console.log(`  Thumbnail: ${row.thumbnail_url?.substring(0, 60)}...`);
        console.log(`  URL: ${row.video_url}`);
        console.log(`  Last Updated: ${row.last_updated}`);
        console.log('');
      });
    }

    // Check settings table
    const settingsResult = await pool.query(
      `SELECT key, value
       FROM settings
       WHERE key IN ('redirect_url', 'redirect_url_spotify', 'redirect_url_apple')
       ORDER BY key`
    );

    console.log('📋 Current redirect URLs in settings:\n');
    if (settingsResult.rows.length === 0) {
      console.log('❌ No redirect URLs found in settings table');
      console.log('   Using hardcoded fallbacks from referralController.ts\n');
    } else {
      settingsResult.rows.forEach(row => {
        const platform = row.key === 'redirect_url' ? 'YouTube' :
                        row.key === 'redirect_url_spotify' ? 'Spotify' :
                        'Apple Podcasts';
        console.log(`${platform}: ${row.value}`);
      });
      console.log('');
    }

  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await pool.end();
  }
};

main();
