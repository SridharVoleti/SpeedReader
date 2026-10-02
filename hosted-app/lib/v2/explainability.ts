// FR-049 / AC-P28 / AC-C09 - Explainability [FROZEN]
// For every WPM Level Up or HOLD the backend can explain the decision from STORED evidence alone, with no
// chat history: the immutable attempt ledger plus the versioned rules is enough to replay every decision.
// Example reasons:
//   LEVEL_UP: first_five_green_count=4/5
//   HOLD: first_five_green_count=3/5
//   LEVEL_UP: post_five_consecutive_green=3
//   PRACTICE_ONLY: excluded_from_progression_evidence
// The replay uses the SAME state machine as live progression, so a mismatch with the stored Level-Up state
// is itself detectable (consistent=false).

import type { AttemptRecord } from "./attempt-record";
import { newCoreWpmState, recordNewPassage, type CoreWpmState } from "./core-wpm";
import { passageWords, WORLD1_LAST_PASSAGE } from "./stamina";
import { isAttemptType, progressionEvidence } from "./attempt-types";

export type DecisionExplanation = {
  attemptId: string;
  decision: "NONE" | "LEVEL_UP" | "HOLD" | "LEVEL_UP_DEFERRED" | "PRACTICE_ONLY" | "EXCLUDED" | "UNSCORED";
  reason: string;
  wpmAfter: number;
};

export type Replay = {
  explanations: DecisionExplanation[];
  finalWpm: number;
  /** True when the replayed Level-Up states agree with those stored on the records. */
  consistent: boolean;
};

function greens(state: CoreWpmState): number {
  return state.newAttempts.filter((c) => c === "GREEN").length;
}

export function explainFromLedger(ledger: readonly AttemptRecord[], startingWpm: number, startPointer = 1): Replay {
  let core = newCoreWpmState(startingWpm);
  let sequence = startPointer; // canonical pointer, advanced only by scored NEW_PROGRESSION attempts
  const explanations: DecisionExplanation[] = [];
  let consistent = true;

  for (const r of ledger) {
    if (!isAttemptType(r.attemptType)) throw new Error(`record ${r.attemptId} has no approved attemptType`);
    if (progressionEvidence([r]).length === 0) {
      explanations.push({
        attemptId: r.attemptId,
        decision: r.attemptType === "FAMILIAR_PRACTICE" ? "PRACTICE_ONLY" : "EXCLUDED",
        reason: "PRACTICE_ONLY: excluded_from_progression_evidence",
        wpmAfter: core.wpm
      });
      continue;
    }
    if (r.classification === null) {
      explanations.push({ attemptId: r.attemptId, decision: "UNSCORED", reason: `UNSCORED: technical_state=${r.technicalState}`, wpmAfter: core.wpm });
      continue;
    }
    const before = core;
    const out = recordNewPassage(core, r.classification);
    let decision: DecisionExplanation["decision"] = "NONE";
    let reason = `NONE: new_attempts_at_wpm=${out.state.newAttempts.length}`;
    core = out.state;

    if (out.event === "LEVEL_UP") {
      const afterFive = before.newAttempts.length >= 5;
      reason = afterFive
        ? `LEVEL_UP: post_five_consecutive_green=${before.postFiveStreak + 1}`
        : `LEVEL_UP: first_five_green_count=${greens({ ...before, newAttempts: [...before.newAttempts, r.classification] })}/5`;
      decision = "LEVEL_UP";
      // CODEX-04: a Level Up never lands on the passage that introduces a longer length.
      if (sequence < WORLD1_LAST_PASSAGE && passageWords(sequence + 1) > passageWords(sequence)) {
        core = { wpm: before.wpm, newAttempts: [], postFiveStreak: 0, practiceEligible: false };
        decision = "LEVEL_UP_DEFERRED";
        reason = `LEVEL_UP_DEFERRED: length_step_p${sequence + 1}_takes_precedence (${reason.slice(10)})`;
      }
    } else if (out.event === "HOLD_AFTER_FIVE") {
      decision = "HOLD";
      reason = `HOLD: first_five_green_count=${greens(out.state)}/5`;
    }
    sequence += 1;
    if (r.levelUpAfter.wpm !== core.wpm) consistent = false;
    explanations.push({ attemptId: r.attemptId, decision, reason, wpmAfter: core.wpm });
  }
  return { explanations, finalWpm: core.wpm, consistent };
}

/** The single most recent Level Up / HOLD explanation, or null if no such decision has been made. */
export function lastDecision(replay: Replay): DecisionExplanation | null {
  return [...replay.explanations].reverse().find((e) => e.decision === "LEVEL_UP" || e.decision === "HOLD" || e.decision === "LEVEL_UP_DEFERRED") ?? null;
}
