require('dotenv').config();
const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');

// Create database connection
const pool = new Pool({
  connectionString: process.env.DATABASE_URL
});

async function runMigration() {
  const client = await pool.connect();

  try {
    console.log('🔄 Starting password_reset_tokens table migration...\n');

    // Read the migration SQL file
    const migrationSQL = fs.readFileSync(
      path.join(__dirname, 'run-migration.sql'),
      'utf8'
    );

    // Execute the migration
    await client.query(migrationSQL);

    console.log('✅ Migration completed successfully!\n');

    // Verify the new schema
    const result = await client.query(`
      SELECT
        column_name,
        data_type,
        is_nullable,
        column_default
      FROM information_schema.columns
      WHERE table_name = 'password_reset_tokens'
      ORDER BY ordinal_position;
    `);

    console.log('📋 New password_reset_tokens table schema:\n');
    console.table(result.rows);

  } catch (error) {
    console.error('❌ Migration failed:', error.message);
    console.error('\nFull error:', error);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

runMigration();
