import { Bot, session, StorageAdapter, GrammyError, HttpError } from "grammy";
import { autoRetry } from "@grammyjs/auto-retry";
import { limit } from "@grammyjs/ratelimiter";
import { conversations, createConversation } from "@grammyjs/conversations";
import { env } from "../config/env.js";
import { stateStore } from "../config/redis.js";
import { logger } from "../utils/logger.js";
import { i18n } from "../i18n/index.js";
import { MyContext, SessionData } from "./context.js";
import { authMiddleware } from "./middlewares/auth.middleware.js";
import { mainMenu } from "./menus/main.menu.js";
import { onboardingConversation } from "./conversations/onboarding.conv.js";
import {
  adminSetLogChannelConversation,
  adminAddWordConversation,
  adminCsvImportConversation,
  adminBroadcastConversation,
} from "./conversations/admin.conv.js";
import { startHandler } from "./handlers/start.handler.js";
import { learnHandler } from "./handlers/learn.handler.js";
import { quizHandler } from "./handlers/quiz.handler.js";
import { gamesHandler } from "./handlers/games.handler.js";
import { statsHandler } from "./handlers/stats.handler.js";
import { adminHandler } from "./handlers/admin.handler.js";

/**
 * Persistent storage adapter backed by Redis (or PostgreSQL kv_store fallback)
 */
function createPersistentStorage<T>(prefix: string): StorageAdapter<T> {
  return {
    read: async (key: string) => {
      const val = await stateStore.get<T>(`${prefix}:${key}`);
      return val ?? undefined;
    },
    write: async (key: string, value: T) => {
      await stateStore.set(`${prefix}:${key}`, value, 7 * 86400);
    },
    delete: async (key: string) => {
      await stateStore.del(`${prefix}:${key}`);
    },
  };
}

export function createBot(): Bot<MyContext> {
  const bot = new Bot<MyContext>(env.BOT_TOKEN);

  // 1. Auto-retry on Telegram 429 flood-wait or 5xx errors
  bot.api.config.use(
    autoRetry({
      maxRetryAttempts: 3,
      maxDelaySeconds: 30,
    })
  );

  // 2. Flood & Rate limiting (max 4 requests per 2 seconds per user)
  bot.use(
    limit({
      timeFrame: 2000,
      limit: 4,
      onLimitExceeded: async (ctx) => {
        if (ctx.callbackQuery) {
          await ctx.answerCallbackQuery({
            text: "⏳ Iltimos, tugmalarni juda tez bosmang!",
          });
        } else {
          await ctx.reply("⏳ Iltimos, biroz sekinroq yozing!");
        }
      },
      keyGenerator: (ctx) => ctx.from?.id.toString(),
    })
  );

  // 3. Persistent Session
  bot.use(
    session<SessionData, MyContext>({
      initial: (): SessionData => ({}),
      storage: createPersistentStorage<SessionData>("session"),
    })
  );

  // 4. Localization (Uzbek Latin)
  bot.use(i18n);

  // 5. Authenticate / Upsert user in PostgreSQL + Log Activity
  bot.use(authMiddleware);

  // 6. Conversations plugin (persisted in Redis/PostgreSQL)
  bot.use(
    conversations({
      storage: {
        type: "key",
        version: 1,
        adapter: createPersistentStorage("conv"),
      },
    })
  );

  bot.use(createConversation(onboardingConversation, "onboardingConversation"));
  bot.use(
    createConversation(
      adminSetLogChannelConversation,
      "adminSetLogChannelConversation"
    )
  );
  bot.use(
    createConversation(adminAddWordConversation, "adminAddWordConversation")
  );
  bot.use(
    createConversation(adminCsvImportConversation, "adminCsvImportConversation")
  );
  bot.use(
    createConversation(adminBroadcastConversation, "adminBroadcastConversation")
  );

  // 7. Interactive Menus
  bot.use(mainMenu);

  // 8. Feature Handlers
  bot.use(startHandler);
  bot.use(learnHandler);
  bot.use(quizHandler);
  bot.use(gamesHandler);
  bot.use(statsHandler);
  bot.use(adminHandler);

  // 9. Global Error Handler
  bot.catch((err) => {
    const ctx = err.ctx;
    logger.error(
      {
        updateId: ctx.update.update_id,
        userId: ctx.from?.id,
        err: err.error,
      },
      "Unhandled bot error caught by bot.catch"
    );

    if (err.error instanceof GrammyError) {
      logger.error({ description: err.error.description }, "Telegram API error");
    } else if (err.error instanceof HttpError) {
      logger.error({ error: err.error }, "Telegram network error");
    }

    ctx.reply(ctx.t("error-generic")).catch(() => {});
  });

  return bot;
}
