import pool from '../config/database';
import { CronJob } from 'cron';

/**
 * Cleanup old fingerprints from database
 * Industry Standard: Remove fingerprints not seen in 90 days
 * This balances fraud prevention with legitimate device changes
 */
export const cleanupExpiredFingerprints = async () => {
  try {
    const result = await pool.query(`
      DELETE FROM user_fingerprints
      WHERE last_seen < NOW() - INTERVAL '90 days'
      RETURNING id
    `);

    const deletedCount = result.rowCount || 0;

    if (deletedCount > 0) {
      console.log(`🧹 Fingerprint cleanup: Removed ${deletedCount} fingerprints older than 90 days`);
    }

    return deletedCount;
  } catch (error) {
    console.error('Error cleaning up expired fingerprints:', error);
    return 0;
  }
};

/**
 * Get fingerprint statistics for monitoring
 */
export const getFingerprintStats = async () => {
  try {
    const result = await pool.query(`
      SELECT
        COUNT(*) as total_fingerprints,
        COUNT(DISTINCT user_id) as unique_users,
        COUNT(*) FILTER (WHERE last_seen > NOW() - INTERVAL '7 days') as active_7d,
        COUNT(*) FILTER (WHERE last_seen > NOW() - INTERVAL '30 days') as active_30d,
        COUNT(*) FILTER (WHERE last_seen < NOW() - INTERVAL '90 days') as expired
      FROM user_fingerprints
    `);

    return result.rows[0];
  } catch (error) {
    console.error('Error getting fingerprint stats:', error);
    return null;
  }
};

/**
 * Find users with suspicious device counts (potential fraud)
 */
export const findSuspiciousUsers = async () => {
  try {
    const result = await pool.query(`
      SELECT
        u.id,
        u.email,
        COUNT(DISTINCT uf.device_id) as device_count,
        u.points,
        u.created_at
      FROM users u
      LEFT JOIN user_fingerprints uf ON u.id = uf.user_id
      GROUP BY u.id, u.email, u.points, u.created_at
      HAVING COUNT(DISTINCT uf.device_id) > 5
      ORDER BY COUNT(DISTINCT uf.device_id) DESC
      LIMIT 50
    `);

    return result.rows;
  } catch (error) {
    console.error('Error finding suspicious users:', error);
    return [];
  }
};

/**
 * Setup cron job to run cleanup daily at 3 AM
 * This keeps the database clean without manual intervention
 */
export const setupFingerprintCleanupCron = () => {
  // Run daily at 3:00 AM
  const job = new CronJob('0 3 * * *', async () => {
    console.log('🕒 Running scheduled fingerprint cleanup...');
    const deletedCount = await cleanupExpiredFingerprints();

    // Also log stats
    const stats = await getFingerprintStats();
    if (stats) {
      console.log('📊 Fingerprint Stats:', {
        total: stats.total_fingerprints,
        users: stats.unique_users,
        active_7d: stats.active_7d,
        active_30d: stats.active_30d,
        expired: stats.expired
      });
    }
  });

  job.start();
  console.log('✅ Fingerprint cleanup cron job scheduled (daily at 3:00 AM)');

  return job;
};
