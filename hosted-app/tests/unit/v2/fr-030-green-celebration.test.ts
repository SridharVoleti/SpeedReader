import { describe, expect, it } from "vitest";
import { completeNewPassage } from "../../../lib/v2/passage-completion";
import { scoreComprehension, structuredEvidence } from "../../../lib/v2/comprehension-score";
import { newCoreWpmState } from "../../../lib/v2/core-wpm";
import { assertNoInternalLeak } from "../../../lib/v2/learner-feedback";

/** A comprehension result whose blended score is exactly `target`, via the structured part only. */
function resultWithScore(target: number) {
  // spoken fixed at target too, so blended == target regardless of weights
  return scoreComprehension(structuredEvidence([{ itemId: "q1", score: target }]), { score: target });
}

// FR-030 - >=75% is a celebration [FROZEN]
describe("FR-030 >=75% is a celebration", () => {
  it("stores the exact internal score and classifies GREEN", () => {
    const out = completeNewPassage("a1", resultWithScore(0.75), newCoreWpmState(90));
    expect(out.record.score).toBeCloseTo(0.75, 10);
    expect(out.record.classification).toBe("GREEN");
    expect(out.record.attemptType).toBe("NEW_PROGRESSION");
    expect(out.record.calibrationVersion).toMatch(/calibration/);
  });

  it("a blend that is exactly 75% in decimal arithmetic is GREEN, not pushed under by floating-point error", () => {
    expect(0.7 * 0.75 + 0.3 * 0.75).toBeLessThan(0.75); // the raw float sum really is below 0.75
    const out = completeNewPassage("fp", scoreComprehension(structuredEvidence([{ itemId: "q1", score: 0.75 }]), { score: 0.75 }), newCoreWpmState(90));
    expect(out.record.score).toBe(0.75);
    expect(out.record.classification).toBe("GREEN");
    // and just-below stays NOT_GREEN
    const below = completeNewPassage("fp2", scoreComprehension(structuredEvidence([{ itemId: "q1", score: 0.7499 }]), { score: 0.7499 }), newCoreWpmState(90));
    expect(below.record.classification).toBe("NOT_GREEN");
  });

  it("provides positive celebration and Best Possible Comprehension to the learner", () => {
    const out = completeNewPassage("a1", resultWithScore(0.9), newCoreWpmState(90));
    expect(out.learner.celebration).toBe("SMALL");
    expect(out.learner.showBestPossibleComprehension).toBe(true);
    expect(out.learner.message.length).toBeGreaterThan(5);
  });

  it("never tells the learner the score ('you got 75%')", () => {
    const out = completeNewPassage("a1", resultWithScore(0.75), newCoreWpmState(90));
    expect(out.learner.message).not.toMatch(/75|%|got/i);
    assertNoInternalLeak(out.learner);
  });

  it("counts toward Level-Up evidence", () => {
    let core = newCoreWpmState(90);
    const events: string[] = [];
    for (let i = 0; i < 5; i += 1) {
      const out = completeNewPassage(`a${i}`, resultWithScore(0.8), core);
      expect(out.record.countedTowardEvidence).toBe(true);
      core = out.coreAfter;
      events.push(out.coreEvent);
    }
    expect(core.wpm).toBe(91);
    expect(events.at(-1)).toBe("LEVEL_UP");
  });

  it("an unscored attempt stores no score, celebrates nothing and counts nothing", () => {
    const pending = scoreComprehension(structuredEvidence([{ itemId: "q1", score: 1 }]), null);
    const out = completeNewPassage("a1", pending, newCoreWpmState(90));
    expect(out.record).toMatchObject({ score: null, classification: null, countedTowardEvidence: false });
    expect(out.coreAfter).toEqual(newCoreWpmState(90));
    expect(out.coreEvent).toBe("NONE");
  });
});
