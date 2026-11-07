import { Composer, InlineKeyboard } from "grammy";
import { MyContext } from "../context.js";
import { statsRepo } from "../../db/repositories/stats.repo.js";
import { srsRepo } from "../../db/repositories/srs.repo.js";
import { userRepo } from "../../db/repositories/user.repo.js";
import { ACHIEVEMENTS, getTodayDateString } from "../../services/xp.service.js";
import { buildChallengeShareUrl } from "./start.handler.js";

export const statsHandler = new Composer<MyContext>();

export async function showStatsView(ctx: MyContext): Promise<void> {
  const user = ctx.dbUser;
  const summary = await statsRepo.getUserStats(user.id);
  const weakWords = await srsRepo.getWeakWords(user.id, 5);

  const today = getTodayDateString();
  const learnedToday =
    user.lastLearnedDate === today ? user.wordsLearnedToday : 0;

  let text = ctx.t("stats-view", {
    name: user.firstName,
    level: user.level,
    userLevel: user.userLevel,
    xp: user.xp,
    weeklyXp: user.weeklyXp,
    streak: user.streak,
    learnedToday,
    dailyGoal: user.dailyGoal,
    referralsCount: user.referralsCount,
    totalSeen: summary.totalSeen,
    learning: summary.learningCount,
    review: summary.reviewCount,
    mastered: summary.masteredCount,
    due: summary.dueCount,
    accuracy: summary.accuracyPercent,
    correct: summary.totalCorrect,
    wrong: summary.totalWrong,
    quizzesPlayed: summary.quizzesPlayed,
  });

  if (weakWords.length > 0) {
    const weakList = weakWords
      .map(
        (w) =>
          `• <b>${w.word.english}</b> — ${w.word.uzbek} <i>(${w.userWord.wrongCount} marta xato)</i>`
      )
      .join("\n");
    text += `\n\n⚠️ <b>Eng ko'p xato qilingan so'zlar:</b>\n${weakList}`;
  }

  if (summary.achievements.length > 0) {
    const badges = summary.achievements
      .map((code) => {
        const def = ACHIEVEMENTS[code];
        return def ? `${def.icon} ${def.titleUz}` : code;
      })
      .join(" | ");
    text += `\n\n🏅 <b>Yutuqlar:</b> ${badges}`;
  }

  const botUsername = ctx.me.username || "Quiz722bot";
  const shareUrl = buildChallengeShareUrl(
    botUsername,
    user.telegramId,
    `📊 Men @${botUsername} da ${summary.totalSeen} ta inglizcha so'z o'rgandim va ${user.xp} XP to'pladim! Sen ham qo'shil!`
  );

  const kb = new InlineKeyboard()
    .url("📤 Natijani do'stlarga ulashish", shareUrl)
    .row()
    .text("🎁 Do'stlarni chaqirish (+50 XP)", "nav:invite")
    .row()
    .text("📖 Takrorlash", "nav:learn")
    .text("🏆 Reyting", "nav:top")
    .row()
    .text("🏠 Asosiy menyu", "nav:main");

  await ctx.reply(text, {
    parse_mode: "HTML",
    reply_markup: kb,
  });
}

export async function showLeaderboardView(ctx: MyContext): Promise<void> {
  const topUsers = await userRepo.getWeeklyLeaderboard(10);
  const medals = ["🥇", "🥈", "🥉"];

  const lines = topUsers.map((u, idx) => {
    const prefix = medals[idx] ?? `${idx + 1}.`;
    const isMe = u.telegramId === ctx.dbUser.telegramId ? " 👈 <b>(Siz)</b>" : "";
    return `${prefix} <b>${u.firstName}</b> (${u.level}) — ⭐ <b>${u.weeklyXp} XP</b> (🔥 ${u.streak} kun)${isMe}`;
  });

  const text = `${ctx.t("leaderboard-title")}\n\n${
    lines.length > 0 ? lines.join("\n") : "Hozircha ma'lumot yo'q."
  }`;

  const kb = new InlineKeyboard()
    .text("🎁 Do'stlarni chaqirish (+50 XP)", "nav:invite")
    .row()
    .text("📊 Mening statistikam", "nav:stats")
    .text("🏠 Asosiy menyu", "nav:main");

  await ctx.reply(text, {
    parse_mode: "HTML",
    reply_markup: kb,
  });
}

statsHandler.command("stats", async (ctx) => {
  await showStatsView(ctx);
});

statsHandler.command("top", async (ctx) => {
  await showLeaderboardView(ctx);
});

statsHandler.callbackQuery("nav:stats", async (ctx) => {
  await ctx.answerCallbackQuery();
  await showStatsView(ctx);
});

statsHandler.callbackQuery("nav:top", async (ctx) => {
  await ctx.answerCallbackQuery();
  await showLeaderboardView(ctx);
});
