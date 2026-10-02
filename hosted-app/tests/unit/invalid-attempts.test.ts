import { describe, expect, it } from "vitest";
import { resolveChallengeAttempt } from "../../lib/adaptive-speed";
import { CertificationRateState } from "../../lib/certification";

// SR-R4-003: Invalid attempts do not penalize.
// "Invalid/technical/insufficient attempts shall not lower CRR or count as comprehension
//  failure." "Injected invalid attempt leaves CRR unchanged and selects retry/reassessment."
// (TC-R4-003-B: CRR=200, challenge=220, technical-invalid -> CRR stays 200; not comprehension
//  failure.)
describe("resolveChallengeAttempt", () => {
  it("leaves the CRR unchanged and selects retry - never comprehension failure - for an INVALID attempt (TC-R4-003-B)", () => {
    const crrState: CertificationRateState = { certifiedWpm: 200, challengeWpm: 220 };

    const result = resolveChallengeAttempt(crrState, "INVALID", 20);

    expect(result.crrState.certifiedWpm).toBe(200);
    expect(result.decision.reasonCode).toBe("INVALID_RETRY");
    expect(result.decision.reasonCode).not.toBe("COMPREHENSION_FAILED_RETREAT");
    expect(result.decision.nextTargetWpm).toBe(220);
  });

  it("raises the CRR and advances the next target when the attempt PASSes", () => {
    const crrState: CertificationRateState = { certifiedWpm: 200, challengeWpm: 220 };

    const result = resolveChallengeAttempt(crrState, "PASS", 20);

    expect(result.crrState.certifiedWpm).toBe(220);
    expect(result.decision.reasonCode).toBe("COMPREHENSION_PASSED_ADVANCE");
    expect(result.decision.nextTargetWpm).toBe(240);
  });

  it("leaves the CRR unchanged but retreats the next target for a genuine comprehension failure (HOLD)", () => {
    const crrState: CertificationRateState = { certifiedWpm: 200, challengeWpm: 220 };

    const result = resolveChallengeAttempt(crrState, "HOLD", 20);

    expect(result.crrState.certifiedWpm).toBe(200);
    expect(result.decision.reasonCode).toBe("COMPREHENSION_FAILED_RETREAT");
    expect(result.decision.nextTargetWpm).toBe(200);
  });

  it("never lets repeated INVALID attempts erode the CRR", () => {
    let crrState: CertificationRateState = { certifiedWpm: 200, challengeWpm: 220 };
    for (let i = 0; i < 5; i += 1) {
      crrState = resolveChallengeAttempt(crrState, "INVALID", 20).crrState;
    }
    expect(crrState.certifiedWpm).toBe(200);
  });

  it("is deterministic for identical inputs", () => {
    const crrState: CertificationRateState = { certifiedWpm: 200, challengeWpm: 220 };
    expect(resolveChallengeAttempt(crrState, "INVALID", 20)).toEqual(
      resolveChallengeAttempt(crrState, "INVALID", 20)
    );
  });
});
