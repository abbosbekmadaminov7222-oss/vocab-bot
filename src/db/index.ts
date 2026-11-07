import { drizzle as drizzlePg, NodePgDatabase } from "drizzle-orm/node-postgres";
import { drizzle as drizzlePglite, PgliteDatabase } from "drizzle-orm/pglite";
import { PGlite } from "@electric-sql/pglite";
import pg from "pg";
import fs from "node:fs";
import path from "node:path";
import { sql } from "drizzle-orm";
import { env } from "../config/env.js";
import { logger } from "../utils/logger.js";
import * as schema from "./schema.js";

export type AppDatabase =
  | NodePgDatabase<typeof schema>
  | PgliteDatabase<typeof schema>;

let dbInstance: AppDatabase | null = null;
let pgPool: pg.Pool | null = null;
let pgliteClient: PGlite | null = null;

function createDatabase(): AppDatabase {
  if (dbInstance) return dbInstance;

  if (
    env.DATABASE_URL.startsWith("postgres://") ||
    env.DATABASE_URL.startsWith("postgresql://")
  ) {
    pgPool = new pg.Pool({
      connectionString: env.DATABASE_URL,
      max: 20,
      idleTimeoutMillis: 30000,
    });
    pgPool.on("error", (err) => {
      logger.error({ err }, "Unexpected PostgreSQL pool error");
    });
    dbInstance = drizzlePg(pgPool, { schema });
    logger.info("Connected to PostgreSQL server via pg.Pool");
  } else {
    const dataDir = env.DATABASE_URL.replace(/^file:/, "") || "./data/pglite";
    const resolvedDir = path.resolve(process.cwd(), dataDir);
    fs.mkdirSync(resolvedDir, { recursive: true });
    pgliteClient = new PGlite(resolvedDir);
    dbInstance = drizzlePglite(pgliteClient, { schema });
    logger.info({ dir: resolvedDir }, "Initialized embedded PostgreSQL (PGlite)");
  }

  return dbInstance;
}

export const db: AppDatabase = createDatabase();

/**
 * Ensures all enums, tables, and indexes exist in PostgreSQL (works for both pg.Pool and PGlite).
 */
