import { describe, it, expect } from "vitest";
import {
  levenshteinDistance,
  checkTypedAnswer,
  normalizeText,
} from "../src/utils/text.js";

describe("Quiz Answer Checking & Levenshtein Distance", () => {
  it("normalizes case, whitespace, punctuation, and Uzbek apostrophes", () => {
    expect(normalizeText("  O‘qituvchi! ")).toBe("o'qituvchi");
    expect(normalizeText("Go`sht")).toBe("go'sht");
  });

  it("calculates exact Levenshtein distance", () => {
    expect(levenshteinDistance("apple", "apple")).toBe(0);
    expect(levenshteinDistance("apple", "aple")).toBe(1);
    expect(levenshteinDistance("experience", "expirience")).toBe(1);
    expect(levenshteinDistance("book", "door")).toBe(2);
  });

  it("accepts exact answers as correct and exact", () => {
    const res = checkTypedAnswer("Airport", "airport");
    expect(res.isCorrect).toBe(true);
    expect(res.isExact).toBe(true);
    expect(res.distance).toBe(0);
  });

  it("tolerates 1-character typo on medium words (5-7 chars)", () => {
    const res = checkTypedAnswer("aiport", "airport");
    expect(res.isCorrect).toBe(true);
    expect(res.isExact).toBe(false);
    expect(res.distance).toBe(1);
  });

  it("tolerates up to 2-character typos on long words (8+ chars)", () => {
    const res = checkTypedAnswer("experiense", "experience");
    expect(res.isCorrect).toBe(true);
    expect(res.isExact).toBe(false);
    expect(res.distance).toBeLessThanOrEqual(2);
  });

  it("rejects typos on very short words (<= 4 chars)", () => {
    const res = checkTypedAnswer("bok", "book");
    expect(res.isCorrect).toBe(false);
  });

  it("supports slash-separated synonyms", () => {
    const res1 = checkTypedAnswer("maosh", "maosh / oylik");
    const res2 = checkTypedAnswer("oylik", "maosh / oylik");
    expect(res1.isCorrect).toBe(true);
    expect(res2.isCorrect).toBe(true);
  });
});
