import redisClient from '../config/redis';

async function flushRedis() {
  try {
    console.log('Flushing Redis cache...');
    await redisClient.flushall();
    console.log('✅ Redis cache flushed successfully!');
    await redisClient.quit();
    process.exit(0);
  } catch (error) {
    console.error('❌ Error flushing Redis:', error);
    process.exit(1);
  }
}

flushRedis();
