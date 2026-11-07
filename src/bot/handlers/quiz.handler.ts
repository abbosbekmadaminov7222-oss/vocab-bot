import { Composer, InlineKeyboard } from "grammy";
import { MyContext } from "../context.js";
import {
  quizService,
  QuizMode,
  QuizSessionState,
} from "../../services/quiz.service.js";
import { buildChallengeShareUrl } from "./start.handler.js";

export const quizHandler = new Composer<MyContext>();

function buildQuizModeKeyboard(shareUrl?: string): InlineKeyboard {
  const kb = new InlineKeyboard();
  if (shareUrl) {
    kb.url("⚔️ Do'stni bellashuvga chorlash", shareUrl).row();
  }
  kb.text("🇬🇧 ➔ 🇺🇿 Variantli", "quiz:start:en_uz")
    .text("🇺🇿 ➔ 🇬🇧 Variantli", "quiz:start:uz_en")
    .row()
    .text("✍️ Yozma (Typing)", "quiz:start:typing")
    .text("🎧 Tinglab topish", "quiz:start:listening")
    .row()
    .text("🎁 Do'stlarni chaqirish (+50 XP)", "nav:invite")
    .row()
    .text("🏠 Asosiy menyu", "nav:main");
  return kb;
}

export async function showQuizMenu(ctx: MyContext): Promise<void> {
  await ctx.reply(ctx.t("quiz-menu-title"), {
    parse_mode: "HTML",
    reply_markup: buildQuizModeKeyboard(),
  });
}

