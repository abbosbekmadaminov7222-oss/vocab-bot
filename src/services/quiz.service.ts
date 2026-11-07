import { stateStore } from "../config/redis.js";
import { wordRepo } from "../db/repositories/word.repo.js";
import { srsRepo } from "../db/repositories/srs.repo.js";
import { statsRepo } from "../db/repositories/stats.repo.js";
import { User, Word, GameType } from "../db/schema.js";
import { checkTypedAnswer, shuffleArray } from "../utils/text.js";
import { calculateSM2 } from "./srs.service.js";
import { xpService } from "./xp.service.js";

export type QuizMode = "en_uz" | "uz_en" | "typing" | "listening";

export interface QuizQuestion {
  wordId: number;
  english: string;
  uzbek: string;
  pos: string;
  ipa: string;
  exampleEn: string;
  audioFileId: string | null;
  options: string[];
  correctIndex: number;
}

export interface QuizSessionState {
  telegramId: number;
  userId: number;
  mode: QuizMode;
  questions: QuizQuestion[];
  currentIndex: number;
  score: number;
  xpEarned: number;
}

export class QuizService {
  private getKey(telegramId: number): string {
    return `quiz:session:${telegramId}`;
  }

  async getActiveSession(
    telegramId: number
  ): Promise<QuizSessionState | null> {
    return stateStore.get<QuizSessionState>(this.getKey(telegramId));
  }

  async clearSession(telegramId: number): Promise<void> {
    await stateStore.del(this.getKey(telegramId));
  }

  async startQuiz(
    user: User,
    mode: QuizMode,
    count = 5
  ): Promise<QuizSessionState> {
    // Prefer words the user has studied, supplemented with level words
    const learned = await srsRepo.getUserLearnedWords(user.id, count * 2);
    const pool: Word[] = learned.map((r) => r.word);

    if (pool.length < count) {
      const randomWords = await wordRepo.getRandomWords(
        user.level,
        count - pool.length + 4
      );
      const seenIds = new Set(pool.map((w) => w.id));
      for (const rw of randomWords) {
        if (!seenIds.has(rw.id)) {
          pool.push(rw);
          seenIds.add(rw.id);
        }
      }
    }

    const selectedWords = shuffleArray(pool).slice(0, count);
    const questions: QuizQuestion[] = [];

    for (const target of selectedWords) {
      const distractors = await wordRepo.getSmartDistractors(target, 3);
      const allChoices = shuffleArray([target, ...distractors]);

      const options = allChoices.map((w) =>
        mode === "en_uz" ? w.uzbek : w.english
      );
      const correctValue = mode === "en_uz" ? target.uzbek : target.english;
      const correctIndex = options.indexOf(correctValue);

      questions.push({
        wordId: target.id,
        english: target.english,
        uzbek: target.uzbek,
        pos: target.pos,
        ipa: target.ipa ?? `/${target.english}/`,
        exampleEn: target.exampleEn,
        audioFileId: target.audioFileId,
        options,
        correctIndex: correctIndex >= 0 ? correctIndex : 0,
      });
    }

    const session: QuizSessionState = {
      telegramId: user.telegramId,
      userId: user.id,
      mode,
      questions,
      currentIndex: 0,
      score: 0,
      xpEarned: 0,
    };

    await stateStore.set(this.getKey(user.telegramId), session, 3600);
    return session;
  }

  async submitChoiceAnswer(
    user: User,
    optionIndex: number
  ): Promise<{
    isCorrect: boolean;
    question: QuizQuestion;
    session: QuizSessionState;
    finished: boolean;
  } | null> {
    const session = await this.getActiveSession(user.telegramId);
    if (!session || session.mode === "typing") return null;

    const question = session.questions[session.currentIndex];
    if (!question) return null;

    const isCorrect = optionIndex === question.correctIndex;
    const xpGain = isCorrect ? 10 : 0;

    if (isCorrect) {
      session.score += 1;
      session.xpEarned += xpGain;
    }

    await this.updateSrsFromQuiz(user.id, question.wordId, isCorrect);
    session.currentIndex += 1;

    const finished = session.currentIndex >= session.questions.length;
    if (finished) {
      await this.finalizeQuiz(user, session);
    } else {
      await stateStore.set(this.getKey(user.telegramId), session, 3600);
    }

    return {
      isCorrect,
      question,
      session,
      finished,
    };
  }

  async submitTypedAnswer(
    user: User,
    typedText: string
  ): Promise<{
    isCorrect: boolean;
    isExact: boolean;
    question: QuizQuestion;
    session: QuizSessionState;
    finished: boolean;
  } | null> {
    const session = await this.getActiveSession(user.telegramId);
    if (!session || session.mode !== "typing") return null;

    const question = session.questions[session.currentIndex];
    if (!question) return null;

    const check = checkTypedAnswer(typedText, question.english);
    const xpGain = check.isCorrect ? (check.isExact ? 12 : 8) : 0;

    if (check.isCorrect) {
      session.score += 1;
      session.xpEarned += xpGain;
    }

    await this.updateSrsFromQuiz(user.id, question.wordId, check.isCorrect);
    session.currentIndex += 1;

    const finished = session.currentIndex >= session.questions.length;
    if (finished) {
      await this.finalizeQuiz(user, session);
    } else {
      await stateStore.set(this.getKey(user.telegramId), session, 3600);
    }

    return {
      isCorrect: check.isCorrect,
      isExact: check.isExact,
      question,
      session,
      finished,
    };
  }

  private async updateSrsFromQuiz(
    userId: number,
    wordId: number,
    isCorrect: boolean
  ): Promise<void> {
    const prev = await srsRepo.findUserWord(userId, wordId);
    const sm2 = calculateSM2(
      isCorrect ? 4 : 1,
      prev
        ? {
            easeFactor: prev.easeFactor,
            interval: prev.interval,
            repetitions: prev.repetitions,
          }
        : undefined
    );

    await srsRepo.upsertUserWord({
      userId,
      wordId,
      easeFactor: sm2.easeFactor,
      interval: sm2.interval,
      repetitions: sm2.repetitions,
      status: sm2.status,
      nextReviewAt: sm2.nextReviewAt,
      isCorrect,
    });
  }

  private async finalizeQuiz(
    user: User,
    session: QuizSessionState
  ): Promise<void> {
    await stateStore.del(this.getKey(user.telegramId));

    const gameTypeMap: Record<QuizMode, GameType> = {
      en_uz: "quiz_mc_en_uz",
      uz_en: "quiz_mc_uz_en",
      typing: "quiz_typing",
      listening: "quiz_listening",
    };

    await statsRepo.recordQuizHistory({
      userId: user.id,
      gameType: gameTypeMap[session.mode],
      score: session.score,
      totalQuestions: session.questions.length,
      xpEarned: session.xpEarned,
    });

    await xpService.awardXpAndStreak(user, session.xpEarned, 0);

    if (
      session.questions.length > 0 &&
      session.score === session.questions.length
    ) {
      await xpService.unlockSpecificAchievement(user.id, "quiz_master");
    }
  }
}

export const quizService = new QuizService();
