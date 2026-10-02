// FR-025 / CODEX-08 - Best Possible Comprehension (BPC): delivery gate [FROZEN]
// After the learner has submitted and scoring is complete, EVERY passage provides a BPC explanation,
// including NOT_GREEN passages. It is released only after the attempt's scoring evidence is locked, so
// it can never contaminate that passage's evidence, and nothing done after release can change the
// locked score. BPC text is pre-generated, QA-approved content (CODEX-08), never runtime-generated.

import type { Classification } from "./comprehension-threshold";

export type AttemptPhase = "IN_PROGRESS" | "SUBMITTED" | "SCORING_LOCKED";

export type BpcAttempt = {
  attemptId: string;
  passageId: string;
  phase: AttemptPhase;
  /** Present only once locked. */
  lockedEvidence: Readonly<{ score: number | null; classification: Classification | null }> | null;
};

export type BpcContent = { passageId: string; text: string; qaApproved: boolean; version: string };

export function newBpcAttempt(attemptId: string, passageId: string): BpcAttempt {
  return { attemptId, passageId, phase: "IN_PROGRESS", lockedEvidence: null };
}

export function submitAttempt(attempt: BpcAttempt): BpcAttempt {
  if (attempt.phase !== "IN_PROGRESS") throw new Error("attempt already submitted");
  return { ...attempt, phase: "SUBMITTED" };
}

/** Lock the scoring evidence. After this the attempt's evidence is immutable. */
export function lockScoring(
  attempt: BpcAttempt,
  evidence: { score: number | null; classification: Classification | null }
): BpcAttempt {
  if (attempt.phase !== "SUBMITTED") throw new Error("scoring can only be locked after the learner submits");
  return Object.freeze({
    ...attempt,
    phase: "SCORING_LOCKED" as const,
    lockedEvidence: Object.freeze({ ...evidence })
  });
}

export type BpcAvailability =
  | { available: true; content: BpcContent }
  | { available: false; reason: "NOT_SUBMITTED" | "SCORING_NOT_LOCKED" | "CONTENT_MISSING" | "CONTENT_NOT_APPROVED" };

/** BPC for a passage - never before the attempt's scoring is locked, for every classification. */
export function bestComprehensionFor(attempt: BpcAttempt, catalog: readonly BpcContent[]): BpcAvailability {
  if (attempt.phase === "IN_PROGRESS") return { available: false, reason: "NOT_SUBMITTED" };
  if (attempt.phase !== "SCORING_LOCKED") return { available: false, reason: "SCORING_NOT_LOCKED" };
  const content = catalog.find((c) => c.passageId === attempt.passageId);
  if (!content) return { available: false, reason: "CONTENT_MISSING" };
  if (!content.qaApproved) return { available: false, reason: "CONTENT_NOT_APPROVED" };
  return { available: true, content };
}
