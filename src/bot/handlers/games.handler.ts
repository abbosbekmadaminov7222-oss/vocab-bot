import { Composer, InlineKeyboard } from "grammy";
import { MyContext } from "../context.js";
import {
  gamesService,
  ScrambleState,
  HangmanState,
  MatchingState,
  SpeedRoundState,
} from "../../services/games.service.js";
import { buildChallengeShareUrl } from "./start.handler.js";

export const gamesHandler = new Composer<MyContext>();

function buildGamesMenuKeyboard(): InlineKeyboard {
  return new InlineKeyboard()
    .text("🔤 Word Scramble", "game:scramble:start")
    .text("🪢 Hangman", "game:hangman:start")
    .row()
    .text("🧩 Juftlikni top", "game:matching:start")
    .text("⚡ Tezkor 60s", "game:speed:start")
    .row()
    .text("🎁 Do'stlarni chaqirish (+50 XP)", "nav:invite")
    .row()
    .text("🏠 Asosiy menyu", "nav:main");
}

export async function showGamesMenu(ctx: MyContext): Promise<void> {
  await ctx.reply(ctx.t("games-menu-title"), {
    parse_mode: "HTML",
    reply_markup: buildGamesMenuKeyboard(),
  });
}

gamesHandler.command("games", async (ctx) => {
  await showGamesMenu(ctx);
});

gamesHandler.callbackQuery("nav:games", async (ctx) => {
  await ctx.answerCallbackQuery();
  await showGamesMenu(ctx);
});

// ==================== 1. WORD SCRAMBLE ====================
function renderScrambleView(state: ScrambleState): {
  text: string;
  kb: InlineKeyboard;
} {
  const progress = state.built.padEnd(state.english.length, "•").split("").join(" ");
  const text = `🔤 <b>Word Scramble</b>\n\n🇺🇿 Ma'nosi: <b>${state.uzbek}</b>\n🎯 Yasalgan so'z: <code>${progress}</code>`;

  const kb = new InlineKeyboard();
  state.letters.forEach((slot, idx) => {
    kb.text(slot.used ? "▫️" : slot.char, `game:scramble:pick:${idx}`);
    if ((idx + 1) % 5 === 0) kb.row();
  });
  kb.row()
    .text("🔄 Tozalash", "game:scramble:pick:-1")
    .text("🎮 O'yinlar", "nav:games");

  return { text, kb };
}

gamesHandler.callbackQuery("game:scramble:start", async (ctx) => {
  await ctx.answerCallbackQuery();
  const state = await gamesService.startScramble(ctx.dbUser);
  const { text, kb } = renderScrambleView(state);
  await ctx.editMessageText(text, { parse_mode: "HTML", reply_markup: kb });
});

gamesHandler.callbackQuery(/^game:scramble:pick:(-?\d+)$/, async (ctx) => {
  const idx = Number(ctx.match[1]);
  const res = await gamesService.pickScrambleLetter(ctx.dbUser, idx);
  if (!res) {
    await ctx.answerCallbackQuery({ text: "O'yin topilmadi" });
    return;
  }

  if (res.status === "won") {
    await ctx.answerCallbackQuery({ text: "🎉 To'g'ri topdingiz! +15 XP" });
    const botUsername = ctx.me.username || "Quiz722bot";
    const shareUrl = buildChallengeShareUrl(
      botUsername,
      ctx.dbUser.telegramId,
      `🔤 Men @${botUsername} da Word Scramble o'yinida "${res.state.english}" so'zini topdim! Sen ham sinab ko'r!`
    );
    const kb = new InlineKeyboard()
      .url("⚔️ Do'stni bellashuvga chorlash", shareUrl)
      .row()
      .text("🔄 Yana Scramble", "game:scramble:start")
      .text("🎮 Boshqa o'yinlar", "nav:games");
    await ctx.editMessageText(
      `🏆 <b>Barakalla!</b>\n\n🇬🇧 <b>${res.state.english}</b> — 🇺🇿 ${res.state.uzbek}\n⭐ +${res.xpEarned} XP qo'shildi!`,
      { parse_mode: "HTML", reply_markup: kb }
    );
    return;
  }

  if (res.status === "wrong") {
    await ctx.answerCallbackQuery({
      text: "❌ Harflar tartibi xato! Qaytadan tering.",
      show_alert: true,
    });
  } else {
    await ctx.answerCallbackQuery();
  }

  const { text, kb } = renderScrambleView(res.state);
  await ctx.editMessageText(text, { parse_mode: "HTML", reply_markup: kb });
});

// ==================== 2. HANGMAN ====================
const ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ".split("");

