import { createClient } from "redis";
import { env } from "./env.js";

// Redis client instance
const redisClient = createClient({
  url: env.REDIS_URL,
  socket: {
    // retry with increasing delay
    // returning an Error stops retrying entirely
    reconnectStrategy: (retries) => {
      if (retries > env.REDIS_RETRIES) {
        console.error("Redis: max retry attempts reached — stopping retries");
        return false;
      }
      const delay = Math.min(env.REDIS_DELAY * retries, 3000);
      return delay;
    },
  },
});

// global Redis event listeners
redisClient.on("error", (err) => console.error("Redis client error:", err));
redisClient.on("connect", () => console.info("Redis connected"));

// connects to Redis — skips if already open
export const connectRedis = async () => {
  if (!redisClient.isOpen) {
    await redisClient.connect();
  }
};

// disconnects from Redis gracefully
export const disconnectRedis = async () => {
  await redisClient.quit();
  console.info("Redis disconnected");
};

export default redisClient;
