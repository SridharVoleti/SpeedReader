import { describe, expect, it } from "vitest";
import { DECISION_RULE_VERSION, decideNextTargetWpm, SpeedDecisionInput } from "../../lib/adaptive-speed";

// SR-R4-001: Adaptive speed governor.
// "Choose next WPM deterministically from CRR, challenge and comprehension evidence."
// "Identical state/evidence yields identical next WPM and reason code."
function input(overrides: Partial<SpeedDecisionInput> = {}): SpeedDecisionInput {
  return {
    certifiedWpm: 150,
    challengeWpm: 200,
    attemptOutcome: "PASS",
    incrementWpm: 20,
    ...overrides
  };
}

describe("decideNextTargetWpm", () => {
  it("advances above the challenge WPM by the configured increment when comprehension PASSes", () => {
    const decision = decideNextTargetWpm(input({ attemptOutcome: "PASS", challengeWpm: 200, incrementWpm: 20 }));

    expect(decision.nextTargetWpm).toBe(220);
    expect(decision.reasonCode).toBe("COMPREHENSION_PASSED_ADVANCE");
  });

  it("retreats to the certified rate when comprehension HOLDs (fails)", () => {
    const decision = decideNextTargetWpm(input({ attemptOutcome: "HOLD", certifiedWpm: 150, challengeWpm: 200 }));

    expect(decision.nextTargetWpm).toBe(150);
    expect(decision.reasonCode).toBe("COMPREHENSION_FAILED_RETREAT");
  });

  it("keeps the same target WPM for a retry when the attempt was INVALID, never penalizing", () => {
    const decision = decideNextTargetWpm(input({ attemptOutcome: "INVALID", challengeWpm: 200, certifiedWpm: 150 }));

    expect(decision.nextTargetWpm).toBe(200);
    expect(decision.reasonCode).toBe("INVALID_RETRY");
  });

  it("stamps every decision with the current decision_rule_version", () => {
    expect(decideNextTargetWpm(input()).decisionRuleVersion).toBe(DECISION_RULE_VERSION);
  });

  it("is deterministic: identical state/evidence always yields the identical next WPM and reason code", () => {
    const state = input({ attemptOutcome: "PASS", certifiedWpm: 150, challengeWpm: 200, incrementWpm: 20 });
    expect(decideNextTargetWpm(state)).toEqual(decideNextTargetWpm(state));
  });

  it("different comprehension evidence for the same CRR/challenge state yields a different decision", () => {
    const base = { certifiedWpm: 150, challengeWpm: 200, incrementWpm: 20 };
    const pass = decideNextTargetWpm({ ...base, attemptOutcome: "PASS" });
    const hold = decideNextTargetWpm({ ...base, attemptOutcome: "HOLD" });

    expect(pass.nextTargetWpm).not.toBe(hold.nextTargetWpm);
    expect(pass.reasonCode).not.toBe(hold.reasonCode);
  });
});
