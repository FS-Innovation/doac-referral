import { Pool } from 'pg';
import dotenv from 'dotenv';

dotenv.config();

// Connection pool configuration optimized for viral traffic
// With 20 connections per Cloud Run instance:
// - 100 instances × 20 connections = 2,000 total connections
// - But only ~20-30 active DB connections needed due to pooling
// - This allows 8,000 concurrent users with just 500 DB connections
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,

  // Connection pool limits
  min: 2,                    // Keep 2 connections always open per instance
  max: 20,                   // Max 20 connections per Cloud Run instance

  // Timeouts (in milliseconds)
  connectionTimeoutMillis: 10000,   // Wait max 10s for connection from pool
  idleTimeoutMillis: 30000,         // Close idle connections after 30s

  // Statement timeout - prevent long-running queries
  statement_timeout: 30000,         // 30 seconds max per query

  // Keep connections alive
  keepAlive: true,
  keepAliveInitialDelayMillis: 10000,
});

// Log pool errors
pool.on('error', (err) => {
  console.error('Unexpected database pool error:', err);
});

// Log pool stats on startup
pool.on('connect', () => {
  if (process.env.NODE_ENV === 'development') {
    console.log('New database connection established');
  }
});

export default pool;
