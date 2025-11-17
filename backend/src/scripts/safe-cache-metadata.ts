/**
 * Production-safe metadata caching script
 *
 * This script can be run on production safely:
 * - Checks if metadata exists before fetching
 * - Only updates stale data (>24 hours old)
 * - Has dry-run mode for testing
 * - Graceful error handling
 *
 * Usage:
 *   npm run cache-metadata:safe           # Dry run (shows what would be cached)
 *   npm run cache-metadata:safe -- --force # Actually cache the data
 */

import dotenv from 'dotenv';
import pool from '../config/database';
import { fetchAndCacheMetadata, getVideoMetadata } from '../services/videoMetadataService';

dotenv.config();

const isDryRun = !process.argv.includes('--force');
const maxAgeHours = 24; // Consider metadata stale after 24 hours

async function safeCacheMetadata() {
  try {
    if (isDryRun) {
      console.log('🔍 DRY RUN MODE - No changes will be made');
      console.log('   Run with --force to actually cache metadata\n');
    } else {
      console.log('🚀 LIVE MODE - Fetching and caching video metadata\n');
    }

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

    console.log('📋 Current video URLs:');
    console.log(`   📺 YouTube: ${youtubeUrl}`);
    console.log(`   🎵 Spotify: ${spotifyUrl}`);
    console.log(`   🍎 Apple Podcasts: ${appleUrl || '(not set)'}\n`);

    // Check existing metadata
    const existingMetadata = await pool.query(
      `SELECT platform, title, last_updated,
              EXTRACT(EPOCH FROM (NOW() - last_updated))/3600 as age_hours
       FROM video_metadata
       WHERE platform IN ('youtube', 'spotify', 'apple')
       ORDER BY platform`
    );

    console.log('📊 Current metadata cache status:');
    const existingPlatforms = new Set<string>();

    for (const row of existingMetadata.rows) {
      existingPlatforms.add(row.platform);
      const ageHours = Math.round(row.age_hours);
      const isStale = ageHours > maxAgeHours;
      const status = isStale ? '⚠️  STALE' : '✅ FRESH';

      console.log(`   ${status} ${row.platform}: "${row.title}" (${ageHours}h old)`);
    }

    if (existingMetadata.rows.length === 0) {
      console.log('   (no metadata cached yet)');
    }
    console.log('');

    // Determine what needs to be cached
    const platforms = [
      { name: 'youtube', url: youtubeUrl, icon: '📺' },
      { name: 'spotify', url: spotifyUrl, icon: '🎵' },
      { name: 'apple', url: appleUrl, icon: '🍎' }
    ];

    const toCacheCount = platforms.filter(p => {
      if (!p.url) return false;
      const existing = existingMetadata.rows.find(r => r.platform === p.name);
      if (!existing) return true;
      return existing.age_hours > maxAgeHours;
    }).length;

    if (toCacheCount === 0) {
      console.log('✅ All metadata is fresh and up-to-date!');
      console.log('   No action needed.\n');
      await pool.end();
      process.exit(0);
    }

    console.log(`📥 Will cache/update ${toCacheCount} platform(s)\n`);

    // Cache metadata for each platform
    let successCount = 0;
    let skipCount = 0;
    let errorCount = 0;

    for (const platform of platforms) {
      if (!platform.url) {
        console.log(`⏭️  Skipping ${platform.icon} ${platform.name}: No URL configured`);
        skipCount++;
        continue;
      }

      const existing = existingMetadata.rows.find(r => r.platform === platform.name);

      // Skip if fresh
      if (existing && existing.age_hours <= maxAgeHours) {
        console.log(`⏭️  Skipping ${platform.icon} ${platform.name}: Fresh (${Math.round(existing.age_hours)}h old)`);
        skipCount++;
        continue;
      }

      const action = existing ? 'Updating' : 'Caching';
      console.log(`${platform.icon} ${action} ${platform.name} metadata...`);

      if (isDryRun) {
        console.log(`   [DRY RUN] Would fetch from API: ${platform.url}`);
        successCount++;
      } else {
        try {
          const metadata = await fetchAndCacheMetadata(platform.name, platform.url);
          console.log(`   ✅ Success: "${metadata.title}"`);
          if (metadata.thumbnail_url) {
            console.log(`   📸 Thumbnail: ${metadata.thumbnail_url.substring(0, 60)}...`);
          }
          if (metadata.channel_name) {
            console.log(`   🎙️  Channel: ${metadata.channel_name}`);
          }
          successCount++;
        } catch (error: any) {
          console.error(`   ❌ Failed: ${error.message}`);
          console.error(`   💡 Will use fallback metadata for ${platform.name}`);
          errorCount++;
        }
      }
      console.log('');
    }

    // Summary
    console.log('━'.repeat(60));
    console.log('📊 Summary:');
    console.log(`   ✅ Cached: ${successCount}`);
    console.log(`   ⏭️  Skipped (fresh): ${skipCount}`);
    console.log(`   ❌ Errors: ${errorCount}`);
    console.log('━'.repeat(60));

    if (isDryRun) {
      console.log('\n💡 This was a dry run. To actually cache metadata, run:');
      console.log('   npm run cache-metadata:safe -- --force\n');
    } else {
      console.log('\n🎉 Metadata caching complete!');
      console.log('   Landing pages will now load instantly from cache.\n');
    }

    await pool.end();
    process.exit(errorCount > 0 ? 1 : 0);
  } catch (error) {
    console.error('❌ Fatal error:', error);
    await pool.end();
    process.exit(1);
  }
}

safeCacheMetadata();
