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
  });

  redisClient.on("connect", () => {
    console.log("✅ Redis connected");
  });

  redisClient.on("error", (err: Error) => {
    console.error("❌ Redis connection error:", err.message);
  });

  return redisClient;
};