function renderHangmanView(state: HangmanState): {
  text: string;
  kb: InlineKeyboard;
} {
  const masked = state.english
    .split("")
    .map((ch) => (state.guessedLetters.includes(ch) ? ch : "_"))
    .join(" ");

  const hearts =
    "❤️".repeat(state.livesLeft) +
    "🖤".repeat(state.maxLives - state.livesLeft);

  const text = `🪢 <b>Hangman (So'zni toping)</b>\n\n🇺🇿 Ma'nosi: <b>${state.uzbek}</b>\n❤️ Jonlar: ${hearts}\n\n🔤 So'z: <code>${masked}</code>`;

  const kb = new InlineKeyboard();
  ALPHABET.forEach((letter, i) => {
    const used = state.guessedLetters.includes(letter);
    kb.text(used ? "·" : letter, `game:hangman:guess:${letter}`);
    if ((i + 1) % 7 === 0) kb.row();
  });
  kb.row().text("🎮 O'yinlar menyusi", "nav:games");

  return { text, kb };
}

gamesHandler.callbackQuery("game:hangman:start", async (ctx) => {
  await ctx.answerCallbackQuery();
  const state = await gamesService.startHangman(ctx.dbUser);
  const { text, kb } = renderHangmanView(state);
  await ctx.editMessageText(text, { parse_mode: "HTML", reply_markup: kb });
});

gamesHandler.callbackQuery(/^game:hangman:guess:([A-Z])$/, async (ctx) => {
  const letter = ctx.match[1]!;
  const res = await gamesService.guessHangmanLetter(ctx.dbUser, letter);
  if (!res) {
    await ctx.answerCallbackQuery({ text: "O'yin topilmadi" });
    return;
  }

  if (res.status === "won") {
    await ctx.answerCallbackQuery({ text: "🎉 G'alaba! +20 XP" });
    const botUsername = ctx.me.username || "Quiz722bot";
    const shareUrl = buildChallengeShareUrl(
      botUsername,
      ctx.dbUser.telegramId,
      `🪢 Men @${botUsername} Hangman o'yinida yashirin inglizcha so'zni topdim! Sen topa olasanmi?`
    );
    const kb = new InlineKeyboard()
      .url("⚔️ Do'stni bellashuvga chorlash", shareUrl)
      .row()
      .text("🔄 Yana Hangman", "game:hangman:start")
      .text("🎮 Boshqa o'yinlar", "nav:games");
    await ctx.editMessageText(
      `🎉 <b>Ajoyib! So'zni topdingiz!</b>\n\n🇬🇧 <b>${res.state.english}</b> — 🇺🇿 ${res.state.uzbek}\n⭐ +${res.xpEarned} XP!`,
      { parse_mode: "HTML", reply_markup: kb }
    );
    return;
  }

  if (res.status === "lost") {
    await ctx.answerCallbackQuery({ text: "😔 Jonlar tugadi!" });
    const kb = new InlineKeyboard()
      .text("🔄 Qayta urinish", "game:hangman:start")
      .text("🎮 Boshqa o'yinlar", "nav:games");
    await ctx.editMessageText(
      `😔 <b>Jonlar tugadi!</b>\n\nYashirin so'z: 🇬🇧 <b>${res.state.english}</b> (${res.state.uzbek})`,
      { parse_mode: "HTML", reply_markup: kb }
    );
    return;
  }

  await ctx.answerCallbackQuery();
  const { text, kb } = renderHangmanView(res.state);
  await ctx.editMessageText(text, { parse_mode: "HTML", reply_markup: kb });
});

// ==================== 3. MATCHING PAIRS ====================
function renderMatchingView(state: MatchingState): {
  text: string;
  kb: InlineKeyboard;
} {
  const text = `🧩 <b>Juftlikni top (Matching Pairs)</b>\nInglizcha so'z va uning o'zbekcha tarjimasini ketma-ket bosing!\n\n✅ Topildi: <b>${state.matchesFound} / ${state.totalPairs}</b> | ❌ Xatolar: <b>${state.mistakes}</b>`;

  const kb = new InlineKeyboard();
  state.cards.forEach((card, idx) => {
    let label = card.text;
    if (card.matched) {
      label = "✅";
    } else if (state.selectedIndex === idx) {
      label = `👉 ${card.text}`;
    }
    kb.text(label, `game:matching:pick:${idx}`);
    if ((idx + 1) % 2 === 0) kb.row();
  });
  kb.row().text("🎮 O'yinlar menyusi", "nav:games");

  return { text, kb };
}

gamesHandler.callbackQuery("game:matching:start", async (ctx) => {
  await ctx.answerCallbackQuery();
  const state = await gamesService.startMatching(ctx.dbUser);
  const { text, kb } = renderMatchingView(state);
  await ctx.editMessageText(text, { parse_mode: "HTML", reply_markup: kb });
});

