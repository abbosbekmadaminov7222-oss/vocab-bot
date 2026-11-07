import { and, eq, ne, notInArray, sql } from "drizzle-orm";
import { db } from "../index.js";
import {
  words,
  userWords,
  Word,
  NewWord,
  CefrLevel,
  PartOfSpeech,
} from "../schema.js";

export class WordRepository {
  async findById(id: number): Promise<Word | undefined> {
    const [word] = await db
      .select()
      .from(words)
      .where(eq(words.id, id))
      .limit(1);
    return word;
  }

  async getUnseenWordsForUser(
    userId: number,
    level: CefrLevel,
    limit: number
  ): Promise<Word[]> {
    const seenSubquery = db
      .select({ wordId: userWords.wordId })
      .from(userWords)
      .where(eq(userWords.userId, userId));

    const levelWords = await db
      .select()
      .from(words)
      .where(
        and(eq(words.level, level), notInArray(words.id, seenSubquery))
      )
      .orderBy(sql`RANDOM()`)
      .limit(limit);

    if (levelWords.length >= limit) {
      return levelWords;
    }

    // Fallback to any level if current level runs low
    const extraWords = await db
      .select()
      .from(words)
      .where(notInArray(words.id, seenSubquery))
      .orderBy(sql`RANDOM()`)
      .limit(limit - levelWords.length);

    const existingIds = new Set(levelWords.map((w) => w.id));
    for (const w of extraWords) {
      if (!existingIds.has(w.id)) {
        levelWords.push(w);
      }
    }
    return levelWords.slice(0, limit);
  }

  async getSmartDistractors(
    targetWord: Word,
    count = 3
  ): Promise<Word[]> {
    // 1. Prefer same level AND same POS
    const sameLevelAndPos = await db
      .select()
      .from(words)
      .where(
        and(
          ne(words.id, targetWord.id),
          eq(words.level, targetWord.level),
          eq(words.pos, targetWord.pos)
        )
      )
      .orderBy(sql`RANDOM()`)
      .limit(count);

    if (sameLevelAndPos.length >= count) {
      return sameLevelAndPos;
    }

    // 2. Fallback: same POS or same level
    const usedIds = [targetWord.id, ...sameLevelAndPos.map((w) => w.id)];
    const fallback = await db
      .select()
      .from(words)
      .where(notInArray(words.id, usedIds))
      .orderBy(sql`RANDOM()`)
      .limit(count - sameLevelAndPos.length);

    return [...sameLevelAndPos, ...fallback];
  }

  async getRandomWords(
    level: CefrLevel,
    count: number
  ): Promise<Word[]> {
    const list = await db
      .select()
      .from(words)
      .where(eq(words.level, level))
      .orderBy(sql`RANDOM()`)
      .limit(count);

    if (list.length >= count) return list;

    return db
      .select()
      .from(words)
      .orderBy(sql`RANDOM()`)
      .limit(count);
  }

  async createWord(data: NewWord): Promise<Word> {
    const [inserted] = await db
      .insert(words)
      .values(data)
      .onConflictDoUpdate({
        target: [words.english, words.level],
        set: {
          uzbek: data.uzbek,
          pos: data.pos,
          topic: data.topic,
          exampleEn: data.exampleEn,
          exampleUz: data.exampleUz ?? "",
          ipa: data.ipa ?? null,
          audioFileId: data.audioFileId ?? null,
        },
      })
      .returning();

    if (!inserted) {
      throw new Error("Failed to insert word");
    }
    return inserted;
  }

  async bulkInsert(items: NewWord[]): Promise<number> {
    if (items.length === 0) return 0;
    let count = 0;
    for (const item of items) {
      await this.createWord(item);
      count++;
    }
    return count;
  }

  async countWords(): Promise<number> {
    const [row] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(words);
    return row?.count ?? 0;
  }

  async getDistinctTopics(level?: CefrLevel): Promise<PartOfSpeech[] | string[]> {
    const query = level
      ? db
          .selectDistinct({ topic: words.topic })
          .from(words)
          .where(eq(words.level, level))
      : db.selectDistinct({ topic: words.topic }).from(words);

    const rows = await query;
    return rows.map((r) => r.topic);
  }
}

export const wordRepo = new WordRepository();
