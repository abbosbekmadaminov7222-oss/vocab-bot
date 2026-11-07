import * as dotenv from "dotenv";
import { z } from "zod";

dotenv.config();

const rawEnv = {
  ...process.env,
  BOT_TOKEN:
    process.env.BOT_TOKEN ||
    process.env.TELEGRAM_BOT_TOKEN ||
    process.env.TELEGRAM_TOKEN ||
    process.env.TOKEN ||
    "9250532498:AAHcoIHL28xbB6nQmv7OP95rgvnP7FJYpQM",
};

const envSchema = z
  .object({
    NODE_ENV: z
      .enum(["development", "production", "test"])
      .default("production"),
    LOG_LEVEL: z
      .enum(["fatal", "error", "warn", "info", "debug", "trace"])
      .default("info"),

    BOT_TOKEN: z.string().min(10, "BOT_TOKEN is required"),
    ADMIN_IDS: z
      .string()
      .default("1032612756")
      .transform((val) =>
        val
          .split(",")
          .map((s) => s.trim())
          .filter(Boolean)
          .map((s) => Number(s))
          .filter((n) => !Number.isNaN(n))
      ),
    LOG_CHANNEL_ID: z.string().optional().default(""),

    BOT_MODE: z.enum(["polling", "webhook"]).default("polling"),
    WEBHOOK_DOMAIN: z.string().url().optional(),
    WEBHOOK_PATH: z.string().default("/webhook/telegram"),
    WEBHOOK_SECRET: z.string().min(8).optional(),
    PORT: z.coerce.number().int().positive().default(3000),

    DATABASE_URL: z.string().default("file:./data/pglite"),
    REDIS_URL: z.string().default("redis://localhost:6379"),

    DEFAULT_TIMEZONE: z.string().default("Asia/Tashkent"),
  })
  .superRefine((data, ctx) => {
    if (data.BOT_MODE === "webhook") {
      if (!data.WEBHOOK_DOMAIN) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["WEBHOOK_DOMAIN"],
          message: "WEBHOOK_DOMAIN is required when BOT_MODE is 'webhook'",
        });
      }
      if (!data.WEBHOOK_SECRET) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["WEBHOOK_SECRET"],
          message: "WEBHOOK_SECRET is required when BOT_MODE is 'webhook'",
        });
      }
    }
  });

const parsed = envSchema.safeParse(rawEnv);

if (!parsed.success) {
  console.error(
    "❌ Invalid environment variables:",
    JSON.stringify(parsed.error.format(), null, 2)
  );
  process.exit(1);
}

export const env = parsed.data;
export type Env = typeof env;
