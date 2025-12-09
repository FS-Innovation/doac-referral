import redisClient from '../config/redis';

async function blockIP() {
  const ip = process.argv[2];
  const days = parseInt(process.argv[3]) || 30;

  if (!ip) {
    console.error('Usage: npx ts-node src/scripts/block-ip.ts <ip-address> [days]');
    console.error('Example: npx ts-node src/scripts/block-ip.ts 116.202.210.87 30');
    process.exit(1);
  }

  const durationSeconds = days * 24 * 60 * 60;

  try {
    await redisClient.setex(`blocked:ip:${ip}`, durationSeconds, '1');
    console.log(`🚫 IP ${ip} blocked for ${days} days`);
  } catch (error) {
    console.error('Failed to block IP:', error);
    process.exit(1);
  } finally {
    await redisClient.quit();
  }
}

blockIP();