gamesHandler.callbackQuery(/^game:matching:pick:(\d+)$/, async (ctx) => {
  const idx = Number(ctx.match[1]);
  const res = await gamesService.selectMatchingCard(ctx.dbUser, idx);
  if (!res) {
    await ctx.answerCallbackQuery({ text: "O'yin topilmadi" });
    return;
  }

  if (res.event === "finished") {
    await ctx.answerCallbackQuery({ text: `🎉 Barcha juftliklar topildi! +${res.xpEarned} XP` });
    const botUsername = ctx.me.username || "Quiz722bot";
    const shareUrl = buildChallengeShareUrl(
      botUsername,
      ctx.dbUser.telegramId,
      `🧩 Men @${botUsername} da barcha inglizcha-o'zbekcha juftliklarni topdim! Sen-chi?`
    );
    const kb = new InlineKeyboard()
      .url("⚔️ Do'stni bellashuvga chorlash", shareUrl)
      .row()
      .text("🔄 Yana o'ynash", "game:matching:start")
      .text("🎮 Boshqa o'yinlar", "nav:games");
    await ctx.editMessageText(
      `🏆 <b>Barcha juftliklarni topdingiz!</b>\n❌ Xatolar soni: <b>${res.state.mistakes}</b>\n⭐ Qo'shildi: <b>+${res.xpEarned} XP</b>`,
      { parse_mode: "HTML", reply_markup: kb }
    );
    return;
  }

  const toast =
    res.event === "matched"
      ? "✅ Mos tushdi!"
      : res.event === "mismatch"
      ? "❌ Mos emas!"
      : undefined;
  await ctx.answerCallbackQuery(toast ? { text: toast } : undefined);

  const { text, kb } = renderMatchingView(res.state);
  await ctx.editMessageText(text, { parse_mode: "HTML", reply_markup: kb });
});

// ==================== 4. SPEED ROUND (60s) ====================
function renderSpeedView(state: SpeedRoundState): {
  text: string;
  kb: InlineKeyboard;
} {
  const secondsLeft = Math.max(
    0,
    Math.ceil((state.expiresAt - Date.now()) / 1000)
  );
  const q = state.currentQuestion;
  const text = `⚡ <b>Tezkor raund (Speed Round)</b>\n⏱ Qolgan vaqt: <b>${secondsLeft} soniya</b> | 🎯 Ball: <b>${state.score}</b>\n\n👉 <b>${q.english}</b> so'zining tarjimasi qaysi?`;

  const kb = new InlineKeyboard();
  q.options.forEach((opt, idx) => {
    kb.text(opt, `game:speed:ans:${idx}`).row();
  });

  return { text, kb };
}

gamesHandler.callbackQuery("game:speed:start", async (ctx) => {
  await ctx.answerCallbackQuery({ text: "⏱ 60 soniya boshlandi!" });
  const state = await gamesService.startSpeedRound(ctx.dbUser);
  const { text, kb } = renderSpeedView(state);
  await ctx.editMessageText(text, { parse_mode: "HTML", reply_markup: kb });
});

gamesHandler.callbackQuery(/^game:speed:ans:(\d+)$/, async (ctx) => {
  const idx = Number(ctx.match[1]);
  const res = await gamesService.answerSpeedRound(ctx.dbUser, idx);
  if (!res) {
    await ctx.answerCallbackQuery({ text: "Tezkor raund yakunlangan" });
    return;
  }

  if (res.timeUp) {
    await ctx.answerCallbackQuery({ text: "⏰ Vaqt tugadi!" });
    const botUsername = ctx.me.username || "Quiz722bot";
    const shareUrl = buildChallengeShareUrl(
      botUsername,
      ctx.dbUser.telegramId,
      `⚡ Men @${botUsername} Tezkor 60 soniya o'yinida ${res.state.score} ta inglizcha so'z topdim! Mening rekordimni yangilay olasanmi?`
    );
    const kb = new InlineKeyboard()
      .url("⚔️ Do'stni bellashuvga chorlash", shareUrl)
      .row()
      .text("🔄 Yana 60 soniya", "game:speed:start")
      .text("🎮 Boshqa o'yinlar", "nav:games");
    await ctx.editMessageText(
      `⏰ <b>60 soniya tugadi!</b>\n\n✅ To'g'ri javoblar: <b>${res.state.score} / ${res.state.answered}</b>\n⭐ Qo'lga kiritildi: <b>+${res.xpEarned} XP</b>`,
      { parse_mode: "HTML", reply_markup: kb }
    );
    return;
  }

  await ctx.answerCallbackQuery({
    text: res.isCorrect ? "✅ +1" : "❌ Xato",
  });
  const { text, kb } = renderSpeedView(res.state);
  await ctx.editMessageText(text, { parse_mode: "HTML", reply_markup: kb });
});
