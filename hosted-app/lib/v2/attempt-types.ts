// FR-017 - Architectural rule [FROZEN]: new passages prove progress; earlier passages practise progress.
// Only NEW_PROGRESSION attempts on new canonical passages can provide Level Up evidence. Every other
// attempt type is excluded from the core WPM engine (see applyAttemptToCore).

import type { Classification } from "./comprehension-threshold";
import { newCoreWpmState, recordNewPassage, type CoreWpmEvent, type CoreWpmState } from "./core-wpm";

/** FR-047 attempt-type ontology. */
export const ATTEMPT_TYPES = ["NEW_PROGRESSION", "FAMILIAR_PRACTICE", "ASSESSMENT", "REASSESSMENT", "NEWS_READER"] as const;
export type AttemptType = (typeof ATTEMPT_TYPES)[number];

export type ScoredAttempt = {
  attemptId: string;
  attemptType: AttemptType;
  classification: Classification;
};

export function countsAsProgressionEvidence(type: AttemptType): boolean {
  return type === "NEW_PROGRESSION";
}

export function progressionEvidence<T extends { attemptType: AttemptType }>(attempts: readonly T[]): T[] {
  return attempts.filter((a) => countsAsProgressionEvidence(a.attemptType));
}

export function isAttemptType(value: unknown): value is AttemptType {
  return typeof value === "string" && (ATTEMPT_TYPES as readonly string[]).includes(value);
}

/** The only door into core WPM progression: non-NEW_PROGRESSION attempts leave state untouched. */
export function applyAttemptToCore(state: CoreWpmState, attempt: ScoredAttempt): { state: CoreWpmState; event: CoreWpmEvent | "EXCLUDED" } {
  if (!isAttemptType(attempt.attemptType)) throw new Error("attempt must have an approved attemptType");
  if (!countsAsProgressionEvidence(attempt.attemptType)) return { state, event: "EXCLUDED" };
  return recordNewPassage(state, attempt.classification);
}

export { newCoreWpmState };
