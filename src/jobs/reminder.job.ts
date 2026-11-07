import { Queue, Worker } from "bullmq";
import { Bot, InlineKeyboard } from "grammy";
import { isRedisAvailable } from "../config/redis.js";
import { env } from "../config/env.js";
import { userRepo } from "../db/repositories/user.repo.js";
import { srsRepo } from "../db/repositories/srs.repo.js";
import { i18n } from "../i18n/index.js";
import { logger } from "../utils/logger.js";
import { MyContext } from "../bot/context.js";

const QUEUE_NAME = "daily-vocab-reminders";

let reminderQueue: Queue | null = null;
let reminderWorker: Worker | null = null;
let localInterval: NodeJS.Timeout | null = null;
let lastCheckedHour = -1;

function getCurrentHourInTimezone(): number {
  const formatted = new Intl.DateTimeFormat("en-US", {
    timeZone: env.DEFAULT_TIMEZONE,
    hour: "numeric",
    hour12: false,
  }).format(new Date());
  return Number(formatted) % 24;
}

export async function processHourlyReminders(
  bot: Bot<MyContext>,
  hour: number
): Promise<number> {
  const users = await userRepo.getUsersForHourReminder(hour);
  let sentCount = 0;

  for (const user of users) {
    try {
      const dueCount = await srsRepo.countDueWords(user.id);
      // Only send reminder if the user actually has due words
      if (dueCount <= 0) continue;

      const text = i18n.t("uz", "daily-reminder", {
        name: user.firstName,
        dueCount,
        streak: user.streak,
      });

      const kb = new InlineKeyboard().text(
        `📖 Hoziroq takrorlash (${dueCount} ta)`,
        "nav:learn"
      );

      await bot.api.sendMessage(user.telegramId, text, {
        parse_mode: "HTML",
        reply_markup: kb,
      });
      sentCount++;
    } catch (err) {
      logger.warn(
        { err, telegramId: user.telegramId },
        "Failed to send daily reminder to user"
      );
    }
  }

  if (sentCount > 0) {
    logger.info({ hour, sentCount }, "Sent daily vocabulary reminders");
  }
  return sentCount;
}

export async function startReminderScheduler(
  bot: Bot<MyContext>
): Promise<void> {
  if (isRedisAvailable()) {
    const connectionUrl = new URL(env.REDIS_URL);
    const connection = {
      host: connectionUrl.hostname,
      port: Number(connectionUrl.port || 6379),
      password: connectionUrl.password || undefined,
    };

    reminderQueue = new Queue(QUEUE_NAME, { connection });

    // Schedule hourly check at minute 0
    await reminderQueue.upsertJobScheduler(
      "hourly-reminder-trigger",
      { pattern: "0 * * * *" },
      {
        name: "check-due-reminders",
        data: {},
      }
    );

    reminderWorker = new Worker(
      QUEUE_NAME,
      async () => {
        const hour = getCurrentHourInTimezone();
        await processHourlyReminders(bot, hour);
      },
      { connection }
    );

    reminderWorker.on("failed", (job, err) => {
      logger.error({ jobId: job?.id, err }, "BullMQ reminder job failed");
    });

    logger.info("BullMQ daily reminder queue & worker started.");
    return;
  }

  // Fallback local scheduler when running without Redis
  localInterval = setInterval(async () => {
    const hour = getCurrentHourInTimezone();
    if (hour !== lastCheckedHour) {
      lastCheckedHour = hour;
      await processHourlyReminders(bot, hour);
    }
  }, 60_000);

  logger.info("Local hourly reminder scheduler started (PostgreSQL mode).");
}

export async function stopReminderScheduler(): Promise<void> {
  if (reminderWorker) await reminderWorker.close();
  if (reminderQueue) await reminderQueue.close();
  if (localInterval) clearInterval(localInterval);
}
