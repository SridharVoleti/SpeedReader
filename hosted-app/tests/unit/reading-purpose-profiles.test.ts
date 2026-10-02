import { describe, expect, it } from "vitest";
import { recordModeChallengeAttempt, startModeCertificationState } from "../../lib/personal-reading-model";

// SR-R9-005: Reading-purpose profiles.
// "Support configurable normal/study/story/scan-preview-review modes without conflating
//  certified rates."
// "Evidence in one mode does not certify another unless transfer rule permits."
describe("recordModeChallengeAttempt", () => {
  it("certifying in one mode does not raise the certified rate of a different mode by default", () => {
    const state = startModeCertificationState();
    const next = recordModeChallengeAttempt(state, "study", 240, true);

    expect(next.study.certifiedWpm).toBe(240);
    expect(next.normal.certifiedWpm).toBe(0);
    expect(next.story.certifiedWpm).toBe(0);
    expect(next.scan_preview_review.certifiedWpm).toBe(0);
  });

  it("keeps every configured mode's certified rate independent - no conflation across modes", () => {
    let state = startModeCertificationState();
    state = recordModeChallengeAttempt(state, "normal", 200, true);
    state = recordModeChallengeAttempt(state, "story", 320, true);

    expect(state.normal.certifiedWpm).toBe(200);
    expect(state.story.certifiedWpm).toBe(320);
    expect(state.study.certifiedWpm).toBe(0);
  });

  it("transfers evidence to another mode only when an explicit transfer rule permits it", () => {
    const state = startModeCertificationState();
    const next = recordModeChallengeAttempt(state, "study", 240, true, [{ fromMode: "study", toMode: "normal" }]);

    expect(next.study.certifiedWpm).toBe(240);
    expect(next.normal.certifiedWpm).toBe(240);
    expect(next.story.certifiedWpm).toBe(0);
  });

  it("a non-passing attempt certifies nothing, even with a transfer rule configured", () => {
    const state = startModeCertificationState();
    const next = recordModeChallengeAttempt(state, "study", 240, false, [{ fromMode: "study", toMode: "normal" }]);

    expect(next.study.certifiedWpm).toBe(0);
    expect(next.normal.certifiedWpm).toBe(0);
  });

  it("is deterministic for identical inputs", () => {
    const state = startModeCertificationState();
    expect(recordModeChallengeAttempt(state, "study", 240, true)).toEqual(recordModeChallengeAttempt(state, "study", 240, true));
  });
});
