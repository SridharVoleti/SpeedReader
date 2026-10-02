// FR-018 / CODEX-05 - Familiar-passage confidence practice [FROZEN]
// When progression stalls the engine may serve passages the learner has already completed, at the
// learner's CURRENT earned WPM (never their historical WPM). These attempts are FAMILIAR_PRACTICE:
// they do not advance the 1,500-passage pointer, do not replace a new canonical passage, do not alter
// the original attempt's historical score, and never count toward first-five / three-in-a-row evidence.
// Practice analytics live in a separate namespace.

import type { Classification } from "./comprehension-threshold";
import type { CoreWpmState } from "./core-wpm";

export type CompletedPassage = {
  sequence: number;
  passageId: string;
  /** Immutable original attempt score. */
  originalScore: number;
  completedAt: string;
};

export type PracticeStrategy = "MOST_RECENT" | "HIGHEST_PRIOR_SUCCESS";

export type PracticeAssignment = {
  passageId: string;
  sequence: number;
  wpm: number;
  attemptType: "FAMILIAR_PRACTICE";
};

export type PracticeRecord = { attemptId: string; passageId: string; wpm: number; classification: Classification };

export type LearnerRecord = {
  core: CoreWpmState;
  canonicalPointer: number;
  /** Immutable original attempts keyed by passageId. */
  originalAttempts: Readonly<Record<string, { score: number }>>;
  /** Separate practice analytics namespace. */
  practiceAnalytics: PracticeRecord[];
};

/** Choose a familiar passage; null when the learner has completed nothing yet. */
export function selectFamiliarPassage(
  completed: readonly CompletedPassage[],
  currentWpm: number,
  strategy: PracticeStrategy = "MOST_RECENT"
): PracticeAssignment | null {
  if (completed.length === 0) return null;
  const pick =
    strategy === "HIGHEST_PRIOR_SUCCESS"
      ? [...completed].sort((a, b) => b.originalScore - a.originalScore || b.sequence - a.sequence)[0]
      : [...completed].sort((a, b) => b.sequence - a.sequence)[0];
  return { passageId: pick.passageId, sequence: pick.sequence, wpm: currentWpm, attemptType: "FAMILIAR_PRACTICE" };
}

/** Practice is only offered while stalled (internal state; never surfaced to the learner). */
export function shouldOfferPractice(core: CoreWpmState): boolean {
  return core.practiceEligible;
}

/**
 * Record a practice attempt. Only the practice-analytics namespace changes: the core WPM state, the
 * canonical pointer and every original attempt score are returned untouched.
 */
export function recordPracticeAttempt(record: LearnerRecord, practice: PracticeRecord): LearnerRecord {
  if (!(practice.passageId in record.originalAttempts)) {
    throw new Error("familiar practice may only use a passage the learner has already completed");
  }
  return { ...record, practiceAnalytics: [...record.practiceAnalytics, practice] };
}
