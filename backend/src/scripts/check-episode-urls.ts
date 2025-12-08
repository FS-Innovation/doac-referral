import pool from '../config/database';

/**
 * Check episode URLs in the database
 * Shows which episodes have Spotify and Apple URLs populated
 *
 * Usage:
 *   npx ts-node src/scripts/check-episode-urls.ts
 */

async function main() {
  console.log('📋 Checking episode URLs in database...\n');

  try {
    const result = await pool.query(`
      SELECT
        id,
        episode_number,
        title,
        youtube_url,
        spotify_url,
        apple_url,
        is_active
      FROM episodes
      ORDER BY episode_number DESC
    `);

    if (result.rows.length === 0) {
      console.log('❌ No episodes found in database!');
      console.log('   Run the backfill script first:');
      console.log('   YOUTUBE_API_KEY=xxx SPOTIFY_CLIENT_ID=xxx SPOTIFY_CLIENT_SECRET=xxx npx ts-node src/scripts/backfill-episodes.ts');
      await pool.end();
      return;
    }

    console.log(`Found ${result.rows.length} episodes:\n`);

    let spotifyCount = 0;
    let appleCount = 0;

    for (const ep of result.rows) {
      const hasSpotify = !!ep.spotify_url;
      const hasApple = !!ep.apple_url;

      if (hasSpotify) spotifyCount++;
      if (hasApple) appleCount++;

      const shortTitle = ep.title.substring(0, 50);
      console.log(`EP ${ep.episode_number.toString().padStart(2)}: ${shortTitle}...`);
      console.log(`    ID: ${ep.id} | Active: ${ep.is_active ? '✓' : '✗'}`);
      console.log(`    YouTube: ${ep.youtube_url ? '✓' : '✗'}`);
      console.log(`    Spotify: ${hasSpotify ? '✓ ' + ep.spotify_url : '✗ NULL'}`);
      console.log(`    Apple:   ${hasApple ? '✓ ' + ep.apple_url : '✗ NULL'}`);
      console.log('');
    }

    console.log('📊 Summary:');
    console.log(`   Total episodes: ${result.rows.length}`);
    console.log(`   With Spotify URL: ${spotifyCount}/${result.rows.length}`);
    console.log(`   With Apple URL: ${appleCount}/${result.rows.length}`);

    if (spotifyCount === 0 && appleCount === 0) {
      console.log('\n⚠️  No Spotify or Apple URLs found!');
      console.log('   This is why all buttons redirect to YouTube.');
      console.log('   Run the backfill script with valid API credentials:');
      console.log('   YOUTUBE_API_KEY=xxx SPOTIFY_CLIENT_ID=xxx SPOTIFY_CLIENT_SECRET=xxx npx ts-node src/scripts/backfill-episodes.ts');
    }

  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

main();
