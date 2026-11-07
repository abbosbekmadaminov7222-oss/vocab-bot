import { NextFunction } from "grammy";
import { MyContext } from "../context.js";
import { env } from "../../config/env.js";

export function isAdminUser(telegramId: number): boolean {
  return env.ADMIN_IDS.includes(telegramId);
}

export async function adminMiddleware(
  ctx: MyContext,
  next: NextFunction
): Promise<void> {
  if (!ctx.from || !isAdminUser(ctx.from.id)) {
    await ctx.reply(ctx.t("admin-denied"));
    return;
  }
  await next();
}
