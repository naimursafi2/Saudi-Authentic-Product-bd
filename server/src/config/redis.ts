import { createClient } from "redis";
import { env, isRedisConfigured } from "./env";

export type RedisClient = ReturnType<typeof createClient>;

let client: RedisClient | null = null;
let connecting: Promise<RedisClient> | null = null;

/**
 * Lazily-connected shared Redis client. Returns `null` when `REDIS_URL`
 * isn't set (tests / a dev machine without Redis) so callers can fall back
 * to an in-process store — same graceful-degrade pattern as SMTP/SMS/SSLCommerz.
 */
export async function getRedis(): Promise<RedisClient | null> {
  if (!isRedisConfigured) return null;
  if (client?.isReady) return client;
  if (connecting) return connecting;

  const c = createClient({
    url: env.REDIS_URL,
    socket: {
      connectTimeout: 5_000,
      reconnectStrategy: (retries) => Math.min(retries * 500, 5_000),
    },
  });
  c.on("error", (err: Error) => {
    console.error("Redis error:", err.message);
  });
  c.on("ready", () => console.log("Redis connected"));

  connecting = c
    .connect()
    .then(() => {
      client = c;
      return c;
    })
    .finally(() => {
      connecting = null;
    });

  return connecting;
}

export async function disconnectRedis(): Promise<void> {
  if (client) {
    await client.quit().catch(() => undefined);
    client = null;
  }
}
