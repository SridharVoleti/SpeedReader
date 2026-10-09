// APP-DATA-005 / APP-DATA-006 - Progression decision ledger, independent of raw attempts.
//
// Every Level Up / HOLD / deferred Level Up is a first-class record with its own id, the evidence ids it was
// decided from, a machine reason code, before/after WPM, rule versions and timestamp. The ledger is derived by
// replaying the immutable attempt ledger with the same state machine as live progression (explainability.ts), so a
// stored decision that disagrees with the replay is detectable. Codes are internal and never shown to learners.

import type { AttemptRecord, RuleVersions } from "./attempt-record";
import { explainFromLedger, type DecisionExplanation } from "./explainability";
import { progressionEvidence } from "./attempt-types";

export type DecisionType = "LEVEL_UP" | "HOLD" | "LEVEL_UP_DEFERRED";

export type DecisionRecord = Readonly<{
  decisionId: string;
  learnerId: string;
  decisionType: DecisionType;
  /** Internal reason code, e.g. `LEVEL_UP: first_five_green_count=4/5`. */
  reasonCode: string;
  /** Attempt ids of the NEW_PROGRESSION evidence this decision was made from, oldest first. */
  inputEvidenceIds: readonly string[];
  wpmBefore: number;
  wpmAfter: number;
  ruleVersions: RuleVersions;
  decidedAt: string;
}>;

const isDecision = (e: DecisionExplanation): e is DecisionExplanation & { decision: DecisionType } =>
  e.decision === "LEVEL_UP" || e.decision === "HOLD" || e.decision === "LEVEL_UP_DEFERRED";

/** Derive the decision ledger from the immutable attempt ledger alone (no chat history, no live state). */
export function deriveDecisionLedger(ledger: readonly AttemptRecord[], startingWpm: number, startPointer = 1): readonly DecisionRecord[] {
  const replay = explainFromLedger(ledger, startingWpm, startPointer);
  const byId = new Map(ledger.map((r) => [r.attemptId, r]));
  const decisions: DecisionRecord[] = [];
  let window: string[] = []; // evidence since the last WPM change
  let wpm = startingWpm;

  for (const e of replay.explanations) {
    const record = byId.get(e.attemptId)!;
    if (progressionEvidence([record]).length && record.classification !== null) window.push(e.attemptId);
    if (!isDecision(e)) continue;
    decisions.push(
      Object.freeze({
        decisionId: `DEC-${e.attemptId}`,
        learnerId: record.learnerId,
        decisionType: e.decision,
        reasonCode: e.reason,
        inputEvidenceIds: Object.freeze([...window]),
        wpmBefore: wpm,
        wpmAfter: e.wpmAfter,
        ruleVersions: record.ruleVersions,
        decidedAt: record.completedAt
      })
    );
    wpm = e.wpmAfter;
    if (e.decision === "LEVEL_UP" || e.decision === "LEVEL_UP_DEFERRED") window = []; // a new evidence window opens at the new state
  }
  return Object.freeze(decisions);
}

/** A persisted decision must reference real evidence and agree with the replay (APP-DATA-006). */
export function verifyDecisionLedger(stored: readonly DecisionRecord[], ledger: readonly AttemptRecord[], startingWpm: number): string[] {
  const errors: string[] = [];
  const known = new Set(ledger.map((r) => r.attemptId));
  for (const d of stored) {
    if (!d.decisionId || !d.reasonCode) errors.push(`${d.decisionId || "(no id)"}: decisionId and reasonCode are required`);
    if (d.inputEvidenceIds.length === 0) errors.push(`${d.decisionId}: a decision needs input evidence`);
    for (const id of d.inputEvidenceIds) if (!known.has(id)) errors.push(`${d.decisionId}: unknown evidence ${id}`);
    if (d.wpmAfter < d.wpmBefore) errors.push(`${d.decisionId}: WPM can never decrease`);
  }
  const replayed = deriveDecisionLedger(ledger, startingWpm);
  if (replayed.length !== stored.length) errors.push(`stored ${stored.length} decisions but the evidence replays to ${replayed.length}`);
  replayed.forEach((r, i) => {
    const s = stored[i];
    if (s && (s.decisionId !== r.decisionId || s.decisionType !== r.decisionType || s.reasonCode !== r.reasonCode || s.wpmAfter !== r.wpmAfter)) {
      errors.push(`${s.decisionId}: stored decision disagrees with the replay (${r.decisionType} ${r.reasonCode})`);
    }
  });
  return errors;
}
