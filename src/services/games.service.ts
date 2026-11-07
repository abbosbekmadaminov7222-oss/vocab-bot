import { stateStore } from "../config/redis.js";
import { wordRepo } from "../db/repositories/word.repo.js";
import { statsRepo } from "../db/repositories/stats.repo.js";
import { User } from "../db/schema.js";
import { shuffleArray } from "../utils/text.js";
import { xpService } from "./xp.service.js";

// ==================== 1. WORD SCRAMBLE ====================
export interface ScrambleState {
  wordId: number;
  english: string;
  uzbek: string;
  letters: { char: string; used: boolean }[];
  built: string;
}

// ==================== 2. HANGMAN ====================
export interface HangmanState {
  wordId: number;
  english: string;
  uzbek: string;
  guessedLetters: string[];
  livesLeft: number;
  maxLives: number;
}

// ==================== 3. MATCHING PAIRS ====================
export interface MatchingCard {
  index: number;
  pairId: number;
  text: string;
  side: "en" | "uz";
  matched: boolean;
}

export interface MatchingState {
  cards: MatchingCard[];
  selectedIndex: number | null;
  mistakes: number;
  matchesFound: number;
  totalPairs: number;
}

// ==================== 4. SPEED ROUND (60s) ====================
export interface SpeedQuestion {
  wordId: number;
  english: string;
  uzbek: string;
  options: string[];
  correctIndex: number;
}

export interface SpeedRoundState {
  expiresAt: number;
  score: number;
  answered: number;
  currentQuestion: SpeedQuestion;
}

export class GamesService {
  // ---------------- SCRAMBLE ----------------
  private scrambleKey(telegramId: number): string {
    return `game:scramble:${telegramId}`;
  }

  async startScramble(user: User): Promise<ScrambleState> {
    const candidates = await wordRepo.getRandomWords(user.level, 8);
    const chosen =
      candidates.find(
        (w) => w.english.length >= 4 && w.english.length <= 9 && !w.english.includes(" ")
      ) ?? candidates[0]!;

    const cleanWord = chosen.english.toUpperCase();
    let chars = shuffleArray(cleanWord.split(""));
    if (chars.join("") === cleanWord && cleanWord.length > 1) {
      chars = chars.reverse();
    }

    const state: ScrambleState = {
      wordId: chosen.id,
      english: cleanWord,
      uzbek: chosen.uzbek,
      letters: chars.map((char) => ({ char, used: false })),
      built: "",
    };

    await stateStore.set(this.scrambleKey(user.telegramId), state, 1800);
    return state;
  }

  async pickScrambleLetter(
    user: User,
    letterIdx: number
  ): Promise<{
    state: ScrambleState;
    status: "playing" | "won" | "wrong";
    xpEarned: number;
  } | null> {
    const state = await stateStore.get<ScrambleState>(
      this.scrambleKey(user.telegramId)
    );
    if (!state) return null;

    if (letterIdx === -1) {
      // Reset current attempt
      state.built = "";
      state.letters.forEach((l) => {
        l.used = false;
      });
      await stateStore.set(this.scrambleKey(user.telegramId), state, 1800);
      return { state, status: "playing", xpEarned: 0 };
    }

    const slot = state.letters[letterIdx];
    if (!slot || slot.used) {
      return { state, status: "playing", xpEarned: 0 };
    }

    slot.used = true;
    state.built += slot.char;

    if (state.built.length < state.english.length) {
      await stateStore.set(this.scrambleKey(user.telegramId), state, 1800);
      return { state, status: "playing", xpEarned: 0 };
    }

    // Completed word check
    if (state.built === state.english) {
      await stateStore.del(this.scrambleKey(user.telegramId));
      const xpEarned = 15;
      await statsRepo.recordQuizHistory({
        userId: user.id,
        gameType: "game_scramble",
        score: 1,
        totalQuestions: 1,
        xpEarned,
      });
      await xpService.awardXpAndStreak(user, xpEarned, 0);
      return { state, status: "won", xpEarned };
    } else {
      // Reset letters so user can try again or reveal
      state.built = "";
      state.letters.forEach((l) => {
        l.used = false;
      });
      await stateStore.set(this.scrambleKey(user.telegramId), state, 1800);
      return { state, status: "wrong", xpEarned: 0 };
    }
  }

