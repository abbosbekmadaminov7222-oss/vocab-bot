import { InlineKeyboard } from "grammy";
import { MyContext, MyConversation } from "../context.js";
import { userRepo } from "../../db/repositories/user.repo.js";
import { CefrLevel } from "../../db/schema.js";

const LEVELS: CefrLevel[] = ["A1", "A2", "B1", "B2", "C1"];
const GOALS = [5, 10, 20];
const HOURS = [8, 9, 18, 20, 21];

export async function onboardingConversation(
  conversation: MyConversation,
  ctx: MyContext
): Promise<void> {
  const fromId = ctx.from?.id;
  if (!fromId) return;

  // Step 1: Choose CEFR Level
  const levelKeyboard = new InlineKeyboard()
    .text("🟢 A1 (Boshlang'ich)", "onb:lvl:A1")
    .text("🟢 A2 (Elementar)", "onb:lvl:A2")
    .row()
    .text("🟡 B1 (O'rta)", "onb:lvl:B1")
    .text("🟠 B2 (O'rtadan yuqori)", "onb:lvl:B2")
    .row()
    .text("🔴 C1 (Ilg'or)", "onb:lvl:C1");

  await ctx.reply(ctx.t("onboarding-choose-level"), {
    parse_mode: "HTML",
    reply_markup: levelKeyboard,
  });

  const levelCtx = await conversation.waitForCallbackQuery(/^onb:lvl:(A1|A2|B1|B2|C1)$/);
  const chosenLevel = levelCtx.match[1] as CefrLevel;
  await levelCtx.answerCallbackQuery({ text: `Daraja: ${chosenLevel}` });

  // Step 2: Choose Daily Goal (5 / 10 / 20)
  const goalKeyboard = new InlineKeyboard()
    .text("🌱 5 ta so'z (Yengil)", "onb:goal:5")
    .row()
    .text("🔥 10 ta so'z (Tavsiya etiladi)", "onb:goal:10")
    .row()
    .text("🚀 20 ta so'z (Intensiv)", "onb:goal:20");

  await levelCtx.editMessageText(ctx.t("onboarding-choose-goal"), {
    parse_mode: "HTML",
    reply_markup: goalKeyboard,
  });

  const goalCtx = await conversation.waitForCallbackQuery(/^onb:goal:(5|10|20)$/);
  const chosenGoal = Number(goalCtx.match[1]);
  await goalCtx.answerCallbackQuery({ text: `Kunlik maqsad: ${chosenGoal}` });

  // Step 3: Choose Daily Reminder Hour
  const hourKeyboard = new InlineKeyboard();
  for (const h of HOURS) {
    hourKeyboard.text(`⏰ ${h}:00`, `onb:hour:${h}`);
  }

  await goalCtx.editMessageText(ctx.t("onboarding-choose-reminder"), {
    parse_mode: "HTML",
    reply_markup: hourKeyboard,
  });

  const hourCtx = await conversation.waitForCallbackQuery(/^onb:hour:(\d+)$/);
  const chosenHour = Number(hourCtx.match[1]);
  await hourCtx.answerCallbackQuery({ text: `Soat ${chosenHour}:00` });

  // Save in DB inside conversation.external
  await conversation.external(async () => {
    const dbUser = await userRepo.findOrCreate({
      telegramId: fromId,
      username: ctx.from?.username,
      firstName: ctx.from?.first_name || "O'quvchi",
    });

    await userRepo.updateOnboarding(dbUser.id, {
      level: chosenLevel,
      dailyGoal: chosenGoal,
      reminderHour: chosenHour,
    });
  });

  const startActionKb = new InlineKeyboard()
    .text("📖 So'z o'rganishni boshlash", "nav:learn")
    .row()
    .text("🏠 Asosiy menyu", "nav:main");

  await hourCtx.editMessageText(
    ctx.t("onboarding-complete", {
      level: chosenLevel,
      goal: chosenGoal,
      hour: chosenHour,
    }),
    {
      parse_mode: "HTML",
      reply_markup: startActionKb,
    }
  );
}

export { LEVELS, GOALS, HOURS };
