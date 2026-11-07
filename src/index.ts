import http from "node:http";
import { webhookCallback } from "grammy";
import { run, RunnerHandle } from "@grammyjs/runner";
import { env } from "./config/env.js";
import { initRedis } from "./config/redis.js";
import { ensureSchema, closeDatabase } from "./db/index.js";
import { wordRepo } from "./db/repositories/word.repo.js";
import { seedWordsDatabase } from "./db/seed.js";
import { createBot } from "./bot/index.js";
import {
  startReminderScheduler,
  stopReminderScheduler,
} from "./jobs/reminder.job.js";
import { logger } from "./utils/logger.js";

let runnerHandle: RunnerHandle | null = null;
let httpServer: http.Server | null = null;

async function bootstrap(): Promise<void> {
  logger.info({ mode: env.BOT_MODE, nodeEnv: env.NODE_ENV }, "Starting Uzbek-English Vocab Bot...");

  // 1. Initialize PostgreSQL Schema & Auto-Seed if empty
  await ensureSchema();
  const wordCount = await wordRepo.countWords();
  if (wordCount === 0) {
    logger.info("Words table is empty. Running initial seed (105 A1-A2 words)...");
    await seedWordsDatabase();
  } else {
    logger.info({ wordCount }, "Words bank ready.");
  }

  // 2. Initialize Redis (or persistent PostgreSQL kv_store fallback)
  await initRedis();

  // 3. Validate BOT_TOKEN before connecting to Telegram
  if (
    !env.BOT_TOKEN ||
    env.BOT_TOKEN === "0000000000:TEST_TOKEN_REPLACE_IN_ENV" ||
    env.BOT_TOKEN.includes("your_telegram_bot_token_here")
  ) {
    logger.warn(
      "⚠️ BOT_TOKEN is not set to a real Telegram BotFather token in .env! Database & services are ready, waiting for a valid BOT_TOKEN."
    );
    return;
  }

  const bot = createBot();

  // Set bot commands in Telegram UI
  await bot.api.setMyCommands([
    { command: "start", description: "🏠 Asosiy menyu" },
    { command: "learn", description: "📖 Yangi so'zlar va takrorlash" },
    { command: "quiz", description: "🧠 Test ishlash" },
    { command: "games", description: "🎮 Mini o'yinlar" },
    { command: "invite", description: "🎁 Do'stlarni chaqirish (+50 XP)" },
    { command: "stats", description: "📊 Mening statistikam" },
    { command: "top", description: "🏆 Haftalik reyting" },
    { command: "settings", description: "⚙️ Daraja va maqsadni sozlash" },
    { command: "admin", description: "🛠 Admin panel" },
  ]);

  // 4. Start BullMQ / Hourly Reminder Scheduler
  await startReminderScheduler(bot);

  // 5. Launch Bot in Webhook or Long-Polling Runner mode
  if (env.BOT_MODE === "webhook") {
    const webhookUrl = `${env.WEBHOOK_DOMAIN}${env.WEBHOOK_PATH}`;
    await bot.api.setWebhook(webhookUrl, {
      secret_token: env.WEBHOOK_SECRET,
      drop_pending_updates: true,
    });

    const handleUpdate = webhookCallback(bot, "http", {
      secretToken: env.WEBHOOK_SECRET,
    });

    httpServer = http.createServer(async (req, res) => {
      if (req.method === "POST" && req.url === env.WEBHOOK_PATH) {
        await handleUpdate(req, res);
      } else if (req.method === "GET" && req.url === "/health") {
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ status: "ok", uptime: process.uptime() }));
      } else {
        res.writeHead(404);
        res.end("Not Found");
      }
    });

    httpServer.listen(env.PORT, () => {
      logger.info(
        { port: env.PORT, webhookUrl },
        "🚀 Bot running in WEBHOOK mode"
      );
    });
  } else {
    await bot.api.deleteWebhook({ drop_pending_updates: false });
    const me = await bot.api.getMe();
    runnerHandle = run(bot);
    logger.info(
      { username: `@${me.username}`, id: me.id },
      "🚀 Bot running in LONG POLLING mode (@grammyjs/runner)"
    );
  }
}

async function shutdown(signal: string): Promise<void> {
  logger.info({ signal }, "Shutting down gracefully...");
  if (runnerHandle?.isRunning()) {
    await runnerHandle.stop();
  }
  if (httpServer) {
    httpServer.close();
  }
  await stopReminderScheduler();
  await closeDatabase();
  process.exit(0);
}

process.once("SIGINT", () => void shutdown("SIGINT"));
process.once("SIGTERM", () => void shutdown("SIGTERM"));

bootstrap().catch((err) => {
  logger.error({ err }, "Fatal error during bootstrap");
  process.exit(1);
});