export async function ensureSchema(): Promise<void> {
  const ddl = `
    DO $$ BEGIN
      CREATE TYPE cefr_level AS ENUM ('A1', 'A2', 'B1', 'B2', 'C1');
    EXCEPTION WHEN duplicate_object THEN NULL; END $$;

    DO $$ BEGIN
      CREATE TYPE part_of_speech AS ENUM ('noun', 'verb', 'adjective', 'adverb', 'phrase', 'other');
    EXCEPTION WHEN duplicate_object THEN NULL; END $$;

    DO $$ BEGIN
      CREATE TYPE srs_status AS ENUM ('learning', 'review', 'mastered');
    EXCEPTION WHEN duplicate_object THEN NULL; END $$;

    DO $$ BEGIN
      CREATE TYPE game_type AS ENUM (
        'quiz_mc_en_uz', 'quiz_mc_uz_en', 'quiz_typing', 'quiz_listening',
        'game_scramble', 'game_hangman', 'game_matching', 'game_speed'
      );
    EXCEPTION WHEN duplicate_object THEN NULL; END $$;

    CREATE TABLE IF NOT EXISTS users (
      id SERIAL PRIMARY KEY,
      telegram_id BIGINT NOT NULL,
      username VARCHAR(128),
      first_name VARCHAR(128) NOT NULL DEFAULT 'O''quvchi',
      level cefr_level NOT NULL DEFAULT 'A1',
      daily_goal INTEGER NOT NULL DEFAULT 10,
      xp INTEGER NOT NULL DEFAULT 0,
      weekly_xp INTEGER NOT NULL DEFAULT 0,
      user_level INTEGER NOT NULL DEFAULT 1,
      streak INTEGER NOT NULL DEFAULT 0,
      last_active_date VARCHAR(16),
      words_learned_today INTEGER NOT NULL DEFAULT 0,
      last_learned_date VARCHAR(16),
      reminder_hour INTEGER NOT NULL DEFAULT 9,
      reminders_enabled BOOLEAN NOT NULL DEFAULT TRUE,
      onboarded BOOLEAN NOT NULL DEFAULT FALSE,
      referred_by BIGINT,
      referrals_count INTEGER NOT NULL DEFAULT 0,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
    ALTER TABLE users ADD COLUMN IF NOT EXISTS referred_by BIGINT;
    ALTER TABLE users ADD COLUMN IF NOT EXISTS referrals_count INTEGER NOT NULL DEFAULT 0;

    CREATE UNIQUE INDEX IF NOT EXISTS users_telegram_id_idx ON users (telegram_id);
    CREATE INDEX IF NOT EXISTS users_weekly_xp_idx ON users (weekly_xp);
    CREATE INDEX IF NOT EXISTS users_reminder_hour_idx ON users (reminder_hour, reminders_enabled);

    CREATE TABLE IF NOT EXISTS words (
      id SERIAL PRIMARY KEY,
      english VARCHAR(128) NOT NULL,
      uzbek VARCHAR(256) NOT NULL,
      pos part_of_speech NOT NULL DEFAULT 'noun',
      level cefr_level NOT NULL DEFAULT 'A1',
      topic VARCHAR(64) NOT NULL DEFAULT 'general',
      example_en TEXT NOT NULL,
      example_uz TEXT NOT NULL DEFAULT '',
      ipa VARCHAR(128),
      audio_file_id VARCHAR(256),
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
    CREATE UNIQUE INDEX IF NOT EXISTS words_english_level_idx ON words (english, level);
    CREATE INDEX IF NOT EXISTS words_level_topic_idx ON words (level, topic);
    CREATE INDEX IF NOT EXISTS words_level_pos_idx ON words (level, pos);

    CREATE TABLE IF NOT EXISTS user_words (
      id SERIAL PRIMARY KEY,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      word_id INTEGER NOT NULL REFERENCES words(id) ON DELETE CASCADE,
      ease_factor REAL NOT NULL DEFAULT 2.5,
      interval INTEGER NOT NULL DEFAULT 0,
      repetitions INTEGER NOT NULL DEFAULT 0,
      status srs_status NOT NULL DEFAULT 'learning',
      next_review_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      last_reviewed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      correct_count INTEGER NOT NULL DEFAULT 0,
      wrong_count INTEGER NOT NULL DEFAULT 0
    );
    CREATE UNIQUE INDEX IF NOT EXISTS user_words_user_word_idx ON user_words (user_id, word_id);
    CREATE INDEX IF NOT EXISTS user_words_due_idx ON user_words (user_id, next_review_at);

    CREATE TABLE IF NOT EXISTS quiz_history (
      id SERIAL PRIMARY KEY,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      game_type game_type NOT NULL,
      score INTEGER NOT NULL,
      total_questions INTEGER NOT NULL,
      xp_earned INTEGER NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
    CREATE INDEX IF NOT EXISTS quiz_history_user_idx ON quiz_history (user_id, created_at);

    CREATE TABLE IF NOT EXISTS user_achievements (
      id SERIAL PRIMARY KEY,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      achievement_code VARCHAR(64) NOT NULL,
      unlocked_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
    CREATE UNIQUE INDEX IF NOT EXISTS user_achievements_unique_idx ON user_achievements (user_id, achievement_code);

    CREATE TABLE IF NOT EXISTS kv_store (
      key VARCHAR(255) PRIMARY KEY,
      value TEXT NOT NULL,
      expires_at TIMESTAMPTZ
    );
  `;

  if (pgliteClient) {
    await pgliteClient.exec(ddl);
  } else {
    await db.execute(sql.raw(ddl));
  }
  logger.info("Database schema verified and ready.");
}

export async function closeDatabase(): Promise<void> {
  if (pgPool) {
    await pgPool.end();
  }
  if (pgliteClient) {
    await pgliteClient.close();
  }
}
