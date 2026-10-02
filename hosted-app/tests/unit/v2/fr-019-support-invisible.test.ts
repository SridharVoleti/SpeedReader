import { describe, expect, it } from "vitest";
import { ALL_INTERNAL_STATES, assertLearnerSafe, learnerCopyFor, learnerLanguageViolations, PROHIBITED_LEARNER_TERMS } from "../../../lib/v2/learner-language";

// FR-019 - Support is invisible [FROZEN] (+ CODEX-09 learner-facing feedback contract)
describe("FR-019 support is invisible", () => {
  it("prohibits every FR-019 negative label", () => {
    for (const term of ["support mode", "remedial", "failed", "struggling", "downgraded", "moved back"]) {
      expect(PROHIBITED_LEARNER_TERMS).toContain(term);
      expect(learnerLanguageViolations(`You are ${term}.`)).toContain(term);
    }
  });

  it("also prohibits CODEX-09 labels, peer rank and numeric percentages", () => {
    expect(learnerLanguageViolations("Result: GREEN")).toContain("green");
    expect(learnerLanguageViolations("NOT_GREEN")).toContain("not_green");
    expect(learnerLanguageViolations("You did not pass. FAIL")).toEqual(expect.arrayContaining(["pass", "fail"]));
    expect(learnerLanguageViolations("failed to level up")).toContain("failed to level up");
    expect(learnerLanguageViolations("You scored 74%")).toContain("numeric percentage");
    expect(learnerLanguageViolations("Your peer rank is 3")).toContain("peer rank");
  });

  it("does not flag ordinary encouraging words that merely contain a prohibited substring", () => {
    expect(learnerLanguageViolations("Welcome back! Keep passing the time with a great story, greenhouse included.")).toEqual([]);
    expect(learnerLanguageViolations("You Levelled Up!")).toEqual([]);
  });

  it("maps every internal state to encouraging, safe learner copy that never names the state", () => {
    expect(ALL_INTERNAL_STATES.length).toBeGreaterThanOrEqual(8);
    for (const state of ALL_INTERNAL_STATES) {
      const copy = learnerCopyFor(state);
      expect(learnerLanguageViolations(copy)).toEqual([]);
      expect(copy.toLowerCase()).not.toContain(state.toLowerCase().replace(/_/g, " "));
      expect(copy.length).toBeGreaterThan(5);
    }
  });

  it("shows familiar practice as just another story (AC-P11)", () => {
    const text = learnerCopyFor("FAMILIAR_PRACTICE_ACTIVE") + learnerCopyFor("PRACTICE_ELIGIBLE") + learnerCopyFor("HOLD_AFTER_FIVE");
    expect(learnerLanguageViolations(text)).toEqual([]);
    expect(text).not.toMatch(/practice mode|support|remed|struggl|back to/i);
  });

  it("assertLearnerSafe returns safe text and throws on unsafe text", () => {
    expect(assertLearnerSafe("Great reading!")).toBe("Great reading!");
    expect(() => assertLearnerSafe("You are struggling")).toThrow(/confidence-first/);
  });
});
