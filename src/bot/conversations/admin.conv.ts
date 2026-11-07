import { parse } from "csv-parse/sync";
import { MyContext, MyConversation } from "../context.js";
import { wordRepo } from "../../db/repositories/word.repo.js";
import { userRepo } from "../../db/repositories/user.repo.js";
import { activityLogger } from "../../services/activity-logger.service.js";
import { CefrLevel, PartOfSpeech, NewWord } from "../../db/schema.js";
import { logger } from "../../utils/logger.js";

const VALID_LEVELS = new Set<CefrLevel>(["A1", "A2", "B1", "B2", "C1"]);
const VALID_POS = new Set<PartOfSpeech>([
  "noun",
  "verb",
  "adjective",
  "adverb",
  "phrase",
  "other",
]);

/**
 * Conversation for setting the Log Channel or Group ID.
 * Supports typing -100..., @username, OR forwarding a message from the channel!
 */
export async function adminSetLogChannelConversation(
  conversation: MyConversation,
  ctx: MyContext
): Promise<void> {
  const currentChannel = await conversation.external(() =>
    activityLogger.getTargetChannelId()
  );

  await ctx.reply(
    `📡 <b>Log Kanal yoki Guruh ID biriktirish</b>\n\n` +
      `Hozirgi ulangan ID: <code>${currentChannel || "O'rnatilmagan"}</code>\n\n` +
      `<b>Qanday ulanadi?</b>\n` +
      `1️⃣ Botni kanalingizga (yoki guruhingizga) <b>Admin</b> qiling.\n` +
      `2️⃣ Shu yerga kanal/guruh ID raqamini (masalan: <code>-1001234567890</code> yoki <code>@kanal_nomi</code>) yozib yuboring <b>YOKI</b> o'sha kanaldan bitta xabarni shu yerga <b>Forward (uzatish)</b> qiling!\n\n` +
      `Bekor qilish uchun /cancel yozing.`,
    { parse_mode: "HTML" }
  );

  const msgCtx = await conversation.wait();
  if (msgCtx.message?.text === "/cancel") {
    await msgCtx.reply("❌ Amal bekor qilindi.");
    return;
  }

  let targetId = "";

  // Check if message is forwarded from a channel
  const forwardOrigin = msgCtx.message?.forward_origin;
  if (forwardOrigin && forwardOrigin.type === "channel") {
    targetId = String(forwardOrigin.chat.id);
  } else if (msgCtx.message?.text) {
    targetId = msgCtx.message.text.trim();
  }

  if (!targetId) {
    await ctx.reply(
      "⚠️ Kanal ID topilmadi. Iltimos, <code>-100...</code> formatda ID yoki <code>@kanal_username</code> yuboring.",
      { parse_mode: "HTML" }
    );
    return;
  }

  try {
    await ctx.api.sendMessage(
      targetId,
      "✅ <b>@Quiz722bot faollik tizimi ulandi!</b>\nEndi botdan kim foydalansa, barcha ma'lumotlar shu kanal/guruhga yuboriladi.",
      { parse_mode: "HTML" }
    );

    await conversation.external(() =>
      activityLogger.setTargetChannelId(targetId)
    );

    await ctx.reply(
      `✅ <b>Muvaffaqiyatli ulandi!</b>\n📡 Kanal/Guruh ID: <code>${targetId}</code>\nEndi botga kirgan har bir foydalanuvchi haqida shu joyga xabar boradi.`,
      { parse_mode: "HTML" }
    );
  } catch (err) {
    logger.warn({ err, targetId }, "Failed to send test message to log channel");
    await ctx.reply(
      `❌ <b>Xatolik!</b> Bot <code>${targetId}</code> manziliga xabar yubora olmadi.\n\nIltimos, avval <b>@Quiz722bot</b> ni o'sha kanal yoki guruhga qo'shib, unga xabar yozish (Admin) huquqini bering va qayta urinib ko'ring.`,
      { parse_mode: "HTML" }
    );
  }
}

/**
 * Conversation for adding a single word via /admin panel.
 * Format: english | uzbek | pos | level | topic | exampleEn | exampleUz | ipa
 */
