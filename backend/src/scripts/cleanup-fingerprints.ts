#!/usr/bin/env ts-node

/**
 * Manual Fingerprint Cleanup Script
 *
 * Usage:
 *   npm run cleanup:fingerprints           # Cleanup fingerprints older than 90 days
 *   npm run cleanup:fingerprints -- --days 60  # Cleanup older than 60 days
 *   npm run cleanup:fingerprints -- --stats    # Show stats only
 */

import pool from '../config/database';
import { cleanupExpiredFingerprints, getFingerprintStats, findSuspiciousUsers } from '../utils/fingerprintCleanup';

const args = process.argv.slice(2);
const daysArg = args.find(arg => arg.startsWith('--days='));
const statsOnly = args.includes('--stats');
const showSuspicious = args.includes('--suspicious');

const customDays = daysArg ? parseInt(daysArg.split('=')[1]) : 90;

async function main() {
  console.log('🔍 Fingerprint Cleanup Script');
  console.log('================================\n');

  // Show stats
  const stats = await getFingerprintStats();
  if (stats) {
    console.log('📊 Current Fingerprint Statistics:');
    console.log(`   Total Fingerprints: ${stats.total_fingerprints}`);
    console.log(`   Unique Users: ${stats.unique_users}`);
    console.log(`   Active (7 days): ${stats.active_7d}`);
    console.log(`   Active (30 days): ${stats.active_30d}`);
    console.log(`   Expired (>90 days): ${stats.expired}\n`);
  }

  // Show suspicious users if requested
  if (showSuspicious) {
    console.log('🚨 Suspicious Users (5+ devices):');
    const suspicious = await findSuspiciousUsers();
    if (suspicious.length > 0) {
      suspicious.forEach(user => {
        console.log(`   User #${user.id} (${user.email}): ${user.device_count} devices, ${user.points} points`);
      });
      console.log('');
    } else {
      console.log('   None found.\n');
    }
  }

  // Run cleanup if not stats-only
  if (!statsOnly) {
    console.log(`🧹 Cleaning up fingerprints older than ${customDays} days...`);

    const result = await pool.query(`
      DELETE FROM user_fingerprints
      WHERE last_seen < NOW() - INTERVAL '${customDays} days'
      RETURNING id
    `);

    const deletedCount = result.rowCount || 0;
    console.log(`✅ Cleanup complete: Removed ${deletedCount} fingerprints\n`);
  }

  await pool.end();
  process.exit(0);
}

main().catch(error => {
  console.error('❌ Error:', error);
  process.exit(1);
});
