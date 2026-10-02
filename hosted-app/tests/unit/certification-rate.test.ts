import { describe, expect, it } from "vitest";
import { CertificationRateState, recordChallengeAttempt } from "../../lib/certification";

// SR-R2-001: Certified Reading Rate.
// "Maintain CRR separately from attempted/challenge WPM."
// "Attempting above CRR never changes CRR unless certification rule passes." (TC-R2-001-A)
describe("recordChallengeAttempt", () => {
  const initial: CertificationRateState = { certifiedWpm: 100, challengeWpm: null };

  it("never changes CRR when the certification rule does not pass, even for a high challenge WPM", () => {
    const next = recordChallengeAttempt(initial, 200, false);
    expect(next.certifiedWpm).toBe(100);
  });

  it("raises CRR to the challenge WPM only when the certification rule passes", () => {
    const next = recordChallengeAttempt(initial, 150, true);
    expect(next.certifiedWpm).toBe(150);
  });

  it("keeps challenge_wpm tracked separately from certified_wpm at all times", () => {
    const failed = recordChallengeAttempt(initial, 200, false);
    expect(failed.challengeWpm).toBe(200);
    expect(failed.certifiedWpm).not.toBe(failed.challengeWpm);

    const passed = recordChallengeAttempt(initial, 150, true);
    expect(passed.challengeWpm).toBe(150);
    expect(passed.certifiedWpm).toBe(passed.challengeWpm);
  });

  it("never lowers CRR even if a passing certification is recorded below the current CRR", () => {
    const highCrr: CertificationRateState = { certifiedWpm: 200, challengeWpm: null };
    const next = recordChallengeAttempt(highCrr, 150, true);
    expect(next.certifiedWpm).toBe(200);
  });

  it("is deterministic for identical inputs", () => {
    expect(recordChallengeAttempt(initial, 150, true)).toEqual(recordChallengeAttempt(initial, 150, true));
  });

  it("repeated failed challenges never accumulate into a CRR change", () => {
    let state = initial;
    for (let i = 0; i < 5; i += 1) {
      state = recordChallengeAttempt(state, 300, false);
    }
    expect(state.certifiedWpm).toBe(100);
  });
});