export async function adminAddWordConversation(
  conversation: MyConversation,
  ctx: MyContext
): Promise<void> {
  await ctx.reply(
    "➕ <b>Yangi so'z qo'shish</b>\n\nQuyidagi formatda yuboring (<code>|</code> belgisi bilan ajratib):\n<code>english | uzbek | pos | level | topic | exampleEn | exampleUz | ipa</code>\n\nMisol:\n<code>journey | sayohat | noun | A2 | travel | Have a safe journey! | Xavfsiz sayohat tilayman! | /ˈdʒɜː.ni/</code>\n\nBekor qilish uchun /cancel yozing.",
    { parse_mode: "HTML" }
  );

  const msgCtx = await conversation.waitFor("message:text");
  const text = msgCtx.message.text.trim();

  if (text === "/cancel") {
    await msgCtx.reply("❌ Amal bekor qilindi.");
    return;
  }

  const parts = text.split("|").map((s) => s.trim());
  if (parts.length < 6) {
    await msgCtx.reply(
      "⚠️ Format noto'g'ri! Kamida 6 ta maydon bo'lishi kerak: english | uzbek | pos | level | topic | exampleEn"
    );
    return;
  }

  const [english, uzbek, rawPos, rawLevel, topic, exampleEn, exampleUz, ipa] =
    parts;
  const pos: PartOfSpeech = VALID_POS.has(rawPos as PartOfSpeech)
    ? (rawPos as PartOfSpeech)
    : "noun";
  const level: CefrLevel = VALID_LEVELS.has(rawLevel?.toUpperCase() as CefrLevel)
    ? (rawLevel!.toUpperCase() as CefrLevel)
    : "A1";

  const created = await conversation.external(async () =>
    wordRepo.createWord({
      english: english!,
      uzbek: uzbek!,
      pos,
      level,
      topic: topic || "general",
      exampleEn: exampleEn!,
      exampleUz: exampleUz ?? "",
      ipa: ipa ?? null,
    })
  );

  await msgCtx.reply(
    `✅ <b>So'z muvaffaqiyatli qo'shildi!</b>\n🇬🇧 <b>${created.english}</b> — 🇺🇿 ${created.uzbek} (${created.level}, ${created.pos})`,
    { parse_mode: "HTML" }
  );
}

/**
 * Conversation for importing multiple words via CSV text or CSV document.
 * Columns: english,uzbek,pos,level,topic,example_en,example_uz,ipa
 */
export async function adminCsvImportConversation(
  conversation: MyConversation,
  ctx: MyContext
): Promise<void> {
  await ctx.reply(
    "📥 <b>CSV orqali so'zlarni yuklash</b>\n\nCSV matn yoki <code>.csv</code> fayl yuboring.\nUstunlar tartibi:\n<code>english,uzbek,pos,level,topic,example_en,example_uz,ipa</code>\n\nBekor qilish: /cancel",
    { parse_mode: "HTML" }
  );

  const msgCtx = await conversation.wait();
  if (msgCtx.message?.text === "/cancel") {
    await msgCtx.reply("❌ CSV import bekor qilindi.");
    return;
  }

  let csvContent = "";
  if (msgCtx.message?.text) {
    csvContent = msgCtx.message.text;
  } else if (msgCtx.message?.document) {
    const file = await msgCtx.getFile();
    const url = `https://api.telegram.org/file/bot${ctx.api.token}/${file.file_path}`;
    const response = await fetch(url);
    csvContent = await response.text();
  } else {
    await ctx.reply("⚠️ Matn yoki CSV fayl yuboring.");
    return;
  }

  try {
    const records = parse(csvContent, {
      columns: true,
      skip_empty_lines: true,
      trim: true,
    }) as Record<string, string>[];

    const wordsToInsert: NewWord[] = [];
    for (const row of records) {
      if (!row.english || !row.uzbek) continue;
      const pos: PartOfSpeech = VALID_POS.has(row.pos as PartOfSpeech)
        ? (row.pos as PartOfSpeech)
        : "noun";
      const level: CefrLevel = VALID_LEVELS.has(
        row.level?.toUpperCase() as CefrLevel
      )
        ? (row.level!.toUpperCase() as CefrLevel)
        : "A1";

      wordsToInsert.push({
        english: row.english,
        uzbek: row.uzbek,
        pos,
        level,
        topic: row.topic || "general",
        exampleEn: row.example_en || `${row.english} is an important word.`,
        exampleUz: row.example_uz || "",
        ipa: row.ipa || null,
      });
    }

    const insertedCount = await conversation.external(() =>
      wordRepo.bulkInsert(wordsToInsert)
    );

    await ctx.reply(
      `✅ <b>CSV import yakunlandi!</b>\nJami qo'shildi/yangilandi: <b>${insertedCount} ta so'z</b>.`,
      { parse_mode: "HTML" }
    );
  } catch (err) {
    logger.error({ err }, "CSV import error");
    await ctx.reply("❌ CSV tahlil qilishda xatolik yuz berdi. Formatni tekshiring.");
  }
}

/**
 * Conversation for broadcasting a message to all registered users.
 */
export async function adminBroadcastConversation(
  conversation: MyConversation,
  ctx: MyContext
): Promise<void> {
  await ctx.reply(
    "📢 <b>Barcha foydalanuvchilarga xabar yuborish (Broadcast)</b>\n\nYubormoqchi bo'lgan xabar matnini kiriting (HTML format qo'llab-quvvatlanadi).\nBekor qilish: /cancel",
    { parse_mode: "HTML" }
  );

  const msgCtx = await conversation.waitFor("message:text");
  const text = msgCtx.message.text.trim();
  if (text === "/cancel") {
    await msgCtx.reply("❌ Broadcast bekor qilindi.");
    return;
  }

  const allUsers = await conversation.external(() => userRepo.getAllUsers());
  let sent = 0;
  let failed = 0;

  for (const u of allUsers) {
    try {
      await ctx.api.sendMessage(u.telegramId, text, { parse_mode: "HTML" });
      sent++;
    } catch {
      failed++;
    }
  }

  await msgCtx.reply(
    `✅ <b>Xabar yuborildi!</b>\n📤 Yetkazildi: <b>${sent}</b>\n⚠️ Xatolik: <b>${failed}</b>`,
    { parse_mode: "HTML" }
  );
}
