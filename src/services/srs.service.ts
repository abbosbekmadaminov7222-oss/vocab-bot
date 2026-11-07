import { stateStore } from "../config/redis.js";
import { srsRepo } from "../db/repositories/srs.repo.js";
import { wordRepo } from "../db/repositories/word.repo.js";
import { User, Word } from "../db/schema.js";

export type SrsQuality = 1 | 3 | 5; // 1 = Bilmayman, 3 = Keyinroq, 5 = Bilaman

export interface Sm2State {
  easeFactor: number;
  interval: number;
  repetitions: number;
}

export interface Sm2Result extends Sm2State {
  nextReviewAt: Date;
  status: "learning" | "review" | "mastered";
}

/**
 * Pure SM-2 Spaced Repetition calculation function.
 * @param quality 0..5 rating (5 = Bilaman, 3 = Keyinroq, 1 = Bilmayman)
 * @param prev Previous SM-2 state
 * @param now Reference timestamp
 */
export function calculateSM2(
  quality: number,
  prev: Sm2State = { easeFactor: 2.5, interval: 0, repetitions: 0 },
  now: Date = new Date()
): Sm2Result {
  const q = Math.max(0, Math.min(5, quality));
  let { easeFactor, interval, repetitions } = prev;

  if (q < 3) {
    // Forgot word: reset repetitions, review again in 10 minutes (interval = 0 days)
    repetitions = 0;
    interval = 0;
  } else if (q === 3) {
    // "Keyinroq" / Hard recall: review in 1 day
    repetitions = Math.max(1, repetitions);
    interval = 1;
  } else {
    // Quality 4 or 5 ("Bilaman")
    if (repetitions === 0) {
      interval = 1;
    } else if (repetitions === 1) {
      interval = 6;
    } else {
      interval = Math.round(interval * easeFactor);
    }
    repetitions += 1;
  }

  // Standard SM-2 Ease Factor update formula
  easeFactor =
    easeFactor + (0.1 - (5 - q) * (0.08 + (5 - q) * 0.02));
  if (easeFactor < 1.3) {
    easeFactor = 1.3;
  }
  easeFactor = Math.round(easeFactor * 100) / 100;

  // Next review timestamp
  const nextReviewAt =
    interval === 0
      ? new Date(now.getTime() + 10 * 60 * 1000) // 10 minutes later for forgotten words
      : new Date(now.getTime() + interval * 24 * 60 * 60 * 1000);

  let status: "learning" | "review" | "mastered" = "learning";
  if (interval >= 21 && repetitions >= 4) {
    status = "mastered";
  } else if (repetitions >= 1 && interval >= 1) {
    status = "review";
  }

  return {
    easeFactor,
    interval,
    repetitions,
    nextReviewAt,
    status,
  };
}

export interface LearnSessionItem {
  wordId: number;
  isDueReview: boolean;
}

export interface LearnSessionState {
  userId: number;
  items: LearnSessionItem[];
  currentIndex: number;
  xpEarned: number;
}

export class SrsService {
  private getSessionKey(telegramId: number): string {
    return `learn:session:${telegramId}`;
  }

  /**
   * Builds a daily learning session prioritizing words due for review,
   * then filling up to the user's dailyGoal with unseen words of their level.
   */
  async startOrGetSession(user: User): Promise<{
    session: LearnSessionState;
    currentWord: Word | null;
  }> {
    const existing = await stateStore.get<LearnSessionState>(
      this.getSessionKey(user.telegramId)
    );

    if (existing && existing.currentIndex < existing.items.length) {
      const currentItem = existing.items[existing.currentIndex];
      if (currentItem) {
        const word = await wordRepo.findById(currentItem.wordId);
        if (word) {
          return { session: existing, currentWord: word };
        }
      }
    }

    const goal = user.dailyGoal || 10;
    const dueRecords = await srsRepo.getDueWords(user.id, goal);
    const items: LearnSessionItem[] = dueRecords.map((r) => ({
      wordId: r.word.id,
      isDueReview: true,
    }));

    const remainingNeeded = Math.max(0, goal - items.length);
    if (remainingNeeded > 0) {
      const unseen = await wordRepo.getUnseenWordsForUser(
        user.id,
        user.level,
        remainingNeeded
      );
      for (const w of unseen) {
        items.push({ wordId: w.id, isDueReview: false });
      }
    }

    const session: LearnSessionState = {
      userId: user.id,
      items,
      currentIndex: 0,
      xpEarned: 0,
    };

    if (items.length === 0) {
      return { session, currentWord: null };
    }

    await stateStore.set(this.getSessionKey(user.telegramId), session, 86400);
    const firstWord = await wordRepo.findById(items[0]!.wordId);
    return { session, currentWord: firstWord ?? null };
  }

  /**
   * Records user's rating ("Bilaman" = 5, "Keyinroq" = 3, "Bilmayman" = 1)
   * and advances the learning session.
   */
  async rateCurrentWord(
    user: User,
    wordId: number,
    quality: SrsQuality
  ): Promise<{
    sm2: Sm2Result;
    xpAdded: number;
    nextWord: Word | null;
    session: LearnSessionState | null;
  }> {
    const prevRecord = await srsRepo.findUserWord(user.id, wordId);
    const sm2 = calculateSM2(
      quality,
      prevRecord
        ? {
            easeFactor: prevRecord.easeFactor,
            interval: prevRecord.interval,
            repetitions: prevRecord.repetitions,
          }
        : undefined
    );

    await srsRepo.upsertUserWord({
      userId: user.id,
      wordId,
      easeFactor: sm2.easeFactor,
      interval: sm2.interval,
      repetitions: sm2.repetitions,
      status: sm2.status,
      nextReviewAt: sm2.nextReviewAt,
      isCorrect: quality >= 4,
    });

    const xpAdded = quality === 5 ? 10 : quality === 3 ? 5 : 2;
    const key = this.getSessionKey(user.telegramId);
    const session = await stateStore.get<LearnSessionState>(key);

    if (!session) {
      return { sm2, xpAdded, nextWord: null, session: null };
    }

    session.currentIndex += 1;
    session.xpEarned += xpAdded;

    if (session.currentIndex >= session.items.length) {
      await stateStore.del(key);
      return { sm2, xpAdded, nextWord: null, session };
    }

    await stateStore.set(key, session, 86400);
    const nextItem = session.items[session.currentIndex];
    const nextWord = nextItem
      ? (await wordRepo.findById(nextItem.wordId)) ?? null
      : null;

    return { sm2, xpAdded, nextWord, session };
  }
}

export const srsService = new SrsService();
