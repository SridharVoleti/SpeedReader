import { describe, expect, it } from "vitest";
import { recordChallengeAttempt, CertificationRateState } from "../../lib/certification";
import { recordSustainedAttempt, startSustainableRate, SustainedEvidenceGates } from "../../lib/sustained-reading";

// SR-R7-002: Sustainable Reading Rate.
// "Maintain sustainable WPM separately from short-passage CRR."
// "Short CRR increase does not raise sustainable rate without its own evidence gates."
const PASSING_GATES: SustainedEvidenceGates = { durationBandMet: true, comprehensionPassed: true };
const FAILING_GATES: SustainedEvidenceGates = { durationBandMet: false, comprehensionPassed: true };

describe("recordSustainedAttempt", () => {
  it("raises the sustainable rate when a sustained attempt passes its own evidence gates", () => {
    const state = startSustainableRate();
    const next = recordSustainedAttempt(state, 240, PASSING_GATES);
    expect(next.sustainableWpm).toBe(240);
  });

  it("does not raise the sustainable rate when the duration-band gate fails", () => {
    const state = startSustainableRate();
    const next = recordSustainedAttempt(state, 240, FAILING_GATES);
    expect(next.sustainableWpm).toBe(0);
  });

  it("never lowers the sustainable rate on a weaker passing attempt", () => {
    const state = recordSustainedAttempt(startSustainableRate(), 240, PASSING_GATES);
    const next = recordSustainedAttempt(state, 180, PASSING_GATES);
    expect(next.sustainableWpm).toBe(240);
  });
});

describe("short CRR and sustainable rate maintained separately (TC-R7-002-B)", () => {
  it("a short-passage CRR increase never raises the sustainable rate on its own", () => {
    let crrState: CertificationRateState = { certifiedWpm: 240, challengeWpm: null };
    let sustainableState = recordSustainedAttempt(startSustainableRate(), 240, PASSING_GATES);

    // A short-passage challenge attempt certifies a new, higher CRR...
    crrState = recordChallengeAttempt(crrState, 300, true);

    // ...but the sustainable rate is untouched: it only moves via its own evidence gates.
    expect(crrState.certifiedWpm).toBe(300);
    expect(sustainableState.sustainableWpm).toBe(240);

    // Confirming this isn't just staleness: even after a further, unrelated non-passing
    // sustained attempt, the sustainable rate still doesn't follow the CRR.
    sustainableState = recordSustainedAttempt(sustainableState, 300, FAILING_GATES);
    expect(sustainableState.sustainableWpm).toBe(240);
    expect(crrState.certifiedWpm).toBe(300);
  });

  it("is deterministic for identical inputs", () => {
    const state = startSustainableRate();
    expect(recordSustainedAttempt(state, 240, PASSING_GATES)).toEqual(recordSustainedAttempt(state, 240, PASSING_GATES));
  });
});
