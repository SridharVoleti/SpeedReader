// FR-048 - Evidence separation [FROZEN]
// The system prevents accidental evidence leakage:
//   - familiar practice cannot count as new progression evidence (attempt-types.ts)
//   - News Reader cannot count as comprehension GREEN evidence (attempt-record.ts validation)
//   - post-model-answer interaction cannot retroactively improve the original passage score
//   - technical retries cannot be silently recorded as learner failures
//   - historical attempts are immutable; corrections use explicit replacement/audit records
// This module supplies the last three guards.

import type { AttemptRecord } from "./attempt-record";
import type { BpcAttempt } from "./best-comprehension";

/** Reject any attempt to change a response/score once scoring has been locked (i.e. BPC may be shown). */
export function assertResponseEditable(attempt: BpcAttempt): void {
  if (attempt.phase !== "IN_PROGRESS") {
    throw new Error("the response is closed: post-model-answer interaction cannot change the original passage score (FR-048)");
  }
}

/** Anything the learner does after seeing the model answer is recorded apart from the original attempt. */
export type PostModelAnswerInteraction = {
  attemptId: string;
  kind: "REREAD_MODEL_ANSWER" | "RETELL_AFTER_MODEL_ANSWER";
  recordedAt: string;
  /** Always false: such interactions never feed scoring or progression. */
  countsAsEvidence: false;
};

export function recordPostModelAnswerInteraction(
  interactions: readonly PostModelAnswerInteraction[],
  attemptId: string,
  kind: PostModelAnswerInteraction["kind"],
  recordedAt: string
): PostModelAnswerInteraction[] {
  return [...interactions, Object.freeze({ attemptId, kind, recordedAt, countsAsEvidence: false as const })];
}

/** A technical retry is a technical event, never a learner failure: it carries no classification. */
export function isSilentFailureRecord(record: AttemptRecord): boolean {
  const technical = record.technicalState !== "CLEAR" || record.spokenStatus === "UNRESOLVED_TECHNICAL" || record.spokenStatus === "AWAITING";
  return technical && record.classification === "NOT_GREEN";
}

export type Correction = {
  replaces: string;
  replacement: AttemptRecord;
  audit: { correctedAt: string; reason: string; correctedBy: string };
};

/** Corrections never edit history: they add an explicit replacement + audit record. */
export function correctAttempt(
  ledger: readonly AttemptRecord[],
  corrections: readonly Correction[],
  replaces: string,
  replacement: AttemptRecord,
  audit: Correction["audit"]
): Correction[] {
  if (!ledger.some((r) => r.attemptId === replaces)) throw new Error(`cannot correct unknown attempt ${replaces}`);
  if (!audit.reason || !audit.correctedBy || !audit.correctedAt) throw new Error("a correction needs correctedAt, reason and correctedBy");
  if (replacement.attemptId === replaces) throw new Error("a replacement record needs its own attempt id; the original stays untouched");
  return [...corrections, Object.freeze({ replaces, replacement, audit: Object.freeze({ ...audit }) })];
}

/** The effective view after corrections; the original ledger entries are never mutated or removed. */
export function effectiveAttempts(ledger: readonly AttemptRecord[], corrections: readonly Correction[]): AttemptRecord[] {
  const replaced = new Map(corrections.map((c) => [c.replaces, c.replacement]));
  return ledger.map((r) => replaced.get(r.attemptId) ?? r);
}
