import { describe, expect, it } from "vitest";
import { NON_GATE_SIGNALS, toGateEvidence, type RawPassageAttempt } from "../../../lib/v2/gate-evidence";

const base = (score: number, extra: Record<string, unknown> = {}): RawPassageAttempt =>
  ({ attemptId: "a1", wpm: 90, comprehensionScore: score, ...extra });

// FR-012 - Comprehension is the only WPM gate [FROZEN]
describe("FR-012 comprehension is the only WPM gate", () => {
  it("lists the non-gate signals", () => {
    expect(NON_GATE_SIGNALS).toEqual(expect.arrayContaining(["oralQuality", "newsReaderScore", "pronunciation", "delivery", "intonation", "confidence"]));
  });

  it("derives the gate evidence from comprehension alone", () => {
    expect(toGateEvidence(base(0.8)).classification).toBe("GREEN");
    expect(toGateEvidence(base(0.6)).classification).toBe("NOT_GREEN");
  });

  it("is identical whatever the oral/News Reader/delivery signals say - they cannot block, reduce or delay", () => {
    for (const score of [0.4, 0.75, 0.95]) {
      const clean = toGateEvidence(base(score));
      for (const signal of NON_GATE_SIGNALS) {
        for (const value of [0, 0.5, 1, null, undefined, "bad"]) {
          expect(toGateEvidence(base(score, { [signal]: value }))).toEqual(clean);
        }
      }
    }
  });

  it("drops non-gate signals from the evidence object entirely", () => {
    const evidence = toGateEvidence(base(0.9, { oralQuality: 0, newsReaderScore: 0, pronunciation: 0 }));
    expect(Object.keys(evidence).sort()).toEqual(["attemptId", "classification", "comprehensionScore", "wpm"]);
  });

  it("rejects an out-of-range comprehension score", () => {
    expect(() => toGateEvidence(base(1.1))).toThrow(RangeError);
    expect(() => toGateEvidence(base(-0.1))).toThrow(RangeError);
  });
});
