import { createClient, RedisClientType } from 'redis';

let redisClient: RedisClientType | null = null;

async function getRedisClient(): Promise<RedisClientType> {
  if (!redisClient) {
    redisClient = createClient({
      url: process.env.REDIS_URL || 'redis://localhost:6379',
    });
    redisClient.on('error', (err: any) => console.error('Redis Client Error:', err));
    await redisClient.connect();
  }
  return redisClient;
}

function getHourKey(senderId: string, date: Date): string {
  const hour = date.getTime() - (date.getTime() % (1000 * 60 * 60));
  return `rate_limit:${senderId}:${hour}`;
}

export const rateLimitService = {
  async checkAndIncrementRateLimit(senderId: string): Promise<boolean> {
    const now = new Date();
    const hourKey = getHourKey(senderId, now);
    const maxPerHour = parseInt(process.env.MAX_EMAILS_PER_HOUR_PER_SENDER || '200');

    const client = await getRedisClient();
    const current = await client.incr(hourKey);

    // Set expiry on first increment
    if (current === 1) {
      await client.expire(hourKey, 3600);
    }

    return current <= maxPerHour;
  },

  async getRateLimitCount(senderId: string): Promise<number> {
    const now = new Date();
    const hourKey = getHourKey(senderId, now);

    const client = await getRedisClient();
    const count = await client.get(hourKey);

    return count ? parseInt(count) : 0;
  },

  async getNextAvailableSlot(senderId: string): Promise<Date> {
    const now = new Date();
    const nextHour = new Date(now);
    nextHour.setHours(nextHour.getHours() + 1);
    nextHour.setMinutes(0);
    nextHour.setSeconds(0);
    nextHour.setMilliseconds(0);

    return nextHour;
  },

  async resetHourlyLimit(senderId: string): Promise<void> {
    const now = new Date();
    const hourKey = getHourKey(senderId, now);

    const client = await getRedisClient();
    await client.del(hourKey);
  },
};
