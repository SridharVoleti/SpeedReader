import { describe, expect, it } from "vitest";
import { completeNewPassage } from "../../../lib/v2/passage-completion";
import { scoreComprehension, structuredEvidence } from "../../../lib/v2/comprehension-score";
import { newCoreWpmState, type CoreWpmState } from "../../../lib/v2/core-wpm";
import { assertNoInternalLeak } from "../../../lib/v2/learner-feedback";
import { learnerLanguageViolations } from "../../../lib/v2/learner-language";

const scored = (s: number) => scoreComprehension(structuredEvidence([{ itemId: "q1", score: s }]), { score: s });

// FR-031 - Below 75% remains positive [FROZEN]
describe("FR-031 below 75% remains positive", () => {
  it("stores the exact internal score and classifies NOT_GREEN", () => {
    const out = completeNewPassage("a1", scored(0.7499), newCoreWpmState(90));
    expect(out.record.score).toBeCloseTo(0.7499, 10);
    expect(out.record.classification).toBe("NOT_GREEN");
    expect(out.record.countedTowardEvidence).toBe(true);
  });

  it("shows no failure language and no score; feedback is neutral and encouraging", () => {
    for (const s of [0, 0.3, 0.6, 0.7499]) {
      const out = completeNewPassage(`a${s}`, scored(s), newCoreWpmState(90));
      expect(learnerLanguageViolations(out.learner.message)).toEqual([]);
      expect(out.learner.message).not.toMatch(/fail|wrong|incorrect|not enough|try again|bad|low/i);
      expect(out.learner.celebration).toBe("NONE");
      assertNoInternalLeak(out.learner);
      expect(JSON.stringify(out.learner)).not.toMatch(/\d/);
    }
  });

  it("still provides Best Possible Comprehension (AC-P18)", () => {
    expect(completeNewPassage("a1", scored(0.2), newCoreWpmState(90)).learner.showBestPossibleComprehension).toBe(true);
  });

  it("continues naturally per the adaptive rules: counts as evidence, never decrements, never blocks the next passage", () => {
    let core: CoreWpmState = newCoreWpmState(90);
    for (let i = 0; i < 8; i += 1) {
      const out = completeNewPassage(`a${i}`, scored(0.5), core);
      expect(out.coreAfter.wpm).toBe(90);
      core = out.coreAfter;
    }
    expect(core.newAttempts).toHaveLength(8);
    // a later run of GREENs still levels up from the same WPM
    for (let i = 0; i < 3; i += 1) core = completeNewPassage(`g${i}`, scored(0.9), core).coreAfter;
    expect(core.wpm).toBe(91);
  });

  it("an outlier NOT_GREEN inside a 4/5 window still levels up with neutral feedback throughout", () => {
    let core: CoreWpmState = newCoreWpmState(90);
    const scores = [0.9, 0.9, 0.6, 0.9, 0.9];
    let last = completeNewPassage("x0", scored(scores[0]), core);
    core = last.coreAfter;
    for (let i = 1; i < scores.length; i += 1) {
      last = completeNewPassage(`x${i}`, scored(scores[i]), core);
      core = last.coreAfter;
    }
    expect(core.wpm).toBe(91);
    expect(last.coreEvent).toBe("LEVEL_UP");
  });

  it("gives identical learner-visible shape either side of the threshold (only celebration differs)", () => {
    const green = completeNewPassage("a", scored(0.8), newCoreWpmState(90)).learner;
    const notGreen = completeNewPassage("a", scored(0.6), newCoreWpmState(90)).learner;
    expect(Object.keys(green)).toEqual(Object.keys(notGreen));
  });
});
