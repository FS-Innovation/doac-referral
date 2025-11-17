import redisClient from '../config/redis';

async function clearRateLimits() {
  try {
    console.log('🧹 Clearing rate limit cache...');

    // Get all rate limit keys (they have prefixes like rl:login:, rl:register:, etc.)
    const patterns = [
      'rl:login:*',
      'rl:register:*',
      'rl:general:*',
      'rl:referral:*',
      'rl:admin:*',
      'rl:forgot-password:*',
      'rl:verify-code:*',
      'rl:reset-password:*'
    ];

    let totalDeleted = 0;

    for (const pattern of patterns) {
      console.log(`Scanning for pattern: ${pattern}`);

      // Use SCAN to find all matching keys (safer than KEYS in production)
      const keys = await redisClient.keys(pattern);

      if (keys.length > 0) {
        console.log(`  Found ${keys.length} keys matching ${pattern}`);

        // Delete all matching keys
        const deleted = await redisClient.del(...keys);
        totalDeleted += deleted;

        console.log(`  ✅ Deleted ${deleted} keys`);
      } else {
        console.log(`  No keys found for ${pattern}`);
      }
    }

    console.log(`\n✅ Successfully cleared ${totalDeleted} rate limit keys!`);
    console.log('Rate limits have been reset. Users can now make requests again.');

    await redisClient.quit();
    process.exit(0);
  } catch (error) {
    console.error('❌ Error clearing rate limits:', error);
    process.exit(1);
  }
}

clearRateLimits();
