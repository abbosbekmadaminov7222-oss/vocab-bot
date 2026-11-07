import { Composer, InlineKeyboard } from "grammy";
import { MyContext } from "../context.js";
import { srsService, SrsQuality } from "../../services/srs.service.js";
import { xpService } from "../../services/xp.service.js";
import { wordRepo } from "../../db/repositories/word.repo.js";
import { Word } from "../../db/schema.js";

export const learnHandler = new Composer<MyContext>();

function buildCardKeyboard(wordId: number): InlineKeyboard {
  return new InlineKeyboard()
    .text("✅ Bilaman", `srs:rate:${wordId}:5`)
    .text("🤔 Keyinroq", `srs:rate:${wordId}:3`)
    .text("❌ Bilmayman", `srs:rate:${wordId}:1`)
    .row()
    .text("🔊 Talaffuz", `srs:audio:${wordId}`)
    .text("🏠 Menyu", "nav:main");
}

function formatCardMessage(
  ctx: MyContext,
  word: Word,
  currentIndex: number,
  total: number,
  isDueReview: boolean
): string {
  const badge = isDueReview ? "🔄 <i>(Takrorlash)</i>" : "🆕 <i>(Yangi so'z)</i>";
  return ctx.t("learn-card", {
    current: currentIndex + 1,
    total,
    badge,
    english: word.english,
    ipa: word.ipa ?? "",
    pos: word.pos,
    topic: word.topic,
    level: word.level,
    uzbek: word.uzbek,
    exampleEn: word.exampleEn,
    exampleUz: word.exampleUz || "—",
  });
}

export async function sendLearnCard(
  ctx: MyContext,
  editExisting = false
): Promise<void> {
  const { session, currentWord } = await srsService.startOrGetSession(
    ctx.dbUser
  );

  if (!currentWord) {
    const doneKb = new InlineKeyboard()
      .text("🧠 Test ishlash", "nav:quiz")
      .text("🎮 Mini o'yinlar", "nav:games")
      .row()
      .text("🏠 Asosiy menyu", "nav:main");

    if (editExisting && ctx.callbackQuery?.message) {
      await ctx.editMessageText(ctx.t("learn-empty"), {
        parse_mode: "HTML",
        reply_markup: doneKb,
      });
    } else {
      await ctx.reply(ctx.t("learn-empty"), {
        parse_mode: "HTML",
        reply_markup: doneKb,
      });
    }
    return;
  }

  const item = session.items[session.currentIndex];
  const text = formatCardMessage(
    ctx,
    currentWord,
    session.currentIndex,
    session.items.length,
    item?.isDueReview ?? false
  );
  const kb = buildCardKeyboard(currentWord.id);

  if (editExisting && ctx.callbackQuery?.message) {
    await ctx.editMessageText(text, {
      parse_mode: "HTML",
      reply_markup: kb,
    });
  } else {
    await ctx.reply(text, {
      parse_mode: "HTML",
      reply_markup: kb,
    });
  }
}

learnHandler.command("learn", async (ctx) => {
  await sendLearnCard(ctx, false);
});

learnHandler.callbackQuery("nav:learn", async (ctx) => {
  await ctx.answerCallbackQuery();
  await sendLearnCard(ctx, false);
});

learnHandler.callbackQuery(/^srs:rate:(\d+):(1|3|5)$/, async (ctx) => {
  const wordId = Number(ctx.match[1]);
  const quality = Number(ctx.match[2]) as SrsQuality;

  const { sm2, xpAdded, nextWord, session } = await srsService.rateCurrentWord(
    ctx.dbUser,
    wordId,
    quality
  );

  const { updatedUser, newlyUnlocked } = await xpService.awardXpAndStreak(
    ctx.dbUser,
    xpAdded,
    quality >= 3 ? 1 : 0
  );
  ctx.dbUser = updatedUser;

  const feedbackMap: Record<SrsQuality, string> = {
    5: `✅ Bilaman (+${xpAdded} XP | keyingi takrorlash: ${sm2.interval} kundan so'ng)`,
    3: `🤔 Keyinroq (+${xpAdded} XP | ertaga takrorlanadi)`,
    1: `❌ Bilmayman (+${xpAdded} XP | 10 daqiqadan so'ng takrorlanadi)`,
  };
  await ctx.answerCallbackQuery({ text: feedbackMap[quality] });

  if (newlyUnlocked.length > 0) {
    const badges = newlyUnlocked
      .map((a) => `${a.icon} <b>${a.titleUz}</b> — ${a.descriptionUz}`)
      .join("\n");
    await ctx.reply(`🏅 <b>Yangi yutuq ochildi!</b>\n${badges}`, {
      parse_mode: "HTML",
    });
  }

  if (!nextWord || !session) {
    const summaryKb = new InlineKeyboard()
      .text("📖 Yana o'rganish", "nav:learn")
      .text("🧠 Test ishlash", "nav:quiz")
      .row()
      .text("🏠 Asosiy menyu", "nav:main");

    await ctx.editMessageText(
      ctx.t("learn-session-done", {
        total: session?.items.length ?? ctx.dbUser.dailyGoal,
        xp: session?.xpEarned ?? xpAdded,
        streak: updatedUser.streak,
      }),
      {
        parse_mode: "HTML",
        reply_markup: summaryKb,
      }
    );
    return;
  }

  const nextItem = session.items[session.currentIndex];
  const text = formatCardMessage(
    ctx,
    nextWord,
    session.currentIndex,
    session.items.length,
    nextItem?.isDueReview ?? false
  );
  await ctx.editMessageText(text, {
    parse_mode: "HTML",
    reply_markup: buildCardKeyboard(nextWord.id),
  });
});

learnHandler.callbackQuery(/^srs:audio:(\d+)$/, async (ctx) => {
  const wordId = Number(ctx.match[1]);
  const word = await wordRepo.findById(wordId);
  if (!word) {
    await ctx.answerCallbackQuery({ text: "So'z topilmadi" });
    return;
  }

  if (word.audioFileId) {
    await ctx.answerCallbackQuery();
    await ctx.replyWithAudio(word.audioFileId, {
      caption: `🇬🇧 <b>${word.english}</b> ${word.ipa ?? ""} — 🇺🇿 ${word.uzbek}`,
      parse_mode: "HTML",
    });
  } else {
    // Provide Google TTS dictionary audio URL fallback or IPA popup
    const ttsUrl = `https://ssl.gstatic.com/dictionary/static/sounds/oxford/${encodeURIComponent(
      word.english.toLowerCase()
    )}--_gb_1.mp3`;
    try {
      await ctx.answerCallbackQuery();
      await ctx.replyWithAudio(ttsUrl, {
        caption: `🔊 <b>${word.english}</b> ${word.ipa ?? ""}`,
        parse_mode: "HTML",
      });
    } catch {
      await ctx.answerCallbackQuery({
        text: `🔊 Talaffuz: ${word.english} ${word.ipa ?? ""}`,
        show_alert: true,
      });
    }
  }
});
