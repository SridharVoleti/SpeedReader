import { describe, expect, it } from "vitest";
import { ProgressStore, consistencyErrors, type CommitStep } from "../../../lib/v2/progress-store";
import { recordNewProgressionAttempt } from "../../../lib/v2/attempt-record";
import { newLearnerAggregate, type LearnerAggregate } from "../../../lib/v2/learner-aggregate";
import { scoreComprehension, structuredEvidence } from "../../../lib/v2/comprehension-score";

const scored = (s: number) => scoreComprehension(structuredEvidence([{ itemId: "q1", score: s }]), { score: s });
const step = (learner: LearnerAggregate, i: number, s = 0.9) =>
  recordNewProgressionAttempt(learner, { attemptId: `a${i}`, passageId: `P${i + 1}`, displayedWpm: learner.core.wpm, passageWords: 100, recordedAt: "2026-10-03T10:00:00Z", comprehension: scored(s) }).learner;

function learnerOneStepFromLevelUp(): LearnerAggregate {
  let l = newLearnerAggregate("l", 90);
  for (let i = 0; i < 4; i += 1) l = step(l, i);
  return l;
}

// AC-C05 - Transaction safety
describe("AC-C05 Level Up and its evidence snapshot commit atomically", () => {
  it("commits the Level Up, its evidence record and the pointer together", () => {
    const before = learnerOneStepFromLevelUp();
    const store = new ProgressStore(before);
    const after = step(before, 4);
    const r = store.commit(after);
    expect(r.ok).toBe(true);
    expect(store.snapshot.learner.core.wpm).toBe(91);
    expect(store.snapshot.learner.ledger.at(-1)?.levelUpAfter.wpm).toBe(91);
    expect(store.snapshot.learner.canonicalPointer).toBe(6);
    expect(store.snapshot.version).toBe(2);
  });

  it("a failure at ANY commit step leaves no partial state: WPM, evidence and pointer all stay as they were", () => {
    const steps: CommitStep[] = ["VALIDATE", "WRITE_EVIDENCE", "WRITE_WPM", "WRITE_POINTER"];
    for (const failing of steps) {
      const before = learnerOneStepFromLevelUp();
      const store = new ProgressStore(before);
      const r = store.commit(step(before, 4), (s) => {
        if (s === failing) throw new Error(`injected failure at ${s}`);
      });
      expect(r.ok, failing).toBe(false);
      if (!r.ok) expect(r.step).toBe(failing);
      expect(store.snapshot.learner.core.wpm, failing).toBe(90);
      expect(store.snapshot.learner.ledger, failing).toHaveLength(4);
      expect(store.snapshot.learner.canonicalPointer, failing).toBe(5);
      expect(store.snapshot.version, failing).toBe(1);
      expect(consistencyErrors(store.snapshot.learner), failing).toEqual([]);
    }
  });

  it("a retry after a failed commit succeeds and awards exactly one Level Up", () => {
    const before = learnerOneStepFromLevelUp();
    const store = new ProgressStore(before);
    const after = step(before, 4);
    store.commit(after, (s) => { if (s === "WRITE_WPM") throw new Error("boom"); });
    expect(store.commit(after).ok).toBe(true);
    expect(store.snapshot.learner.core.wpm).toBe(91);
    expect(store.snapshot.learner.ledger).toHaveLength(5);
  });

  it("rejects a commit whose WPM and evidence disagree (WPM/evidence disagreement can never be stored)", () => {
    const before = learnerOneStepFromLevelUp();
    const store = new ProgressStore(before);
    const after = step(before, 4);
    const forged: LearnerAggregate = { ...after, core: { ...after.core, wpm: 95 } };
    const r = store.commit(forged);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toMatch(/disagrees/);
    expect(store.snapshot.learner.core.wpm).toBe(90);
  });

  it("rejects a commit whose pointer disagrees with the evidence, or whose ledger does not replay to the stored state", () => {
    const before = learnerOneStepFromLevelUp();
    const store = new ProgressStore(before);
    const after = step(before, 4);
    expect(store.commit({ ...after, canonicalPointer: 99 }).ok).toBe(false);
    // two NOT_GREEN records make the window 3/5 (HOLD), so the ledger no longer replays to 91 WPM
    const tamperedLedger = after.ledger.map((r, i) => (i === 1 || i === 2 ? { ...r, classification: "NOT_GREEN" as const, comprehensionScore: 0.1 } : r));
    expect(store.commit({ ...after, ledger: tamperedLedger }).ok).toBe(false);
    expect(store.snapshot.version).toBe(1);
  });

  it("readers holding an earlier snapshot never see a half-applied commit", () => {
    const before = learnerOneStepFromLevelUp();
    const store = new ProgressStore(before);
    const held = store.snapshot;
    store.commit(step(before, 4));
    expect(held.learner.core.wpm).toBe(90);
    expect(held.learner.ledger).toHaveLength(4);
    expect(Object.isFrozen(held)).toBe(true);
  });
});
