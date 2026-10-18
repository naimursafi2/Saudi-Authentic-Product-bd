import { getRedis } from "../config/redis";

/**
 * Short-lived OTPs live in Redis, never in MongoDB. Each code is a Redis hash
 * `{ code, attempts, generatedAt }` under `otp:<namespace>:<id>` with a native
 * TTL, so expiry is enforced by Redis itself — nothing to clean up afterwards.
 *
 * When `REDIS_URL` isn't configured (jest, or a dev box without Redis) an
 * in-process Map with the same TTL semantics is used instead, so every flow
 * keeps working; production must set `REDIS_URL` because this fallback is
 * per-process and lost on restart.
 */

export interface StoredOtp {
  code: string;
  attempts: number;
  generatedAt: Date;
  expiresAt: Date;
}

interface MemoryEntry {
  code: string;
  attempts: number;
  generatedAt: number;
  expiresAt: number;
}

const memory = new Map<string, MemoryEntry>();

function memoryGet(key: string): MemoryEntry | null {
  const entry = memory.get(key);
  if (!entry) return null;
  if (entry.expiresAt <= Date.now()) {
    memory.delete(key);
    return null;
  }
  return entry;
}

export interface OtpStore {
  /** Stores a fresh code (replacing any outstanding one) with attempts reset to 0. */
  save(id: string, code: string): Promise<void>;
  /** The outstanding code, or `null` if none / expired. */
  get(id: string): Promise<StoredOtp | null>;
  /** Records one wrong attempt and returns the new count. Never extends the TTL. */
  incrementAttempts(id: string): Promise<number>;
  /** Removes the code (after success, too many wrong attempts, or cancellation). */
  remove(id: string): Promise<void>;
}

export function createOtpStore(
  namespace: string,
  ttlSeconds: number,
  normalizeId: (id: string) => string = (id) => id
): OtpStore {
  const keyFor = (id: string) => `otp:${namespace}:${normalizeId(id)}`;

  return {
    async save(id, code) {
      const key = keyFor(id);
      const now = Date.now();
      const redis = await getRedis();
      if (!redis) {
        memory.set(key, { code, attempts: 0, generatedAt: now, expiresAt: now + ttlSeconds * 1000 });
        return;
      }
      await redis
        .multi()
        .del(key)
        .hSet(key, { code, attempts: "0", generatedAt: String(now) })
        .expire(key, ttlSeconds)
        .exec();
    },

    async get(id) {
      const key = keyFor(id);
      const redis = await getRedis();
      if (!redis) {
        const entry = memoryGet(key);
        if (!entry) return null;
        return {
          code: entry.code,
          attempts: entry.attempts,
          generatedAt: new Date(entry.generatedAt),
          expiresAt: new Date(entry.expiresAt),
        };
      }
      const [data, pttl] = await Promise.all([redis.hGetAll(key), redis.pTTL(key)]);
      if (!data || !data.code || pttl <= 0) return null;
      return {
        code: data.code,
        attempts: Number(data.attempts ?? 0),
        generatedAt: new Date(Number(data.generatedAt ?? Date.now())),
        expiresAt: new Date(Date.now() + pttl),
      };
    },

    async incrementAttempts(id) {
      const key = keyFor(id);
      const redis = await getRedis();
      if (!redis) {
        const entry = memoryGet(key);
        if (!entry) return 0;
        entry.attempts += 1;
        return entry.attempts;
      }
      const attempts = await redis.hIncrBy(key, "attempts", 1);
      // If the key expired between the read and this increment, HINCRBY just
      // recreated it without a TTL — drop that orphan instead of keeping it forever.
      if ((await redis.ttl(key)) < 0) {
        await redis.del(key);
      }
      return attempts;
    },

    async remove(id) {
      const key = keyFor(id);
      const redis = await getRedis();
      if (!redis) {
        memory.delete(key);
        return;
      }
      await redis.del(key);
    },
  };
}

/** Test helper — wipes the in-memory fallback between tests. */
export function __clearMemoryOtps(): void {
  memory.clear();
}
