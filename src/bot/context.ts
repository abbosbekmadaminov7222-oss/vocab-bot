import { Context, SessionFlavor } from "grammy";
import { I18nFlavor } from "@grammyjs/i18n";
import { Conversation, ConversationFlavor } from "@grammyjs/conversations";
import { User } from "../db/schema.js";

export interface SessionData {
  step?: string;
}

export interface DbUserFlavor {
  dbUser: User;
}

export type BaseBotContext = Context &
  SessionFlavor<SessionData> &
  I18nFlavor &
  DbUserFlavor;

export type MyContext = ConversationFlavor<BaseBotContext>;
export type MyConversation = Conversation<MyContext, MyContext>;
