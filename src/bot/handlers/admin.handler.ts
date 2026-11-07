import { Composer, InlineKeyboard } from "grammy";
import { MyContext } from "../context.js";
import { adminMiddleware } from "../middlewares/admin.middleware.js";
import { userRepo } from "../../db/repositories/user.repo.js";
import { wordRepo } from "../../db/repositories/word.repo.js";
import { activityLogger } from "../../services/activity-logger.service.js";
import { env } from "../../config/env.js";

export const adminHandler = new Composer<MyContext>();

function buildAdminKeyboard(): InlineKeyboard {
  return new InlineKeyboard()
    .text("📡 Kanal/Guruh ID ulash", "admin:set_channel")
    .text("👥 Foydalanuvchilar", "admin:users_list")
    .row()
    .text("➕ Bitta so'z qo'shish", "admin:add_word")
    .text("📥 CSV import", "admin:csv_import")
    .row()
    .text("📢 Xabar yuborish (Broadcast)", "admin:broadcast")
    .row()
    .text("🏠 Asosiy menyu", "nav:main");
}

adminHandler.command("admin", adminMiddleware, async (ctx) => {
  const [usersCount, wordsCount, logChannel] = await Promise.all([
    userRepo.countUsers(),
    wordRepo.countWords(),
    activityLogger.getTargetChannelId(),
  ]);

  const text =
    `${ctx.t("admin-menu", { usersCount, wordsCount })}\n` +
    `📡 Log Kanal/Guruh ID: <code>${logChannel || "O'rnatilmagan (Adminga boradi)"}</code>`;

  await ctx.reply(text, {
    parse_mode: "HTML",
    reply_markup: buildAdminKeyboard(),
  });
});

adminHandler.callbackQuery("admin:set_channel", adminMiddleware, async (ctx) => {
  await ctx.answerCallbackQuery();
  await ctx.conversation.enter("adminSetLogChannelConversation");
});

adminHandler.callbackQuery("admin:users_list", adminMiddleware, async (ctx) => {
  await ctx.answerCallbackQuery();
  const allUsers = await userRepo.getAllUsers();
  const recent = allUsers.slice(-20).reverse();

  const lines = recent.map((u, idx) => {
    const uname = u.username ? `@${u.username}` : "—";
    return `${idx + 1}. <b>${u.firstName}</b> (${uname}) | ID: <code>${u.telegramId}</code> | ${u.level} | ⭐ ${u.xp} XP`;
  });

  const text =
    `👥 <b>Bot foydalanuvchilari (${allUsers.length} ta):</b>\n\n` +
    (lines.length > 0 ? lines.join("\n") : "Hozircha foydalanuvchilar yo'q.");

  await ctx.reply(text, {
    parse_mode: "HTML",
    reply_markup: buildAdminKeyboard(),
  });
});

adminHandler.callbackQuery("admin:add_word", adminMiddleware, async (ctx) => {
  await ctx.answerCallbackQuery();
  await ctx.conversation.enter("adminAddWordConversation");
});

adminHandler.callbackQuery("admin:csv_import", adminMiddleware, async (ctx) => {
  await ctx.answerCallbackQuery();
  await ctx.conversation.enter("adminCsvImportConversation");
});

adminHandler.callbackQuery("admin:broadcast", adminMiddleware, async (ctx) => {
  await ctx.answerCallbackQuery();
  await ctx.conversation.enter("adminBroadcastConversation");
});

// Automatically detect when the bot is added to a Group or Channel and bind its ID!
adminHandler.on("my_chat_member", async (ctx) => {
  const chat = ctx.myChatMember.chat;
  const newStatus = ctx.myChatMember.new_chat_member.status;

  if (
    (chat.type === "channel" ||
      chat.type === "supergroup" ||
      chat.type === "group") &&
    (newStatus === "administrator" || newStatus === "member")
  ) {
    const chatIdStr = String(chat.id);
    await activityLogger.setTargetChannelId(chatIdStr);

    try {
      await ctx.api.sendMessage(
        chatIdStr,
        `✅ <b>@Quiz722bot ushbu ${chat.type === "channel" ? "kanalga" : "guruhga"} ulandi!</b>\n🆔 ID: <code>${chatIdStr}</code>\nEndi botdan foydalanayotgan barcha foydalanuvchilar haqidagi ma'lumotlar shu yerga kelib tushadi.`,
        { parse_mode: "HTML" }
      );
    } catch {
      // Ignore if lacks send permission yet
    }

    for (const adminId of env.ADMIN_IDS) {
      try {
        await ctx.api.sendMessage(
          adminId,
          `📡 <b>Avtomatik ulanish!</b>\nBot <b>${chat.title || "Guruh/Kanal"}</b> (ID: <code>${chatIdStr}</code>) ga qo'shildi va log kanali sifatida saqlandi!`,
          { parse_mode: "HTML" }
        );
      } catch {
        // Ignore
      }
    }
  }
});
