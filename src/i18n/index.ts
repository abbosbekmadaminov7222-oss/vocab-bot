import { I18n } from "@grammyjs/i18n";
import path from "node:path";
import fs from "node:fs";
import type { MyContext } from "../bot/context.js";

function resolveLocalesDir(): string {
  const srcPath = path.resolve(process.cwd(), "src/i18n/locales");
  if (fs.existsSync(srcPath)) return srcPath;
  return path.resolve(process.cwd(), "dist/i18n/locales");
}

export const i18n = new I18n<MyContext>({
  defaultLocale: "uz",
  directory: resolveLocalesDir(),
  localeNegotiator: () => "uz",
  globalTranslationContext(ctx) {
    return {
      name: ctx.from?.first_name ?? "O'quvchi",
    };
  },
});
