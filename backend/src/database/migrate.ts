import pool from '../config/database';
import fs from 'fs';
import path from 'path';
import bcrypt from 'bcryptjs';
import { nanoid } from 'nanoid';

async function migrate() {
  const client = await pool.connect();

  try {
    console.log('Running database migrations...');

    // Read and execute schema
    const schemaSQL = fs.readFileSync(
      path.join(__dirname, 'schema.sql'),
      'utf-8'
    );

    await client.query(schemaSQL);
    console.log('✓ Schema created successfully');

    // Insert default redirect URL
    await client.query(
      `INSERT INTO settings (key, value)
       VALUES ('redirect_url', $1)
       ON CONFLICT (key) DO NOTHING`,
      [process.env.DEFAULT_REDIRECT_URL || 'https://example.com']
    );
    console.log('✓ Default settings inserted');

    // Create default admin user
    const adminEmail = 'admin@example.com';
    const adminPassword = 'admin123';
    const hashedPassword = await bcrypt.hash(adminPassword, 10);
    const referralCode = nanoid(10);

    await client.query(
      `INSERT INTO users (email, password_hash, referral_code, is_admin, points)
       VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT (email) DO NOTHING`,
      [adminEmail, hashedPassword, referralCode, true, 0]
    );
    console.log('✓ Default admin user created');
    console.log('  Email:', adminEmail);
    console.log('  Password:', adminPassword);
    console.log('  ⚠️  Please change this password after first login!');

    // Insert some sample products
    const sampleProducts = [
      { name: 'Starter Bundle', description: 'Get started with our basic package', point_cost: 100 },
      { name: 'Premium Access', description: '30 days of premium features', point_cost: 250 },
      { name: 'Exclusive Merch', description: 'Limited edition merchandise', point_cost: 500 },
      { name: 'VIP Experience', description: 'Full VIP access and perks', point_cost: 1000 }
    ];

    for (const product of sampleProducts) {
      await client.query(
        `INSERT INTO products (name, description, point_cost)
         VALUES ($1, $2, $3)
         ON CONFLICT DO NOTHING`,
        [product.name, product.description, product.point_cost]
      );
    }
    console.log('✓ Sample products inserted');

    console.log('\n✅ Migration completed successfully!');
  } catch (error) {
    console.error('❌ Migration failed:', error);
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

migrate();
