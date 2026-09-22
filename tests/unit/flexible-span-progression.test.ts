import { describe, expect, it } from "vitest";
import { recordSpanChallengeAttempt, SpanCertificationState } from "../../lib/meaningful-chunking";

// SR-R9-002: Flexible span progression.
// "Progress from word-level to larger meaning groups using comprehension-qualified evidence."
// "Failed comprehension at larger span cannot raise certified span." (TC-R9-002-B: certified L2,
//  challenge L3, fail mandatory comprehension -> certified span remains L2.)
describe("recordSpanChallengeAttempt", () => {
  it("does not raise the certified span when comprehension at the larger challenge span fails (TC-R9-002-B)", () => {
    const state: SpanCertificationState = { certifiedSpanLevel: 2, challengeSpanLevel: null };
    const next = recordSpanChallengeAttempt(state, 3, false);

    expect(next.certifiedSpanLevel).toBe(2);
    expect(next.challengeSpanLevel).toBe(3);
  });

  it("raises the certified span to the challenge span when comprehension passes", () => {
    const state: SpanCertificationState = { certifiedSpanLevel: 2, challengeSpanLevel: null };
    const next = recordSpanChallengeAttempt(state, 3, true);

    expect(next.certifiedSpanLevel).toBe(3);
  });

  it("never lowers the certified span on a passing attempt at or below the current level", () => {
    const state: SpanCertificationState = { certifiedSpanLevel: 3, challengeSpanLevel: null };
    const next = recordSpanChallengeAttempt(state, 2, true);

    expect(next.certifiedSpanLevel).toBe(3);
  });

  it("is deterministic for identical inputs", () => {
    const state: SpanCertificationState = { certifiedSpanLevel: 2, challengeSpanLevel: null };
    expect(recordSpanChallengeAttempt(state, 3, false)).toEqual(recordSpanChallengeAttempt(state, 3, false));
  });
});
