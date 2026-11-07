import { Redis } from "ioredis";
import { eq, lt } from "drizzle-orm";
import { env } from "./env.js";
import { logger } from "../utils/logger.js";
import { db } from "../db/index.js";
import { kvStore } from "../db/schema.js";

let redisClient: Redis | null = null;
let redisAvailable = false;

export async function initRedis(): Promise<boolean> {
  try {
    const client = new Redis(env.REDIS_URL, {
      maxRetriesPerRequest: 1,
      connectTimeout: 2000,
      lazyConnect: true,
      retryStrategy: () => null,
    });

    client.on("error", () => {
      // Handled gracefully by fallback
    });

    await client.connect();
    await client.ping();
    redisClient = client;
    redisAvailable = true;
    logger.info("Connected to Redis server.");
    return true;
  } catch {
    redisAvailable = false;
    redisClient = null;
    logger.info(
      "Redis server not reachable locally — using PostgreSQL persistent kv_store for session & game state."
    );
    return false;
  }
}

export function isRedisAvailable(): boolean {
  return redisAvailable && redisClient !== null;
}

export function getRedisClient(): Redis | null {
  return redisClient;
}

/**
 * Persistent state storage (Redis primary, PostgreSQL kv_store fallback)
 * Guarantees game/quiz/session state is never lost on bot restart.
 */
export class StateStore {
  async get<T>(key: string): Promise<T | null> {
    if (redisAvailable && redisClient) {
      const raw = await redisClient.get(key);
      return raw ? (JSON.parse(raw) as T) : null;
    }

    const [row] = await db
      .select()
      .from(kvStore)
      .where(eq(kvStore.key, key))
      .limit(1);

    if (!row) return null;

    if (row.expiresAt && row.expiresAt.getTime() < Date.now()) {
      await db.delete(kvStore).where(eq(kvStore.key, key));
      return null;
    }

    try {
      return JSON.parse(row.value) as T;
    } catch {
      return null;
    }
  }

  async set<T>(key: string, value: T, ttlSeconds = 86400): Promise<void> {
    const serialized = JSON.stringify(value);

    if (redisAvailable && redisClient) {
      await redisClient.set(key, serialized, "EX", ttlSeconds);
      return;
    }

    const expiresAt = new Date(Date.now() + ttlSeconds * 1000);
    await db
      .insert(kvStore)
      .values({ key, value: serialized, expiresAt })
      .onConflictDoUpdate({
        target: kvStore.key,
        set: { value: serialized, expiresAt },
      });
  }

  async del(key: string): Promise<void> {
    if (redisAvailable && redisClient) {
      await redisClient.del(key);
      return;
    }
    await db.delete(kvStore).where(eq(kvStore.key, key));
  }

  async cleanupExpired(): Promise<void> {
    if (!redisAvailable) {
      await db.delete(kvStore).where(lt(kvStore.expiresAt, new Date()));
    }
  }
}

export const stateStore = new StateStore();
