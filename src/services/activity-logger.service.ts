import { Api } from "grammy";
import { stateStore } from "../config/redis.js";
import { env } from "../config/env.js";
import { User } from "../db/schema.js";
import { logger } from "../utils/logger.js";

const LOG_CHANNEL_KEY = "config:log_channel_id";

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function formatTashkentTime(date = new Date()): string {
  return new Intl.DateTimeFormat("uz-UZ", {
    timeZone: env.DEFAULT_TIMEZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  }).format(date);
}

export class ActivityLoggerService {
  async getTargetChannelId(): Promise<string | null> {
    const saved = await stateStore.get<string>(LOG_CHANNEL_KEY);
    if (saved && saved.trim().length > 0) {
      return saved.trim();
    }
    if (env.LOG_CHANNEL_ID && env.LOG_CHANNEL_ID.trim().length > 0) {
      return env.LOG_CHANNEL_ID.trim();
    }
    return null;
  }

  async setTargetChannelId(channelId: string): Promise<void> {
    // Never expire this config key (10 years TTL)
    await stateStore.set(LOG_CHANNEL_KEY, channelId.trim(), 3650 * 86400);
  }

  /**
   * Sends a real-time notification to the configured Telegram Channel or Group ID
   * (or to ADMIN_IDS if no channel/group is set yet) whenever someone uses the bot.
   */
  async notifyUserActivity(
    api: Api,
    user: User,
    actionTitle: string,
    extraDetails?: string,
    isNewUser = false
  ): Promise<void> {
    try {
      const targetChannel = await this.getTargetChannelId();
      const usernameStr = user.username
        ? `@${escapeHtml(user.username)}`
        : "<i>mavjud emas</i>";
      const safeName = escapeHtml(user.firstName);
      const timeStr = formatTashkentTime();

      const header = isNewUser
        ? "🆕 <b>YANGI FOYDALANUVCHI QO'SHILDI!</b>"
        : "📡 <b>FOYDALANUVCHI FAOLLIGI</b>";

      let message =
        `${header}\n\n` +
        `👤 <b>Ism:</b> <a href="tg://user?id=${user.telegramId}">${safeName}</a>\n` +
        `🆔 <b>Telegram ID:</b> <code>${user.telegramId}</code>\n` +
        `🔗 <b>Username:</b> ${usernameStr}\n` +
        `🎓 <b>Daraja:</b> ${user.level} | ⭐ <b>XP:</b> ${user.xp} | 🔥 <b>Streak:</b> ${user.streak}\n` +
        `⚡ <b>Harakat:</b> ${escapeHtml(actionTitle)}\n`;

      if (extraDetails) {
        message += `📝 <b>Tafsilot:</b> ${escapeHtml(extraDetails)}\n`;
      }

      message += `🕒 <b>Vaqt:</b> ${timeStr}`;

      if (targetChannel) {
        await api.sendMessage(targetChannel, message, {
          parse_mode: "HTML",
        });
        return;
      }

      // If no channel/group ID is configured yet, notify admins when another user uses the bot
      for (const adminId of env.ADMIN_IDS) {
        if (adminId !== user.telegramId || isNewUser) {
          await api.sendMessage(adminId, message, {
            parse_mode: "HTML",
          });
        }
      }
    } catch (err) {
      logger.warn({ err }, "Failed to send user activity log to channel/group");
    }
  }
}

export const activityLogger = new ActivityLoggerService();