  // ---------------- HANGMAN ----------------
  private hangmanKey(telegramId: number): string {
    return `game:hangman:${telegramId}`;
  }

  async startHangman(user: User): Promise<HangmanState> {
    const candidates = await wordRepo.getRandomWords(user.level, 8);
    const chosen =
      candidates.find(
        (w) => w.english.length >= 4 && !w.english.includes(" ")
      ) ?? candidates[0]!;

    const state: HangmanState = {
      wordId: chosen.id,
      english: chosen.english.toUpperCase(),
      uzbek: chosen.uzbek,
      guessedLetters: [],
      livesLeft: 6,
      maxLives: 6,
    };

    await stateStore.set(this.hangmanKey(user.telegramId), state, 1800);
    return state;
  }

  async guessHangmanLetter(
    user: User,
    letter: string
  ): Promise<{
    state: HangmanState;
    status: "playing" | "won" | "lost";
    xpEarned: number;
  } | null> {
    const state = await stateStore.get<HangmanState>(
      this.hangmanKey(user.telegramId)
    );
    if (!state) return null;

    const upper = letter.toUpperCase();
    if (!state.guessedLetters.includes(upper)) {
      state.guessedLetters.push(upper);
      if (!state.english.includes(upper)) {
        state.livesLeft -= 1;
      }
    }

    const allRevealed = state.english
      .split("")
      .every((ch) => state.guessedLetters.includes(ch));

    if (allRevealed) {
      await stateStore.del(this.hangmanKey(user.telegramId));
      const xpEarned = 20;
      await statsRepo.recordQuizHistory({
        userId: user.id,
        gameType: "game_hangman",
        score: 1,
        totalQuestions: 1,
        xpEarned,
      });
      await xpService.awardXpAndStreak(user, xpEarned, 0);
      return { state, status: "won", xpEarned };
    }

    if (state.livesLeft <= 0) {
      await stateStore.del(this.hangmanKey(user.telegramId));
      await statsRepo.recordQuizHistory({
        userId: user.id,
        gameType: "game_hangman",
        score: 0,
        totalQuestions: 1,
        xpEarned: 0,
      });
      return { state, status: "lost", xpEarned: 0 };
    }

    await stateStore.set(this.hangmanKey(user.telegramId), state, 1800);
    return { state, status: "playing", xpEarned: 0 };
  }

  // ---------------- MATCHING PAIRS ----------------
  private matchingKey(telegramId: number): string {
    return `game:matching:${telegramId}`;
  }

  async startMatching(user: User): Promise<MatchingState> {
    const words = await wordRepo.getRandomWords(user.level, 4);
    const rawCards: Omit<MatchingCard, "index">[] = [];

    for (const w of words) {
      rawCards.push({
        pairId: w.id,
        text: `🇬🇧 ${w.english}`,
        side: "en",
        matched: false,
      });
      rawCards.push({
        pairId: w.id,
        text: `🇺🇿 ${w.uzbek}`,
        side: "uz",
        matched: false,
      });
    }

    const shuffled = shuffleArray(rawCards).map((c, idx) => ({
      ...c,
      index: idx,
    }));

    const state: MatchingState = {
      cards: shuffled,
      selectedIndex: null,
      mistakes: 0,
      matchesFound: 0,
      totalPairs: words.length,
    };

    await stateStore.set(this.matchingKey(user.telegramId), state, 1800);
    return state;
  }

