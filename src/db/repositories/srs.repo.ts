import { and, asc, desc, eq, lte, sql } from "drizzle-orm";
import { db } from "../index.js";
import { userWords, words, UserWord, Word } from "../schema.js";

export interface UserWordWithDetails {
  userWord: UserWord;
  word: Word;
}

export class SrsRepository {
  async findUserWord(
    userId: number,
    wordId: number
  ): Promise<UserWord | undefined> {
    const [record] = await db
      .select()
      .from(userWords)
      .where(
        and(eq(userWords.userId, userId), eq(userWords.wordId, wordId))
      )
      .limit(1);
    return record;
  }

  async getDueWords(
    userId: number,
    limit: number,
    now = new Date()
  ): Promise<UserWordWithDetails[]> {
    const rows = await db
      .select({
        userWord: userWords,
        word: words,
      })
      .from(userWords)
      .innerJoin(words, eq(userWords.wordId, words.id))
      .where(
        and(
          eq(userWords.userId, userId),
          lte(userWords.nextReviewAt, now)
        )
      )
      .orderBy(asc(userWords.nextReviewAt))
      .limit(limit);

    return rows;
  }

  async countDueWords(userId: number, now = new Date()): Promise<number> {
    const [row] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(userWords)
      .where(
        and(
          eq(userWords.userId, userId),
          lte(userWords.nextReviewAt, now)
        )
      );
    return row?.count ?? 0;
  }

  async upsertUserWord(params: {
    userId: number;
    wordId: number;
    easeFactor: number;
    interval: number;
    repetitions: number;
    status: "learning" | "review" | "mastered";
    nextReviewAt: Date;
    isCorrect: boolean;
  }): Promise<UserWord> {
    const existing = await this.findUserWord(params.userId, params.wordId);

    if (existing) {
      const [updated] = await db
        .update(userWords)
        .set({
          easeFactor: params.easeFactor,
          interval: params.interval,
          repetitions: params.repetitions,
          status: params.status,
          nextReviewAt: params.nextReviewAt,
          lastReviewedAt: new Date(),
          correctCount: existing.correctCount + (params.isCorrect ? 1 : 0),
          wrongCount: existing.wrongCount + (params.isCorrect ? 0 : 1),
        })
        .where(eq(userWords.id, existing.id))
        .returning();

      if (!updated) throw new Error("Failed to update userWord");
      return updated;
    }

    const [created] = await db
      .insert(userWords)
      .values({
        userId: params.userId,
        wordId: params.wordId,
        easeFactor: params.easeFactor,
        interval: params.interval,
        repetitions: params.repetitions,
        status: params.status,
        nextReviewAt: params.nextReviewAt,
        lastReviewedAt: new Date(),
        correctCount: params.isCorrect ? 1 : 0,
        wrongCount: params.isCorrect ? 0 : 1,
      })
      .returning();

    if (!created) throw new Error("Failed to create userWord");
    return created;
  }

  async getWeakWords(
    userId: number,
    limit = 5
  ): Promise<UserWordWithDetails[]> {
    return db
      .select({
        userWord: userWords,
        word: words,
      })
      .from(userWords)
      .innerJoin(words, eq(userWords.wordId, words.id))
      .where(
        and(
          eq(userWords.userId, userId),
          sql`${userWords.wrongCount} > 0`
        )
      )
      .orderBy(desc(userWords.wrongCount), asc(userWords.easeFactor))
      .limit(limit);
  }

  async getUserLearnedWords(
    userId: number,
    limit = 30
  ): Promise<UserWordWithDetails[]> {
    return db
      .select({
        userWord: userWords,
        word: words,
      })
      .from(userWords)
      .innerJoin(words, eq(userWords.wordId, words.id))
      .where(eq(userWords.userId, userId))
      .orderBy(desc(userWords.lastReviewedAt))
      .limit(limit);
  }
}

export const srsRepo = new SrsRepository();
