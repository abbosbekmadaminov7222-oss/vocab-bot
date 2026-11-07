import { userRepo } from "../db/repositories/user.repo.js";
import { statsRepo } from "../db/repositories/stats.repo.js";
import { User } from "../db/schema.js";
import { env } from "../config/env.js";

export interface AchievementDef {
  code: string;
  titleUz: string;
  descriptionUz: string;
  icon: string;
}

export const ACHIEVEMENTS: Record<string, AchievementDef> = {
  first_word: {
    code: "first_word",
    titleUz: "Ilk qadam",
    descriptionUz: "Birinchi so'zni o'rgandingiz!",
    icon: "🌱",
  },
  streak_3: {
    code: "streak_3",
    titleUz: "3 kunlik intizom",
    descriptionUz: "Ketma-ket 3 kun dars qildingiz!",
    icon: "🔥",
  },
  streak_7: {
    code: "streak_7",
    titleUz: "Hafta qahramoni",
    descriptionUz: "7 kun uzluksiz faollik!",
    icon: "⚡",
  },
  words_25: {
    code: "words_25",
    titleUz: "Lug'at boyituvchi",
    descriptionUz: "25 ta so'zni ko'rib chiqdingiz!",
    icon: "📘",
  },
  words_100: {
    code: "words_100",
    titleUz: "Yuzlik marrasi",
    descriptionUz: "100 ta so'z o'rgandingiz!",
    icon: "🎓",
  },
  quiz_master: {
    code: "quiz_master",
    titleUz: "Test ustasi",
    descriptionUz: "Testda 100% natija ko'rsatdingiz!",
    icon: "🎯",
  },
  speed_demon: {
    code: "speed_demon",
    titleUz: "Tezkor aql",
    descriptionUz: "Speed Round o'yinida 8+ ball to'pladingiz!",
    icon: "🚀",
  },
  level_5: {
    code: "level_5",
    titleUz: "5-bosqich bilimdoni",
    descriptionUz: "5-bosqich (Level 5) ga ko'tarildingiz!",
    icon: "👑",
  },
};

export function getTodayDateString(now = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: env.DEFAULT_TIMEZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
}

export function getYesterdayDateString(now = new Date()): string {
  const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000);
  return getTodayDateString(yesterday);
}

/**
 * Calculates user level from total XP.
 * Every level requires progressively more XP: Level 1 = 0, Level 2 = 100, Level 3 = 250, etc.
 */
export function calculateLevelFromXp(xp: number): number {
  return Math.max(1, Math.floor(Math.sqrt(xp / 25)) + 1);
}

export class XpService {
  async awardXpAndStreak(
    user: User,
    xpToAdd: number,
    wordsLearnedIncrement = 0
  ): Promise<{
    updatedUser: User;
    leveledUp: boolean;
    newlyUnlocked: AchievementDef[];
  }> {
    const today = getTodayDateString();
    const yesterday = getYesterdayDateString();

    let newStreak = user.streak;
    if (user.lastActiveDate !== today) {
      if (user.lastActiveDate === yesterday) {
        newStreak = user.streak + 1;
      } else {
        newStreak = 1;
      }
    }

    const learnedTodayBase =
      user.lastLearnedDate === today ? user.wordsLearnedToday : 0;
    const newWordsLearnedToday = learnedTodayBase + wordsLearnedIncrement;

    const newXp = user.xp + xpToAdd;
    const newWeeklyXp = user.weeklyXp + xpToAdd;
    const newLevel = calculateLevelFromXp(newXp);
    const leveledUp = newLevel > user.userLevel;

    const updatedUser = await userRepo.updateProgress(user.id, {
      xp: newXp,
      weeklyXp: newWeeklyXp,
      userLevel: newLevel,
      streak: newStreak,
      lastActiveDate: today,
      wordsLearnedToday: newWordsLearnedToday,
      lastLearnedDate: today,
    });

    const newlyUnlocked = await this.checkAchievements(updatedUser);

    return {
      updatedUser,
      leveledUp,
      newlyUnlocked,
    };
  }

  async checkAchievements(user: User): Promise<AchievementDef[]> {
    const stats = await statsRepo.getUserStats(user.id);
    const candidates: string[] = [];

    if (stats.totalSeen >= 1) candidates.push("first_word");
    if (stats.totalSeen >= 25) candidates.push("words_25");
    if (stats.totalSeen >= 100) candidates.push("words_100");
    if (user.streak >= 3) candidates.push("streak_3");
    if (user.streak >= 7) candidates.push("streak_7");
    if (user.userLevel >= 5) candidates.push("level_5");

    const unlocked: AchievementDef[] = [];
    for (const code of candidates) {
      const isNew = await statsRepo.unlockAchievement(user.id, code);
      const def = ACHIEVEMENTS[code];
      if (isNew && def) {
        unlocked.push(def);
      }
    }
    return unlocked;
  }

  async unlockSpecificAchievement(
    userId: number,
    code: string
  ): Promise<AchievementDef | null> {
    const isNew = await statsRepo.unlockAchievement(userId, code);
    if (isNew && ACHIEVEMENTS[code]) {
      return ACHIEVEMENTS[code]!;
    }
    return null;
  }
}

export const xpService = new XpService();
