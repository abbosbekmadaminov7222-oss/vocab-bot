import {
  pgTable,
  serial,
  bigint,
  varchar,
  text,
  integer,
  real,
  boolean,
  timestamp,
  pgEnum,
  uniqueIndex,
  index,
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";

export const cefrLevelEnum = pgEnum("cefr_level", [
  "A1",
  "A2",
  "B1",
  "B2",
  "C1",
]);

export const partOfSpeechEnum = pgEnum("part_of_speech", [
  "noun",
  "verb",
  "adjective",
  "adverb",
  "phrase",
  "other",
]);

export const srsStatusEnum = pgEnum("srs_status", [
  "learning",
  "review",
  "mastered",
]);

export const gameTypeEnum = pgEnum("game_type", [
  "quiz_mc_en_uz",
  "quiz_mc_uz_en",
  "quiz_typing",
  "quiz_listening",
  "game_scramble",
  "game_hangman",
  "game_matching",
  "game_speed",
]);

export const users = pgTable(
  "users",
  {
    id: serial("id").primaryKey(),
    telegramId: bigint("telegram_id", { mode: "number" }).notNull(),
    username: varchar("username", { length: 128 }),
    firstName: varchar("first_name", { length: 128 }).notNull().default("O'quvchi"),
    level: cefrLevelEnum("level").notNull().default("A1"),
    dailyGoal: integer("daily_goal").notNull().default(10),
    xp: integer("xp").notNull().default(0),
    weeklyXp: integer("weekly_xp").notNull().default(0),
    userLevel: integer("user_level").notNull().default(1),
    streak: integer("streak").notNull().default(0),
    lastActiveDate: varchar("last_active_date", { length: 16 }),
    wordsLearnedToday: integer("words_learned_today").notNull().default(0),
    lastLearnedDate: varchar("last_learned_date", { length: 16 }),
    reminderHour: integer("reminder_hour").notNull().default(9),
    remindersEnabled: boolean("reminders_enabled").notNull().default(true),
    onboarded: boolean("onboarded").notNull().default(false),
    referredBy: bigint("referred_by", { mode: "number" }),
    referralsCount: integer("referrals_count").notNull().default(0),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    uniqueIndex("users_telegram_id_idx").on(table.telegramId),
    index("users_weekly_xp_idx").on(table.weeklyXp),
    index("users_reminder_hour_idx").on(table.reminderHour, table.remindersEnabled),
  ]
);

export const words = pgTable(
  "words",
  {
    id: serial("id").primaryKey(),
    english: varchar("english", { length: 128 }).notNull(),
    uzbek: varchar("uzbek", { length: 256 }).notNull(),
    pos: partOfSpeechEnum("pos").notNull().default("noun"),
    level: cefrLevelEnum("level").notNull().default("A1"),
    topic: varchar("topic", { length: 64 }).notNull().default("general"),
    exampleEn: text("example_en").notNull(),
    exampleUz: text("example_uz").notNull().default(""),
    ipa: varchar("ipa", { length: 128 }),
    audioFileId: varchar("audio_file_id", { length: 256 }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    uniqueIndex("words_english_level_idx").on(table.english, table.level),
    index("words_level_topic_idx").on(table.level, table.topic),
    index("words_level_pos_idx").on(table.level, table.pos),
  ]
);

export const userWords = pgTable(
  "user_words",
  {
    id: serial("id").primaryKey(),
    userId: integer("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    wordId: integer("word_id")
      .notNull()
      .references(() => words.id, { onDelete: "cascade" }),
    easeFactor: real("ease_factor").notNull().default(2.5),
    interval: integer("interval").notNull().default(0),
    repetitions: integer("repetitions").notNull().default(0),
    status: srsStatusEnum("status").notNull().default("learning"),
    nextReviewAt: timestamp("next_review_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    lastReviewedAt: timestamp("last_reviewed_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    correctCount: integer("correct_count").notNull().default(0),
    wrongCount: integer("wrong_count").notNull().default(0),
  },
  (table) => [
    uniqueIndex("user_words_user_word_idx").on(table.userId, table.wordId),
    index("user_words_due_idx").on(table.userId, table.nextReviewAt),
  ]
);

export const quizHistory = pgTable(
  "quiz_history",
  {
    id: serial("id").primaryKey(),
    userId: integer("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    gameType: gameTypeEnum("game_type").notNull(),
    score: integer("score").notNull(),
    totalQuestions: integer("total_questions").notNull(),
    xpEarned: integer("xp_earned").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [index("quiz_history_user_idx").on(table.userId, table.createdAt)]
);

export const userAchievements = pgTable(
  "user_achievements",
  {
    id: serial("id").primaryKey(),
    userId: integer("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    achievementCode: varchar("achievement_code", { length: 64 }).notNull(),
    unlockedAt: timestamp("unlocked_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    uniqueIndex("user_achievements_unique_idx").on(
      table.userId,
      table.achievementCode
    ),
  ]
);

// Persistent key-value store fallback for game/quiz state when Redis is unavailable
export const kvStore = pgTable("kv_store", {
  key: varchar("key", { length: 255 }).primaryKey(),
  value: text("value").notNull(),
  expiresAt: timestamp("expires_at", { withTimezone: true }),
});

// Relations
export const usersRelations = relations(users, ({ many }) => ({
  userWords: many(userWords),
  quizHistory: many(quizHistory),
  achievements: many(userAchievements),
}));

export const wordsRelations = relations(words, ({ many }) => ({
  userWords: many(userWords),
}));

export const userWordsRelations = relations(userWords, ({ one }) => ({
  user: one(users, {
    fields: [userWords.userId],
    references: [users.id],
  }),
  word: one(words, {
    fields: [userWords.wordId],
    references: [words.id],
  }),
}));

export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;
export type Word = typeof words.$inferSelect;
export type NewWord = typeof words.$inferInsert;
export type UserWord = typeof userWords.$inferSelect;
export type NewUserWord = typeof userWords.$inferInsert;
export type CefrLevel = (typeof cefrLevelEnum.enumValues)[number];
export type PartOfSpeech = (typeof partOfSpeechEnum.enumValues)[number];
export type GameType = (typeof gameTypeEnum.enumValues)[number];