async function sendCurrentQuizQuestion(
  ctx: MyContext,
  session: QuizSessionState,
  editMessage = false
): Promise<void> {
  const q = session.questions[session.currentIndex];
  if (!q) return;

  const current = session.currentIndex + 1;
  const total = session.questions.length;

  if (session.mode === "typing") {
    const maskedHint =
      q.english[0] + "_".repeat(Math.max(1, q.english.length - 1));
    const text = ctx.t("quiz-typing-question", {
      current,
      total,
      uzbek: q.uzbek,
      pos: q.pos,
      hint: `${maskedHint} (${q.english.length} harf)`,
    });

    const cancelKb = new InlineKeyboard().text(
      "🛑 Testni to'xtatish",
      "quiz:cancel"
    );

    if (editMessage && ctx.callbackQuery?.message) {
      await ctx.editMessageText(text, {
        parse_mode: "HTML",
        reply_markup: cancelKb,
      });
    } else {
      await ctx.reply(text, {
        parse_mode: "HTML",
        reply_markup: cancelKb,
      });
    }
    return;
  }

  const kb = new InlineKeyboard();
  q.options.forEach((opt, idx) => {
    kb.text(opt, `quiz:ans:${idx}`).row();
  });
  kb.text("🛑 Testni to'xtatish", "quiz:cancel");

  let text = "";
  if (session.mode === "listening") {
    const regex = new RegExp(q.english, "gi");
    const maskedExample = q.exampleEn.replace(regex, "_____");

    const ttsUrl =
      q.audioFileId ||
      `https://ssl.gstatic.com/dictionary/static/sounds/oxford/${encodeURIComponent(
        q.english.toLowerCase()
      )}--_gb_1.mp3`;
    try {
      await ctx.replyWithAudio(ttsUrl, {
        caption: `🎧 Savol ${current}/${total}: Audio talaffuzni tinglang`,
      });
    } catch {
      // Fallback to phonetic IPA + masked sentence
    }

    text = ctx.t("quiz-listening-question", {
      current,
      total,
      ipa: q.ipa,
      maskedExample,
    });
  } else {
    const prompt = session.mode === "en_uz" ? q.english : q.uzbek;
    text = ctx.t("quiz-mc-question", {
      current,
      total,
      prompt,
      pos: q.pos,
    });
  }

  if (
    editMessage &&
    ctx.callbackQuery?.message &&
    session.mode !== "listening"
  ) {
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

quizHandler.command("quiz", async (ctx) => {
  await showQuizMenu(ctx);
});

quizHandler.callbackQuery("nav:quiz", async (ctx) => {
  await ctx.answerCallbackQuery();
  await showQuizMenu(ctx);
});

quizHandler.callbackQuery(
  /^quiz:start:(en_uz|uz_en|typing|listening)$/,
  async (ctx) => {
    const mode = ctx.match[1] as QuizMode;
    await ctx.answerCallbackQuery();
    const session = await quizService.startQuiz(ctx.dbUser, mode, 5);
    await sendCurrentQuizQuestion(ctx, session, true);
  }
);

quizHandler.callbackQuery(/^quiz:ans:(\d+)$/, async (ctx) => {
  const optionIdx = Number(ctx.match[1]);
  const result = await quizService.submitChoiceAnswer(ctx.dbUser, optionIdx);

  if (!result) {
    await ctx.answerCallbackQuery({ text: "Faol test topilmadi." });
    return;
  }

  const { isCorrect, question, session, finished } = result;
  const expected =
    session.mode === "en_uz" ? question.uzbek : question.english;

  await ctx.answerCallbackQuery({
    text: isCorrect
      ? `✅ To'g'ri! +10 XP`
      : `❌ Noto'g'ri! To'g'ri javob: ${expected}`,
  });

  if (finished) {
    const percent = Math.round(
      (session.score / session.questions.length) * 100
    );
    const botUsername = ctx.me.username || "Quiz722bot";
    const shareUrl = buildChallengeShareUrl(
      botUsername,
      ctx.dbUser.telegramId,
      `🏆 Men @${botUsername} testida ${session.score}/${session.questions.length} (${percent}%) natija ko'rsatdim! Sen nechtasini topa olasan?`
    );

    await ctx.editMessageText(
      ctx.t("quiz-finished", {
        score: session.score,
        total: session.questions.length,
        percent,
        xp: session.xpEarned,
      }),
      {
        parse_mode: "HTML",
        reply_markup: buildQuizModeKeyboard(shareUrl),
      }
    );
    return;
  }

  await sendCurrentQuizQuestion(ctx, session, true);
});

quizHandler.callbackQuery("quiz:cancel", async (ctx) => {
  await quizService.clearSession(ctx.dbUser.telegramId);
  await ctx.answerCallbackQuery({ text: "Test to'xtatildi" });
  await ctx.editMessageText(ctx.t("quiz-menu-title"), {
    parse_mode: "HTML",
    reply_markup: buildQuizModeKeyboard(),
  });
});

// Listen for text answers when user is in an active typing quiz
quizHandler.on("message:text", async (ctx, next) => {
  if (ctx.message.text.startsWith("/")) {
    return next();
  }

  const active = await quizService.getActiveSession(ctx.dbUser.telegramId);
  if (!active || active.mode !== "typing") {
    return next();
  }

  const result = await quizService.submitTypedAnswer(
    ctx.dbUser,
    ctx.message.text
  );
  if (!result) return next();

  const { isCorrect, isExact, question, session, finished } = result;

  if (isCorrect && isExact) {
    await ctx.reply(
      ctx.t("quiz-correct", {
        word: question.english,
        translation: question.uzbek,
      }),
      { parse_mode: "HTML" }
    );
  } else if (isCorrect && !isExact) {
    await ctx.reply(
      ctx.t("quiz-correct-typo", { expected: question.english }),
      { parse_mode: "HTML" }
    );
  } else {
    await ctx.reply(
      ctx.t("quiz-wrong", {
        expected: `${question.english} (${question.uzbek})`,
      }),
      { parse_mode: "HTML" }
    );
  }

  if (finished) {
    const percent = Math.round(
      (session.score / session.questions.length) * 100
    );
    const botUsername = ctx.me.username || "Quiz722bot";
    const shareUrl = buildChallengeShareUrl(
      botUsername,
      ctx.dbUser.telegramId,
      `✍️ Men @${botUsername} yozma testida ${session.score}/${session.questions.length} (${percent}%) natija ko'rsatdim! O'zingni sinab ko'r!`
    );

    await ctx.reply(
      ctx.t("quiz-finished", {
        score: session.score,
        total: session.questions.length,
        percent,
        xp: session.xpEarned,
      }),
      {
        parse_mode: "HTML",
        reply_markup: buildQuizModeKeyboard(shareUrl),
      }
    );
    return;
  }

  await sendCurrentQuizQuestion(ctx, session, false);
});