  async selectMatchingCard(
    user: User,
    cardIdx: number
  ): Promise<{
    state: MatchingState;
    event: "selected" | "matched" | "mismatch" | "finished";
    xpEarned: number;
  } | null> {
    const state = await stateStore.get<MatchingState>(
      this.matchingKey(user.telegramId)
    );
    if (!state) return null;

    const card = state.cards[cardIdx];
    if (!card || card.matched) {
      return { state, event: "selected", xpEarned: 0 };
    }

    if (state.selectedIndex === null || state.selectedIndex === cardIdx) {
      state.selectedIndex = cardIdx;
      await stateStore.set(this.matchingKey(user.telegramId), state, 1800);
      return { state, event: "selected", xpEarned: 0 };
    }

    const firstCard = state.cards[state.selectedIndex];
    if (!firstCard) {
      state.selectedIndex = cardIdx;
      await stateStore.set(this.matchingKey(user.telegramId), state, 1800);
      return { state, event: "selected", xpEarned: 0 };
    }

    if (
      firstCard.pairId === card.pairId &&
      firstCard.side !== card.side
    ) {
      firstCard.matched = true;
      card.matched = true;
      state.selectedIndex = null;
      state.matchesFound += 1;

      if (state.matchesFound >= state.totalPairs) {
        await stateStore.del(this.matchingKey(user.telegramId));
        const xpEarned = Math.max(10, 25 - state.mistakes * 3);
        await statsRepo.recordQuizHistory({
          userId: user.id,
          gameType: "game_matching",
          score: state.totalPairs,
          totalQuestions: state.totalPairs + state.mistakes,
          xpEarned,
        });
        await xpService.awardXpAndStreak(user, xpEarned, 0);
        return { state, event: "finished", xpEarned };
      }

      await stateStore.set(this.matchingKey(user.telegramId), state, 1800);
      return { state, event: "matched", xpEarned: 0 };
    } else {
      state.mistakes += 1;
      state.selectedIndex = null;
      await stateStore.set(this.matchingKey(user.telegramId), state, 1800);
      return { state, event: "mismatch", xpEarned: 0 };
    }
  }

  // ---------------- SPEED ROUND (60 SECONDS) ----------------
  private speedKey(telegramId: number): string {
    return `game:speed:${telegramId}`;
  }

  private async buildSpeedQuestion(user: User): Promise<SpeedQuestion> {
    const [target] = await wordRepo.getRandomWords(user.level, 1);
    if (!target) {
      throw new Error("No words in database");
    }
    const distractors = await wordRepo.getSmartDistractors(target, 3);
    const choices = shuffleArray([target, ...distractors]);
    const options = choices.map((c) => c.uzbek);
    const correctIndex = options.indexOf(target.uzbek);

    return {
      wordId: target.id,
      english: target.english,
      uzbek: target.uzbek,
      options,
      correctIndex: correctIndex >= 0 ? correctIndex : 0,
    };
  }

  async startSpeedRound(user: User): Promise<SpeedRoundState> {
    const currentQuestion = await this.buildSpeedQuestion(user);
    const state: SpeedRoundState = {
      expiresAt: Date.now() + 60_000,
      score: 0,
      answered: 0,
      currentQuestion,
    };
    await stateStore.set(this.speedKey(user.telegramId), state, 120);
    return state;
  }

  async answerSpeedRound(
    user: User,
    optionIdx: number
  ): Promise<{
    state: SpeedRoundState;
    isCorrect: boolean;
    timeUp: boolean;
    xpEarned: number;
  } | null> {
    const state = await stateStore.get<SpeedRoundState>(
      this.speedKey(user.telegramId)
    );
    if (!state) return null;

    const isCorrect = optionIdx === state.currentQuestion.correctIndex;
    const now = Date.now();

    if (now < state.expiresAt) {
      state.answered += 1;
      if (isCorrect) {
        state.score += 1;
      }
    }

    if (now >= state.expiresAt) {
      await stateStore.del(this.speedKey(user.telegramId));
      const xpEarned = state.score * 5;
      await statsRepo.recordQuizHistory({
        userId: user.id,
        gameType: "game_speed",
        score: state.score,
        totalQuestions: Math.max(1, state.answered),
        xpEarned,
      });
      await xpService.awardXpAndStreak(user, xpEarned, 0);
      if (state.score >= 8) {
        await xpService.unlockSpecificAchievement(user.id, "speed_demon");
      }
      return { state, isCorrect, timeUp: true, xpEarned };
    }

    state.currentQuestion = await this.buildSpeedQuestion(user);
    await stateStore.set(this.speedKey(user.telegramId), state, 120);
    return { state, isCorrect, timeUp: false, xpEarned: 0 };
  }
}

export const gamesService = new GamesService();
