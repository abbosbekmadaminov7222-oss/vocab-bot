import { eq, sql, desc } from "drizzle-orm";
import { db } from "../index.js";
import { users, User, CefrLevel } from "../schema.js";

export class UserRepository {
  async findByTelegramId(telegramId: number): Promise<User | undefined> {
    const [user] = await db
      .select()
      .from(users)
      .where(eq(users.telegramId, telegramId))
      .limit(1);
    return user;
  }

  async findById(id: number): Promise<User | undefined> {
    const [user] = await db
      .select()
      .from(users)
      .where(eq(users.id, id))
      .limit(1);
    return user;
  }

  async findOrCreate(data: {
    telegramId: number;
    username?: string;
    firstName: string;
  }): Promise<User> {
    const existing = await this.findByTelegramId(data.telegramId);
    if (existing) {
      if (
        existing.username !== (data.username ?? null) ||
        existing.firstName !== data.firstName
      ) {
        const [updated] = await db
          .update(users)
          .set({
            username: data.username ?? null,
            firstName: data.firstName,
            updatedAt: new Date(),
          })
          .where(eq(users.id, existing.id))
          .returning();
        return updated ?? existing;
      }
      return existing;
    }

    const [created] = await db
      .insert(users)
      .values({
        telegramId: data.telegramId,
        username: data.username ?? null,
        firstName: data.firstName,
      })
      .returning();

    if (!created) {
      throw new Error("Failed to create user");
    }
    return created;
  }

  async updateOnboarding(
    userId: number,
    params: {
      level: CefrLevel;
      dailyGoal: number;
      reminderHour?: number;
    }
  ): Promise<User> {
    const [updated] = await db
      .update(users)
      .set({
        level: params.level,
        dailyGoal: params.dailyGoal,
        reminderHour: params.reminderHour ?? 9,
        onboarded: true,
        updatedAt: new Date(),
      })
      .where(eq(users.id, userId))
      .returning();

    if (!updated) {
      throw new Error("User not found");
    }
    return updated;
  }

  async updateProgress(
    userId: number,
    fields: Partial<
      Pick<
        User,
        | "xp"
        | "weeklyXp"
        | "userLevel"
        | "streak"
        | "lastActiveDate"
        | "wordsLearnedToday"
        | "lastLearnedDate"
        | "reminderHour"
        | "remindersEnabled"
        | "level"
        | "dailyGoal"
        | "referredBy"
        | "referralsCount"
      >
    >
  ): Promise<User> {
    const [updated] = await db
      .update(users)
      .set({
        ...fields,
        updatedAt: new Date(),
      })
      .where(eq(users.id, userId))
      .returning();

    if (!updated) {
      throw new Error("User not found");
    }
    return updated;
  }

  /**
   * Processes a referral if the invited user hasn't been referred yet and isn't referring themselves.
   * Awards +50 XP to the referrer and +25 XP welcome bonus to the invited user.
   */
  async processReferral(
    invitedUser: User,
    referrerTelegramId: number
  ): Promise<{ referrer: User; invited: User } | null> {
    if (
      invitedUser.referredBy ||
      invitedUser.onboarded ||
      invitedUser.telegramId === referrerTelegramId
    ) {
      return null;
    }

    const referrer = await this.findByTelegramId(referrerTelegramId);
    if (!referrer) {
      return null;
    }

    const [updatedInvited] = await db
      .update(users)
      .set({
        referredBy: referrer.telegramId,
        xp: invitedUser.xp + 25,
        weeklyXp: invitedUser.weeklyXp + 25,
        updatedAt: new Date(),
      })
      .where(eq(users.id, invitedUser.id))
      .returning();

    const [updatedReferrer] = await db
      .update(users)
      .set({
        referralsCount: referrer.referralsCount + 1,
        xp: referrer.xp + 50,
        weeklyXp: referrer.weeklyXp + 50,
        updatedAt: new Date(),
      })
      .where(eq(users.id, referrer.id))
      .returning();

    if (!updatedInvited || !updatedReferrer) return null;
    return { referrer: updatedReferrer, invited: updatedInvited };
  }

  async getWeeklyLeaderboard(limit = 10): Promise<User[]> {
    return db
      .select()
      .from(users)
      .orderBy(desc(users.weeklyXp), desc(users.xp))
      .limit(limit);
  }

  async getAllTimeLeaderboard(limit = 10): Promise<User[]> {
    return db
      .select()
      .from(users)
      .orderBy(desc(users.xp))
      .limit(limit);
  }

  async getUsersForHourReminder(hour: number): Promise<User[]> {
    return db
      .select()
      .from(users)
      .where(
        sql`${users.remindersEnabled} = true AND ${users.reminderHour} = ${hour}`
      );
  }

  async getAllUsers(): Promise<User[]> {
    return db.select().from(users);
  }

  async countUsers(): Promise<number> {
    const [row] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(users);
    return row?.count ?? 0;
  }
}

export const userRepo = new UserRepository();
