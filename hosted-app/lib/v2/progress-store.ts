// AC-C05 - Transaction safety [Codex engineering gate]
// A Level Up and its evidence snapshot are committed atomically: a partial failure can never leave the
// stored WPM and the stored evidence disagreeing. The store applies a commit as ONE replacement of an
// immutable snapshot, after verifying the invariants; a failure injected at any step leaves the previous
// snapshot untouched (rollback by construction).

import type { LearnerAggregate } from "./learner-aggregate";
import { explainFromLedger } from "./explainability";

export type CommitStep = "VALIDATE" | "WRITE_EVIDENCE" | "WRITE_WPM" | "WRITE_POINTER";

/** Fault injection hook so tests can fail a commit at any step. */
export type FaultInjector = (step: CommitStep) => void;

export type Snapshot = { readonly learner: LearnerAggregate; readonly version: number };

export type CommitResult = { ok: true; snapshot: Snapshot } | { ok: false; step: CommitStep; error: string; snapshot: Snapshot };

/** Invariant: stored WPM, canonical pointer and evidence ledger must agree with one another. */
export function consistencyErrors(learner: LearnerAggregate): string[] {
  const errors: string[] = [];
  const last = learner.ledger[learner.ledger.length - 1];
  if (last && last.levelUpAfter.wpm !== learner.core.wpm) {
    errors.push(`stored WPM ${learner.core.wpm} disagrees with the latest evidence record (${last.levelUpAfter.wpm})`);
  }
  const scored = learner.ledger.filter((r) => r.attemptType === "NEW_PROGRESSION" && r.classification !== null).length;
  if (learner.canonicalPointer !== 1 + scored) {
    errors.push(`canonical pointer ${learner.canonicalPointer} disagrees with ${scored} scored new passages`);
  }
  if (learner.ledger.length > 0) {
    const replay = explainFromLedger(learner.ledger, learner.baselineWpm);
    if (!replay.consistent || replay.finalWpm !== learner.core.wpm) errors.push("evidence ledger does not replay to the stored Level-Up state");
  }
  return errors;
}

export class ProgressStore {
  private current: Snapshot;

  constructor(initial: LearnerAggregate) {
    this.current = Object.freeze({ learner: initial, version: 1 });
  }

  get snapshot(): Snapshot {
    return this.current;
  }

  /**
   * Commit `next` as the learner's new state. All-or-nothing: the invariants are verified first, then
   * the evidence, WPM and pointer writes are applied to a staging copy and swapped in as one step.
   */
  commit(next: LearnerAggregate, inject: FaultInjector = () => undefined): CommitResult {
    const before = this.current;
    let step: CommitStep = "VALIDATE";
    try {
      inject(step);
      const errors = consistencyErrors(next);
      if (errors.length) throw new Error(errors.join("; "));
      const staged: { ledger?: LearnerAggregate["ledger"]; core?: LearnerAggregate["core"]; pointer?: number } = {};
      step = "WRITE_EVIDENCE"; inject(step); staged.ledger = next.ledger;
      step = "WRITE_WPM"; inject(step); staged.core = next.core;
      step = "WRITE_POINTER"; inject(step); staged.pointer = next.canonicalPointer;
      // single atomic swap: nothing above was visible to readers
      this.current = Object.freeze({ learner: { ...next, ledger: staged.ledger!, core: staged.core!, canonicalPointer: staged.pointer! }, version: before.version + 1 });
      return { ok: true, snapshot: this.current };
    } catch (e) {
      this.current = before; // rollback
      return { ok: false, step, error: e instanceof Error ? e.message : String(e), snapshot: this.current };
    }
  }
}
