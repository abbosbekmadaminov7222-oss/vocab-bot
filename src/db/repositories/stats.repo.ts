import { eq, sql } from "drizzle-orm";
import { db } from "../index.js";
import {
  userWords,
  quizHistory,
  userAchievements,
  GameType,
} from "../schema.js";

export interface UserStatsSummary {
  totalSeen: number;
  learningCount: number;
  reviewCount: number;
  masteredCount: number;
  dueCount: number;
  totalCorrect: number;
  totalWrong: number;
  accuracyPercent: number;
  quizzesPlayed: number;
  achievements: string[];
}

export class StatsRepository {
  async getUserStats(userId: number): Promise<UserStatsSummary> {
    const [wordCounts] = await db
      .select({
        totalSeen: sql<number>`count(*)::int`,
        learningCount: sql<number>`count(*) filter (where ${userWords.status} = 'learning')::int`,
        reviewCount: sql<number>`count(*) filter (where ${userWords.status} = 'review')::int`,
        masteredCount: sql<number>`count(*) filter (where ${userWords.status} = 'mastered')::int`,
        dueCount: sql<number>`count(*) filter (where ${userWords.nextReviewAt} <= now())::int`,
        totalCorrect: sql<number>`coalesce(sum(${userWords.correctCount}), 0)::int`,
        totalWrong: sql<number>`coalesce(sum(${userWords.wrongCount}), 0)::int`,
      })
      .from(userWords)
      .where(eq(userWords.userId, userId));

    const [quizCountRow] = await db
      .select({
        quizzesPlayed: sql<number>`count(*)::int`,
      })
      .from(quizHistory)
      .where(eq(quizHistory.userId, userId));

    const achievementRows = await db
      .select({ code: userAchievements.achievementCode })
      .from(userAchievements)
      .where(eq(userAchievements.userId, userId));

    const totalCorrect = wordCounts?.totalCorrect ?? 0;
    const totalWrong = wordCounts?.totalWrong ?? 0;
    const totalAttempts = totalCorrect + totalWrong;
    const accuracyPercent =
      totalAttempts > 0 ? Math.round((totalCorrect / totalAttempts) * 100) : 0;

    return {
      totalSeen: wordCounts?.totalSeen ?? 0,
      learningCount: wordCounts?.learningCount ?? 0,
      reviewCount: wordCounts?.reviewCount ?? 0,
      masteredCount: wordCounts?.masteredCount ?? 0,
      dueCount: wordCounts?.dueCount ?? 0,
      totalCorrect,
      totalWrong,
      accuracyPercent,
      quizzesPlayed: quizCountRow?.quizzesPlayed ?? 0,
      achievements: achievementRows.map((a) => a.code),
    };
  }

  async recordQuizHistory(params: {
    userId: number;
    gameType: GameType;
    score: number;
    totalQuestions: number;
    xpEarned: number;
  }): Promise<void> {
    await db.insert(quizHistory).values(params);
  }

  async unlockAchievement(
    userId: number,
    achievementCode: string
  ): Promise<boolean> {
    const existing = await db
      .select()
      .from(userAchievements)
      .where(
        sql`${userAchievements.userId} = ${userId} AND ${userAchievements.achievementCode} = ${achievementCode}`
      )
      .limit(1);

    if (existing.length > 0) {
      return false;
    }

    await db.insert(userAchievements).values({
      userId,
      achievementCode,
    });
    return true;
  }
}

export const statsRepo = new StatsRepository();
