import { describe, expect, it } from "vitest";
import { assertNoInternalLeak, buildLearnerFeedback, type InternalPassageResult } from "../../../lib/v2/learner-feedback";
import { learnerLanguageViolations } from "../../../lib/v2/learner-language";

const results: InternalPassageResult[] = [
  { attemptId: "a1", score: 0.75, classification: "GREEN" },
  { attemptId: "a2", score: 0.7499, classification: "NOT_GREEN" },
  { attemptId: "a3", score: 1, classification: "GREEN" },
  { attemptId: "a4", score: 0.12, classification: "NOT_GREEN" },
  { attemptId: "a5", score: null, classification: null }
];

// FR-029 - Numeric comprehension is private [FROZEN]
describe("FR-029 numeric comprehension is private", () => {
  it("exposes no score, threshold, GREEN/NOT_GREEN or PASS/FAIL in learner feedback (AC-P13)", () => {
    for (const r of results) {
      const feedback = buildLearnerFeedback(r);
      expect(Object.keys(feedback).sort()).toEqual(["celebration", "message", "showBestPossibleComprehension"]);
      const text = JSON.stringify(feedback);
      expect(text).not.toMatch(/GREEN|PASS|FAIL|75|%|threshold/i);
      expect(text).not.toContain(String(r.score ?? "null-score"));
      expect(learnerLanguageViolations(feedback.message)).toEqual([]);
      assertNoInternalLeak(feedback);
    }
  });

  it("still stores the exact score and classification internally (unchanged by feedback building)", () => {
    for (const r of results) {
      const before = JSON.stringify(r);
      buildLearnerFeedback(r);
      expect(JSON.stringify(r)).toBe(before);
    }
    expect(results[0].score).toBe(0.75);
    expect(results[0].classification).toBe("GREEN");
  });

  it("gives the same learner feedback for scores either side of the threshold apart from celebration", () => {
    const just = buildLearnerFeedback(results[0]);
    const below = buildLearnerFeedback(results[1]);
    expect(just.showBestPossibleComprehension).toBe(true);
    expect(below.showBestPossibleComprehension).toBe(true);
    expect(below.message).not.toMatch(/not|didn't|almost|close/i);
  });

  it("the leak scanner rejects internal keys and values at any depth", () => {
    expect(() => assertNoInternalLeak({ score: 0.8 })).toThrow(/score/);
    expect(() => assertNoInternalLeak({ a: { b: { classification: "GREEN" } } })).toThrow(/classification/);
    expect(() => assertNoInternalLeak({ text: "You scored 75%" })).toThrow(/leaked/);
    expect(() => assertNoInternalLeak({ text: "Result: NOT_GREEN" })).toThrow(/leaked/);
    expect(() => assertNoInternalLeak({ list: ["fine", "PASS"] })).toThrow(/leaked/);
    expect(() => assertNoInternalLeak({ text: "Great reading!", celebration: "SMALL" })).not.toThrow();
  });

  it("is deterministic per attempt", () => {
    expect(buildLearnerFeedback(results[0])).toEqual(buildLearnerFeedback(results[0]));
  });
});
