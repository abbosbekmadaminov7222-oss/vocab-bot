import { Menu } from "@grammyjs/menu";
import { MyContext } from "../context.js";
import { sendLearnCard } from "../handlers/learn.handler.js";
import { showQuizMenu } from "../handlers/quiz.handler.js";
import { showGamesMenu } from "../handlers/games.handler.js";
import { showStatsView, showLeaderboardView } from "../handlers/stats.handler.js";
import { showInviteView } from "../handlers/start.handler.js";

export const mainMenu = new Menu<MyContext>("main-menu")
  .text(
    (ctx) => ctx.t("btn-learn"),
    async (ctx) => {
      await sendLearnCard(ctx);
    }
  )
  .text(
    (ctx) => ctx.t("btn-quiz"),
    async (ctx) => {
      await showQuizMenu(ctx);
    }
  )
  .row()
  .text(
    (ctx) => ctx.t("btn-games"),
    async (ctx) => {
      await showGamesMenu(ctx);
    }
  )
  .text(
    (ctx) => ctx.t("btn-stats"),
    async (ctx) => {
      await showStatsView(ctx);
    }
  )
  .row()
  .text(
    (ctx) => ctx.t("btn-leaderboard"),
    async (ctx) => {
      await showLeaderboardView(ctx);
    }
  )
  .text(
    (ctx) => ctx.t("btn-settings"),
    async (ctx) => {
      await ctx.conversation.enter("onboardingConversation");
    }
  )
  .row()
  .text(
    (ctx) => ctx.t("btn-invite"),
    async (ctx) => {
      await showInviteView(ctx);
    }
  );
