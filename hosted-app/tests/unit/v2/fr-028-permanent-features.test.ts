import { describe, expect, it } from "vitest";
import { EXPRESSION_FOCUS_BY_WORLD, everyWorldHasFocus, expressionFocusFor, permanentFeaturesFor } from "../../../lib/v2/expression-by-world";
import { WORLDS } from "../../../lib/v2/worlds";

// FR-028 - Permanent cross-World feature [FROZEN]
describe("FR-028 comprehension expression and BPC are permanent across Worlds", () => {
  it("keeps both features active in every World", () => {
    for (const w of WORLDS) {
      expect(permanentFeaturesFor(w.id)).toEqual({ comprehensionExpression: true, bestPossibleComprehension: true });
    }
    expect(everyWorldHasFocus()).toBe(true);
  });

  it("increases sophistication monotonically with content difficulty", () => {
    const levels = EXPRESSION_FOCUS_BY_WORLD.map((f) => f.sophistication);
    expect(levels).toEqual([1, 2, 3, 4, 5]);
  });

  it("World 1: connected retelling of events/ideas, reasons, feelings, consequences, key meaning", () => {
    expect(expressionFocusFor(1).expectation).toEqual(["connected-retelling-of-events-and-ideas", "reasons", "feelings", "consequences", "key-meaning"]);
  });

  it("World 2: clear explanation distinguishing important information from supporting detail", () => {
    expect(expressionFocusFor(2).expectation).toContain("important-information-vs-supporting-detail");
  });

  it("World 3: connected ideas, relationships, inference, coherent organisation", () => {
    expect(expressionFocusFor(3).expectation).toEqual(["connected-ideas", "relationships", "inference", "coherent-organisation"]);
  });

  it("World 4: arguments, viewpoints, evidence, implications, deeper meaning", () => {
    expect(expressionFocusFor(4).expectation).toEqual(["arguments", "viewpoints", "evidence", "implications", "deeper-meaning"]);
  });

  it("World 5: synthesis into a clear structured explanation in the learner's own words", () => {
    expect(expressionFocusFor(5).expectation).toEqual(["synthesis-of-complex-material", "clear-structured-explanation", "in-the-learners-own-words"]);
  });

  it("rejects an unknown World", () => {
    expect(() => expressionFocusFor(6)).toThrow();
    expect(() => permanentFeaturesFor(0)).toThrow();
  });
});
