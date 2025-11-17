import pool from '../config/database';
import fs from 'fs';
import path from 'path';

async function runMigration() {
  const client = await pool.connect();

  try {
    console.log('Running Apple Podcasts migration...');

    const migrationSQL = fs.readFileSync(
      path.join(__dirname, '../database/migrations/005_add_apple_podcasts.sql'),
      'utf-8'
    );

    await client.query(migrationSQL);
    console.log('✅ Apple Podcasts URL added to settings');

  } catch (error) {
    console.error('❌ Migration failed:', error);
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

runMigration();
