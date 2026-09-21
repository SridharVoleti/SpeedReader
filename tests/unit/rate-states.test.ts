import { describe, expect, it } from "vitest";
import { CertificationRateState, classifyRate, recordChallengeAttempt, RateState } from "../../lib/certification";

// SR-R2-005: Rate states.
// "Distinguish certified, training and challenge rates."
// "UI/API never labels unconfirmed challenge rate certified; challenge failure preserves CRR."
// (TC-R2-005-A)
describe("classifyRate", () => {
  const crrState: CertificationRateState = { certifiedWpm: 150, challengeWpm: null };

  it("labels the exact certified rate as certified", () => {
    expect(classifyRate(150, crrState)).toBe("certified");
  });

  it("labels any rate below the CRR as training", () => {
    expect(classifyRate(100, crrState)).toBe("training");
    expect(classifyRate(149, crrState)).toBe("training");
  });

  it("labels any rate above the CRR as challenge - never certified, unconfirmed", () => {
    expect(classifyRate(151, crrState)).toBe("challenge");
    expect(classifyRate(300, crrState)).toBe("challenge");
  });

  it("never labels an unconfirmed challenge rate as certified, however many times it's attempted", () => {
    let state = crrState;
    const labels: RateState[] = [];
    for (let i = 0; i < 5; i += 1) {
      state = recordChallengeAttempt(state, 200, false); // repeatedly fails
      labels.push(classifyRate(200, state));
    }
    expect(labels.every((label) => label === "challenge")).toBe(true);
  });

  it("a challenge failure preserves the CRR, so the certified rate's classification never moves", () => {
    const before = classifyRate(150, crrState);
    const afterFailedChallenge = recordChallengeAttempt(crrState, 250, false);

    expect(afterFailedChallenge.certifiedWpm).toBe(crrState.certifiedWpm);
    expect(classifyRate(150, afterFailedChallenge)).toBe(before);
    expect(classifyRate(150, afterFailedChallenge)).toBe("certified");
  });

  it("once a challenge genuinely certifies, that rate reclassifies from challenge to certified", () => {
    expect(classifyRate(200, crrState)).toBe("challenge");

    const afterPassedChallenge = recordChallengeAttempt(crrState, 200, true);
    expect(classifyRate(200, afterPassedChallenge)).toBe("certified");
    // The old CRR is now simply a rate the learner has already cleared - training territory.
    expect(classifyRate(150, afterPassedChallenge)).toBe("training");
  });

  it("is deterministic for identical inputs", () => {
    expect(classifyRate(200, crrState)).toBe(classifyRate(200, crrState));
  });
});
