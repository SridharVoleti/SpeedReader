import { describe, expect, it } from "vitest";
import { bestComprehensionFor, lockScoring, newBpcAttempt, submitAttempt, type BpcContent } from "../../../lib/v2/best-comprehension";

const catalog: BpcContent[] = [
  { passageId: "P001", text: "Mia lost her kite ...", qaApproved: true, version: "bpc-1" },
  { passageId: "P002", text: "Sam found ...", qaApproved: true, version: "bpc-1" },
  { passageId: "P003", text: "draft", qaApproved: false, version: "bpc-0" }
];

// FR-025 - After every passage [FROZEN]
describe("FR-025 Best Possible Comprehension after every passage", () => {
  it("is unavailable until the response is submitted and scoring is locked (AC-P16)", () => {
    const a0 = newBpcAttempt("a1", "P001");
    expect(bestComprehensionFor(a0, catalog)).toEqual({ available: false, reason: "NOT_SUBMITTED" });
    const a1 = submitAttempt(a0);
    expect(bestComprehensionFor(a1, catalog)).toEqual({ available: false, reason: "SCORING_NOT_LOCKED" });
    const a2 = lockScoring(a1, { score: 0.8, classification: "GREEN" });
    expect(bestComprehensionFor(a2, catalog)).toMatchObject({ available: true });
  });

  it("is provided for every completed passage, including NOT_GREEN and technically-unresolved ones (AC-P18)", () => {
    for (const evidence of [
      { score: 0.9, classification: "GREEN" as const },
      { score: 0.4, classification: "NOT_GREEN" as const },
      { score: null, classification: null }
    ]) {
      const locked = lockScoring(submitAttempt(newBpcAttempt("a", "P002")), evidence);
      const r = bestComprehensionFor(locked, catalog);
      expect(r.available).toBe(true);
      if (r.available) expect(r.content.passageId).toBe("P002");
    }
  });

  it("cannot contaminate the evidence: the locked attempt is immutable", () => {
    const locked = lockScoring(submitAttempt(newBpcAttempt("a1", "P001")), { score: 0.5, classification: "NOT_GREEN" });
    expect(Object.isFrozen(locked)).toBe(true);
    expect(Object.isFrozen(locked.lockedEvidence)).toBe(true);
    expect(() => {
      "use strict";
      (locked.lockedEvidence as { score: number }).score = 1;
    }).toThrow();
    expect(locked.lockedEvidence).toEqual({ score: 0.5, classification: "NOT_GREEN" });
  });

  it("enforces the lifecycle order", () => {
    const a = newBpcAttempt("a", "P001");
    expect(() => lockScoring(a, { score: 1, classification: "GREEN" })).toThrow(/after the learner submits/);
    expect(() => submitAttempt(submitAttempt(a))).toThrow(/already submitted/);
  });

  it("treats missing or unapproved BPC content as a content error, never a learner failure", () => {
    const missing = lockScoring(submitAttempt(newBpcAttempt("a", "P999")), { score: 0.9, classification: "GREEN" });
    expect(bestComprehensionFor(missing, catalog)).toEqual({ available: false, reason: "CONTENT_MISSING" });
    const draft = lockScoring(submitAttempt(newBpcAttempt("a", "P003")), { score: 0.9, classification: "GREEN" });
    expect(bestComprehensionFor(draft, catalog)).toEqual({ available: false, reason: "CONTENT_NOT_APPROVED" });
  });
});
