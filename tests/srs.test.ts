import { describe, it, expect } from "vitest";
import { calculateSM2 } from "../src/services/srs.service.js";

describe("SM-2 Spaced Repetition Algorithm (calculateSM2)", () => {
  const fixedNow = new Date("2026-11-06T12:00:00.000Z");

  it("schedules first 'Bilaman' (quality 5) for 1 day later with repetitions = 1", () => {
    const result = calculateSM2(
      5,
      { easeFactor: 2.5, interval: 0, repetitions: 0 },
      fixedNow
    );

    expect(result.repetitions).toBe(1);
    expect(result.interval).toBe(1);
    expect(result.easeFactor).toBe(2.6);
    expect(result.status).toBe("review");
    expect(result.nextReviewAt.getTime()).toBe(
      fixedNow.getTime() + 1 * 24 * 60 * 60 * 1000
    );
  });

  it("schedules second consecutive 'Bilaman' (quality 5) for 6 days later", () => {
    const result = calculateSM2(
      5,
      { easeFactor: 2.6, interval: 1, repetitions: 1 },
      fixedNow
    );

    expect(result.repetitions).toBe(2);
    expect(result.interval).toBe(6);
    expect(result.easeFactor).toBe(2.7);
    expect(result.status).toBe("review");
  });

  it("multiplies interval by easeFactor on third and subsequent reviews and marks 'mastered' when interval >= 21 and repetitions >= 4", () => {
    const third = calculateSM2(
      5,
      { easeFactor: 2.7, interval: 6, repetitions: 2 },
      fixedNow
    );
    expect(third.interval).toBe(16); // round(6 * 2.7)
    expect(third.repetitions).toBe(3);

    const fourth = calculateSM2(
      5,
      {
        easeFactor: third.easeFactor,
        interval: third.interval,
        repetitions: third.repetitions,
      },
      fixedNow
    );
    expect(fourth.interval).toBeGreaterThanOrEqual(21);
    expect(fourth.repetitions).toBe(4);
    expect(fourth.status).toBe("mastered");
  });

  it("resets repetitions and interval to 0 (10 min review) on 'Bilmayman' (quality 1)", () => {
    const result = calculateSM2(
      1,
      { easeFactor: 2.5, interval: 15, repetitions: 3 },
      fixedNow
    );

    expect(result.repetitions).toBe(0);
    expect(result.interval).toBe(0);
    expect(result.status).toBe("learning");
    expect(result.nextReviewAt.getTime()).toBe(
      fixedNow.getTime() + 10 * 60 * 1000
    );
  });

  it("never drops easeFactor below 1.3 even after repeated failures", () => {
    let state = { easeFactor: 1.35, interval: 6, repetitions: 2 };
    for (let i = 0; i < 5; i++) {
      state = calculateSM2(1, state, fixedNow);
    }
    expect(state.easeFactor).toBe(1.3);
  });

  it("schedules 'Keyinroq' (quality 3) for 1 day review", () => {
    const result = calculateSM2(
      3,
      { easeFactor: 2.5, interval: 6, repetitions: 2 },
      fixedNow
    );
    expect(result.interval).toBe(1);
    expect(result.repetitions).toBe(2);
    expect(result.easeFactor).toBe(2.36);
  });
});
