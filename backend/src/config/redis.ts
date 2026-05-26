import { Redis } from "ioredis";

let redisClient: Redis | null = null;

/**
 * Returns a singleton Redis client instance.
 * BullMQ requires ioredis — it does NOT work with the official 'redis' package.
 * Lazy initialization — only connects when first called.
 */
export const getRedisClient = (): Redis => {
  if (redisClient) {
    return redisClient;
  }

  const redisUrl = process.env.REDIS_URL;

  if (!redisUrl) {
    throw new Error("REDIS_URL is not defined in environment variables.");
  }

  redisClient = new Redis(redisUrl, {
    maxRetriesPerRequest: null, // Required by BullMQ — disables auto-retry limit
    enableReadyCheck: false,    // Required by BullMQ
    retryStrategy: (times) => {
      if (times > 3) {
        return null;
      }
      return Math.min(times * 1000, 3000);
    },
    reconnectOnError: () => false,
    lazyConnect: true,
    keepAlive: 10000,
    connectTimeout: 10000,
    disconnectTimeout: 2000,
  });

  redisClient.on("connect", () => {
    console.log("✅ Redis connected");
  });

  redisClient.on("error", (err: Error) => {
    if (!err.message.includes("ECONNRESET") && !err.message.includes("EPIPE")) {
      console.error("❌ Redis error:", err.message);
    }
  });

  return redisClient;
};