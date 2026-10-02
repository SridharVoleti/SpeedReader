import { describe, expect, it } from "vitest";
import { recordPracticeAttempt, selectFamiliarPassage, shouldOfferPractice, type CompletedPassage, type LearnerRecord } from "../../../lib/v2/familiar-practice";
import { newCoreWpmState, recordNewPassage, type CoreWpmState } from "../../../lib/v2/core-wpm";

const completed: CompletedPassage[] = [
  { sequence: 1, passageId: "P001", originalScore: 0.9, completedAt: "2026-10-01T10:00:00Z" },
  { sequence: 2, passageId: "P002", originalScore: 0.6, completedAt: "2026-10-01T10:10:00Z" },
  { sequence: 3, passageId: "P003", originalScore: 0.8, completedAt: "2026-10-01T10:20:00Z" }
];

const stalled = (): CoreWpmState => {
  let s = newCoreWpmState(90);
  for (let i = 0; i < 6; i += 1) s = recordNewPassage(s, "NOT_GREEN").state;
  return s;
};

const record = (): LearnerRecord => ({
  core: stalled(),
  canonicalPointer: 4,
  originalAttempts: { P001: { score: 0.9 }, P002: { score: 0.6 }, P003: { score: 0.8 } },
  practiceAnalytics: []
});

// FR-018 - Practice behaviour [FROZEN] (+ CODEX-05)
describe("FR-018 familiar practice behaviour", () => {
  it("offers practice only when stalled, as internal state", () => {
    expect(shouldOfferPractice(stalled())).toBe(true);
    expect(shouldOfferPractice(newCoreWpmState(90))).toBe(false);
  });

  it("serves only already-completed passages, at the CURRENT earned WPM (AC-P10)", () => {
    const a = selectFamiliarPassage(completed, 97);
    expect(a).toEqual({ passageId: "P003", sequence: 3, wpm: 97, attemptType: "FAMILIAR_PRACTICE" });
    expect(completed.some((c) => c.passageId === a!.passageId)).toBe(true);
    expect(selectFamiliarPassage(completed, 120)!.wpm).toBe(120);
  });

  it("supports a confidence-oriented strategy without breaking the rules", () => {
    const a = selectFamiliarPassage(completed, 97, "HIGHEST_PRIOR_SUCCESS")!;
    expect(a.passageId).toBe("P001");
    expect(a.wpm).toBe(97);
    expect(a.attemptType).toBe("FAMILIAR_PRACTICE");
  });

  it("returns null when the learner has completed nothing yet", () => {
    expect(selectFamiliarPassage([], 90)).toBeNull();
  });

  it("does not advance the canonical pointer, change core WPM evidence, or alter original scores", () => {
    const before = record();
    let after = before;
    for (let i = 0; i < 20; i += 1) {
      after = recordPracticeAttempt(after, { attemptId: `pr${i}`, passageId: "P002", wpm: 90, classification: "GREEN" });
    }
    expect(after.canonicalPointer).toBe(before.canonicalPointer);
    expect(after.core).toEqual(before.core);
    expect(after.originalAttempts).toEqual(before.originalAttempts);
    expect(after.originalAttempts.P002.score).toBe(0.6);
    expect(after.practiceAnalytics).toHaveLength(20);
    expect(before.practiceAnalytics).toHaveLength(0);
  });

  it("stores practice analytics separately from progression evidence", () => {
    const after = recordPracticeAttempt(record(), { attemptId: "pr1", passageId: "P001", wpm: 90, classification: "GREEN" });
    expect(after.core.newAttempts).toEqual(record().core.newAttempts);
    expect(after.practiceAnalytics[0].passageId).toBe("P001");
  });

  it("rejects practice on a passage the learner has not completed", () => {
    expect(() => recordPracticeAttempt(record(), { attemptId: "x", passageId: "P099", wpm: 90, classification: "GREEN" })).toThrow(/already completed/);
  });

  it("returns the learner naturally to new canonical passages at the same earned WPM", () => {
    const after = recordPracticeAttempt(record(), { attemptId: "pr1", passageId: "P001", wpm: 90, classification: "GREEN" });
    expect(after.core.wpm).toBe(90);
    expect(after.canonicalPointer).toBe(4);
    const next = recordNewPassage(after.core, "GREEN").state;
    expect(next.newAttempts).toHaveLength(after.core.newAttempts.length + 1);
  });
});
