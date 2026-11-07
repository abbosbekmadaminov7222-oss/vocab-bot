import { Composer, InlineKeyboard } from "grammy";
import { MyContext } from "../context.js";
import { mainMenu } from "../menus/main.menu.js";
import { userRepo } from "../../db/repositories/user.repo.js";
import { activityLogger } from "../../services/activity-logger.service.js";

export const startHandler = new Composer<MyContext>();

export function buildChallengeShareUrl(
  botUsername: string,
  telegramId: number,
  achievementText: string
): string {
  const refLink = `https://t.me/${botUsername}?start=ref_${telegramId}`;
  const shareText = `${achievementText}\n\n🇬🇧🇺🇿 Inglizcha so'zlarni o'yin va kartochkalar orqali yodlang! 👇`;
  return `https://t.me/share/url?url=${encodeURIComponent(
    refLink
  )}&text=${encodeURIComponent(shareText)}`;
}

export async function showMainMenu(ctx: MyContext): Promise<void> {
  const user = ctx.dbUser;
  const text = ctx.t("welcome-back", {
    name: user.firstName,
    level: user.level,
    goal: user.dailyGoal,
    streak: user.streak,
    xp: user.xp,
    userLevel: user.userLevel,
  });

  await ctx.reply(text, {
    parse_mode: "HTML",
    reply_markup: mainMenu,
  });
}

export async function showInviteView(ctx: MyContext): Promise<void> {
  const user = ctx.dbUser;
  const botUsername = ctx.me.username || "Quiz722bot";
  const refLink = `https://t.me/${botUsername}?start=ref_${user.telegramId}`;
  const shareUrl = buildChallengeShareUrl(
    botUsername,
    user.telegramId,
    `🔥 Men @${botUsername} orqali ingliz tilidagi so'zlarni oson yodlayapman! Sen ham qo'shil va +25 XP bonus ol!`
  );

  const text =
    `🎁 <b>Do'stlarni taklif qilish dasturi!</b>\n\n` +
    `Shaxsiy havolangiz orqali do'stlaringizni botga taklif qiling:\n` +
    `• Har bir qo'shilgan do'stingiz uchun sizga <b>+50 XP</b> beriladi!\n` +
    `• Do'stingiz esa boshlang'ich <b>+25 XP</b> bonus oladi!\n\n` +
    `🔗 <b>Sizning shaxsiy havolangiz:</b>\n` +
    `<code>${refLink}</code>\n\n` +
    `👥 Taklif qilingan do'stlar: <b>${user.referralsCount} ta</b>\n` +
    `⭐ Referal orqali yig'ilgan XP: <b>+${user.referralsCount * 50} XP</b>`;

  const kb = new InlineKeyboard()
    .url("📤 Do'stlarga ulashish", shareUrl)
    .row()
    .text("🏆 Reytingni ko'rish", "nav:top")
    .text("🏠 Asosiy menyu", "nav:main");

  await ctx.reply(text, {
    parse_mode: "HTML",
    reply_markup: kb,
  });
}

startHandler.command("start", async (ctx) => {
  const payload = ctx.match?.trim();

  // Check if user joined via referral link: /start ref_123456789
  if (payload && payload.startsWith("ref_")) {
    const referrerTelegramId = Number(payload.replace("ref_", ""));
    if (!Number.isNaN(referrerTelegramId)) {
      const refResult = await userRepo.processReferral(
        ctx.dbUser,
        referrerTelegramId
      );
      if (refResult) {
        ctx.dbUser = refResult.invited;

        await ctx.reply(
          `🎁 <b>Xush kelibsiz!</b> Do'stingiz taklifi orqali kirganingiz uchun sizga <b>+25 XP</b> boshlang'ich bonus berildi!`,
          { parse_mode: "HTML" }
        );

        try {
          await ctx.api.sendMessage(
            refResult.referrer.telegramId,
            `🎉 <b>Yangi referal!</b>\nDo'stingiz <b>${ctx.dbUser.firstName}</b> sizning havolangiz orqali botga qo'shildi!\n⭐ Sizga <b>+50 XP</b> bonus qo'shildi! (Jami takliflar: <b>${refResult.referrer.referralsCount} ta</b>)`,
            { parse_mode: "HTML" }
          );
        } catch {
          // Ignore if referrer blocked notifications
        }

        void activityLogger.notifyUserActivity(
          ctx.api,
          ctx.dbUser,
          "🎁 Referal havola orqali qo'shildi",
          `Taklif qilgan: ${refResult.referrer.firstName} (ID: ${refResult.referrer.telegramId})`
        );
      }
    }
  }

  if (!ctx.dbUser.onboarded) {
    await ctx.reply(
      ctx.t("welcome-new", { name: ctx.dbUser.firstName }),
      { parse_mode: "HTML" }
    );
    await ctx.conversation.enter("onboardingConversation");
    return;
  }

  await showMainMenu(ctx);
});

startHandler.command("invite", async (ctx) => {
  await showInviteView(ctx);
});

startHandler.command("settings", async (ctx) => {
  await ctx.conversation.enter("onboardingConversation");
});

startHandler.command("help", async (ctx) => {
  await ctx.reply(ctx.t("help-text"), {
    parse_mode: "HTML",
    reply_markup: mainMenu,
  });
});

startHandler.callbackQuery("nav:main", async (ctx) => {
  await ctx.answerCallbackQuery();
  await showMainMenu(ctx);
});

startHandler.callbackQuery("nav:invite", async (ctx) => {
  await ctx.answerCallbackQuery();
  await showInviteView(ctx);
});
