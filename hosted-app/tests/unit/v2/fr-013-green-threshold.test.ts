import { describe, expect, it } from "vitest";
import { GREEN_THRESHOLD, classifyComprehension, greenCount, learnerView } from "../../../lib/v2/comprehension-threshold";

// FR-013 - Passage GREEN threshold [FROZEN]
describe("FR-013 passage GREEN threshold", () => {
  it("is exactly 75%", () => expect(GREEN_THRESHOLD).toBe(0.75));

  it(">=75% is GREEN and <75% is NOT_GREEN at the boundary", () => {
    expect(classifyComprehension(0.75)).toBe("GREEN");
    expect(classifyComprehension(0.7499)).toBe("NOT_GREEN");
    expect(classifyComprehension(1)).toBe("GREEN");
    expect(classifyComprehension(0)).toBe("NOT_GREEN");
  });

  it("rejects scores outside 0..1", () => {
    expect(() => classifyComprehension(75)).toThrow(RangeError);
    expect(() => classifyComprehension(-0.01)).toThrow(RangeError);
    expect(() => classifyComprehension(Number.NaN)).toThrow(RangeError);
  });

  it("counts per passage: one very high score cannot compensate for a passage below 75%", () => {
    const scores = [1, 1, 0.74, 0.6, 0.7]; // average 0.81 would pass, but only 2 passages are GREEN
    expect(scores.reduce((a, b) => a + b) / scores.length).toBeGreaterThan(0.75);
    expect(greenCount(scores)).toBe(2);
  });

  it("never exposes the score or classification to the learner", () => {
    for (const score of [0.2, 0.74, 0.75, 1]) {
      const view = learnerView(score);
      const text = JSON.stringify(view);
      expect(text).not.toMatch(/GREEN|NOT_GREEN|PASS|FAIL|%|\d/);
      expect(Object.keys(view)).toEqual(["encouragement"]);
    }
  });
});
