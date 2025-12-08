import pool from '../config/database';

/**
 * Clear all episodes from the database
 *
 * Usage:
 *   npx ts-node src/scripts/clear-episodes.ts
 */

async function main() {
  console.log('🗑️  Clearing episodes table...\n');

  try {
    // Get count before clearing
    const countResult = await pool.query('SELECT COUNT(*) as count FROM episodes');
    const beforeCount = parseInt(countResult.rows[0].count, 10);
    console.log(`📋 Found ${beforeCount} episodes in database`);

    if (beforeCount === 0) {
      console.log('\n✅ Episodes table is already empty!');
      await pool.end();
      return;
    }

    // Truncate the table and reset the ID sequence
    await pool.query('TRUNCATE TABLE episodes RESTART IDENTITY');

    console.log(`\n✅ Cleared ${beforeCount} episodes from database!`);
    console.log('   ID sequence has been reset to 1');

  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

main();
