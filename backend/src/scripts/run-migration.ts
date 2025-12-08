import pool from '../config/database';
import * as fs from 'fs';
import * as path from 'path';

async function runMigration() {
  const migrationFile = process.argv[2];

  if (!migrationFile) {
    console.error('Usage: npx ts-node src/scripts/run-migration.ts <migration-file>');
    console.error('Example: npx ts-node src/scripts/run-migration.ts migrations/005_create_episodes_table.sql');
    process.exit(1);
  }

  const filePath = path.resolve(__dirname, '../../', migrationFile);

  if (!fs.existsSync(filePath)) {
    console.error(`Migration file not found: ${filePath}`);
    process.exit(1);
  }

  const sql = fs.readFileSync(filePath, 'utf8');

  console.log(`Running migration: ${migrationFile}`);

  try {
    await pool.query(sql);
    console.log('✅ Migration completed successfully');
  } catch (error) {
    console.error('❌ Migration failed:', error);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

runMigration();
