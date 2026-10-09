import { describe, expect, it } from "vitest";
import { BOOK_PAGES, GOAL_MINUTES, GOAL_WPM, OUTCOME_HEADLINE, bookGoalView, world1BestCase } from "../../../lib/v2/book-goal";
import { learnerLanguageViolations } from "../../../lib/v2/learner-language";
import { REFERENCE_BOOK_WORDS } from "../../../lib/v2/book-time";

describe("the outcome the learner sees: a 200-page book in under 3 hours", () => {
  it("is built on the 50,000-word / 200-page reference book and a 180-minute goal", () => {
    expect(BOOK_PAGES).toBe(200);
    expect(REFERENCE_BOOK_WORDS).toBe(50_000);
    expect(GOAL_MINUTES).toBe(180);
    expect(GOAL_WPM).toBe(278); // derived, not configured: 50,000 / 180 rounded up
    expect(OUTCOME_HEADLINE).toBe("Read a 200-page book in under 3 hours - with understanding and retention.");
  });

  it("the headline talks about the outcome, not speed, and is safe for children", () => {
    expect(OUTCOME_HEADLINE).not.toMatch(/WPM|words a minute|words per minute|speed/i);
    expect(learnerLanguageViolations(OUTCOME_HEADLINE)).toEqual([]);
  });

  it("converts earned speed into the book time it implies, in 'about' wording", () => {
    expect(bookGoalView(100, 100)).toMatchObject({ nowText: "about 8 hours 20 minutes", goalText: "under 3 hours", savedText: null, journey: 0, goalReached: false });
    expect(bookGoalView(125, 100).nowText).toBe("about 6 hours 40 minutes");
    expect(bookGoalView(150, 100).nowText).toBe("about 5 hours 33 minutes");
  });

  it("time saved since starting grows as speed grows, and is absent before any gain", () => {
    expect(bookGoalView(100, 100).savedText).toBeNull();
    expect(bookGoalView(125, 100).savedText).toBe("about 1 hour 40 minutes");
    const a = bookGoalView(110, 100), b = bookGoalView(120, 100);
    expect(b.minutesNow).toBeLessThan(a.minutesNow);
  });

  it("the journey bar is the share of the way from the starting time to the goal, never past 100%, never negative", () => {
    expect(bookGoalView(100, 100).journey).toBe(0);
    const mid = bookGoalView(150, 100);
    expect(mid.journey).toBeGreaterThan(0.3);
    expect(mid.journey).toBeLessThan(0.6);
    expect(bookGoalView(278, 100).journey).toBeGreaterThanOrEqual(0.99);
    expect(bookGoalView(400, 100).journey).toBe(1);
    expect(bookGoalView(90, 100).journey).toBe(0); // earned speed is never lowered, but the maths is still safe
  });

  it("never says the goal is met inside World 1 (best case is about 5.5 hours) and only flags it at 278+", () => {
    expect(bookGoalView(150, 60).goalReached).toBe(false);
    expect(world1BestCase().text).toBe("about 5 hours 33 minutes");
    expect(bookGoalView(277, 60).goalReached).toBe(false);
    expect(bookGoalView(278, 60).goalReached).toBe(true);
  });

  it("a learner who already starts at or past the goal has a complete journey", () => {
    expect(bookGoalView(300, 300)).toMatchObject({ journey: 1, goalReached: true });
  });

  it("all learner-facing sentences are free of internal or negative wording", () => {
    for (const wpm of [60, 100, 150, 278]) {
      const v = bookGoalView(wpm, 60);
      for (const t of [v.nowText, v.goalText, v.savedText ?? ""]) expect(learnerLanguageViolations(t)).toEqual([]);
    }
  });

  it("rejects non-positive speeds", () => {
    expect(() => bookGoalView(0, 100)).toThrow(RangeError);
    expect(() => bookGoalView(100, -1)).toThrow(RangeError);
  });
});
