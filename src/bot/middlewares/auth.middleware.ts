import { NextFunction } from "grammy";
import { MyContext } from "../context.js";
import { userRepo } from "../../db/repositories/user.repo.js";
import { activityLogger } from "../../services/activity-logger.service.js";

function describeUserAction(ctx: MyContext): {
  shouldNotify: boolean;
  title: string;
  details?: string;
} {
  if (ctx.message?.text) {
    const text = ctx.message.text.trim();
    if (text.startsWith("/start")) {
      return { shouldNotify: true, title: "🚀 /start buyrug'ini bosdi" };
    }
    if (text.startsWith("/learn")) {
      return { shouldNotify: true, title: "📖 So'z o'rganish (/learn) bo'limiga kirdi" };
    }
    if (text.startsWith("/quiz")) {
      return { shouldNotify: true, title: "🧠 Testlar (/quiz) bo'limiga kirdi" };
    }
    if (text.startsWith("/games")) {
      return { shouldNotify: true, title: "🎮 Mini o'yinlar (/games) bo'limiga kirdi" };
    }
    if (text.startsWith("/stats")) {
      return { shouldNotify: true, title: "📊 Statistikani (/stats) ko'rdi" };
    }
    if (text.startsWith("/top")) {
      return { shouldNotify: true, title: "🏆 Reytingni (/top) ko'rdi" };
    }
    if (text.startsWith("/settings")) {
      return { shouldNotify: true, title: "⚙️ Sozlamalarni (/settings) ochdi" };
    }
  }

  if (ctx.callbackQuery?.data) {
    const data = ctx.callbackQuery.data;
    if (data === "nav:learn") {
      return { shouldNotify: true, title: "📖 So'z o'rganishni boshladi" };
    }
    if (data.startsWith("quiz:start:")) {
      const mode = data.replace("quiz:start:", "");
      return {
        shouldNotify: true,
        title: "🧠 Test boshladi",
        details: `Rejim: ${mode}`,
      };
    }
    if (data.startsWith("game:") && data.endsWith(":start")) {
      const game = data.split(":")[1] ?? "mini-game";
      return {
        shouldNotify: true,
        title: "🎮 Mini o'yin boshladi",
        details: `O'yin: ${game}`,
      };
    }
    if (data.startsWith("onb:hour:")) {
      return {
        shouldNotify: true,
        title: "✅ Ro'yxatdan o'tishni (Onboarding) yakunladi",
      };
    }
  }

  return { shouldNotify: false, title: "" };
}

export async function authMiddleware(
  ctx: MyContext,
  next: NextFunction
): Promise<void> {
  // Ignore channel posts or group messages where ctx.chat.type !== 'private' for user onboarding
  if (!ctx.from || ctx.from.is_bot) {
    return next();
  }

  const existing = await userRepo.findByTelegramId(ctx.from.id);
  const isNewUser = !existing;

  const user = await userRepo.findOrCreate({
    telegramId: ctx.from.id,
    username: ctx.from.username,
    firstName: ctx.from.first_name || "O'quvchi",
  });

  ctx.dbUser = user;

  // Send real-time notification to Channel / Group when a new user joins or performs a main action
  if (isNewUser) {
    void activityLogger.notifyUserActivity(
      ctx.api,
      user,
      "Botga ilk marta kirdi (/start)",
      undefined,
      true
    );
  } else {
    const action = describeUserAction(ctx);
    if (action.shouldNotify) {
      void activityLogger.notifyUserActivity(
        ctx.api,
        user,
        action.title,
        action.details,
        false
      );
    }
  }

  await next();
}
