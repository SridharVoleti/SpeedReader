import { mkdtempSync, readdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { FileLearnerRepository } from "../../../lib/v2/learner-repository";
import { recordNewProgressionAttempt } from "../../../lib/v2/attempt-record";
import { newLearnerAggregate, type LearnerAggregate } from "../../../lib/v2/learner-aggregate";
import { scoreComprehension, structuredEvidence } from "../../../lib/v2/comprehension-score";

const scored = (s: number) => scoreComprehension(structuredEvidence([{ itemId: "q1", score: s }]), { score: s });
const step = (learner: LearnerAggregate, i: number, s = 0.9) =>
  recordNewProgressionAttempt(learner, { attemptId: `a${i}`, passageId: `P${i + 1}`, displayedWpm: learner.core.wpm, passageWords: 100, recordedAt: "2026-10-03T10:00:00Z", comprehension: scored(s) }).learner;
const afterFour = () => { let l = newLearnerAggregate("kid-1", 90); for (let i = 0; i < 4; i += 1) l = step(l, i); return l; };

let dir: string;
beforeEach(() => { dir = mkdtempSync(join(tmpdir(), "sr-repo-")); });
afterEach(() => rmSync(dir, { recursive: true, force: true }));

// APP-DATA-007/008/009, APP-DB-001/002/005
describe("server-side learner repository", () => {
  it("persists across a process restart: a new repository over the same root sees the committed state (APP-DATA-009)", () => {
    const repo = new FileLearnerRepository(dir);
    repo.create(afterFour());
    const r = repo.commit("kid-1", step(afterFour(), 4), { expectedVersion: 1, idempotencyKey: "a4" });
    expect(r).toMatchObject({ ok: true, replayed: false });
    const restarted = new FileLearnerRepository(dir).load("kid-1")!;
    expect(restarted.version).toBe(2);
    expect(restarted.learner.core.wpm).toBe(91);
    expect(restarted.learner.canonicalPointer).toBe(6);
    expect(restarted.learner.ledger).toHaveLength(5);
  });

  it("a retried event replays instead of duplicating the attempt, advancement or Level Up (APP-DATA-008)", () => {
    const repo = new FileLearnerRepository(dir);
    repo.create(afterFour());
    const next = step(afterFour(), 4);
    repo.commit("kid-1", next, { expectedVersion: 1, idempotencyKey: "a4" });
    const retry = repo.commit("kid-1", next, { expectedVersion: 1, idempotencyKey: "a4" });
    expect(retry).toMatchObject({ ok: true, replayed: true });
    const s = repo.load("kid-1")!;
    expect(s.version).toBe(2);
    expect(s.learner.core.wpm).toBe(91);
    expect(s.learner.ledger).toHaveLength(5);
  });

  it("a stale writer is rejected with a version conflict and cannot overwrite (lost update)", () => {
    const repo = new FileLearnerRepository(dir);
    repo.create(afterFour());
    repo.commit("kid-1", step(afterFour(), 4), { expectedVersion: 1, idempotencyKey: "a4" });
    const stale = repo.commit("kid-1", step(afterFour(), 4, 0.5), { expectedVersion: 1, idempotencyKey: "other" });
    expect(stale).toMatchObject({ ok: false, reason: "VERSION_CONFLICT" });
    expect(repo.load("kid-1")!.learner.core.wpm).toBe(91);
  });

  it("a failure during the write leaves the previous state untouched and no temp litter; a retry then succeeds (APP-DATA-007)", () => {
    for (const stage of ["BEFORE_WRITE", "AFTER_TEMP_WRITE"] as const) {
      const d = mkdtempSync(join(tmpdir(), "sr-repo-f-"));
      try {
        let armed = false;
        const repo = new FileLearnerRepository(d, (s) => { if (armed && s === stage) throw new Error(`boom ${s}`); });
        repo.create(afterFour());
        armed = true;
        const failed = repo.commit("kid-1", step(afterFour(), 4), { expectedVersion: 1, idempotencyKey: "a4" });
        expect(failed, stage).toMatchObject({ ok: false, reason: "WRITE_FAILED" });
        const s = repo.load("kid-1")!;
        expect([s.version, s.learner.core.wpm, s.learner.ledger.length, s.learner.canonicalPointer], stage).toEqual([1, 90, 4, 5]);
        expect(readdirSync(d).filter((f) => f.includes(".tmp-") || f.endsWith(".lock")), stage).toEqual([]);
        armed = false;
        expect(repo.commit("kid-1", step(afterFour(), 4), { expectedVersion: 1, idempotencyKey: "a4" }), stage).toMatchObject({ ok: true, replayed: false });
        expect(repo.load("kid-1")!.learner.core.wpm, stage).toBe(91);
      } finally { rmSync(d, { recursive: true, force: true }); }
    }
  });

  it("refuses WPM/evidence disagreement and a mismatched learner id", () => {
    const repo = new FileLearnerRepository(dir);
    repo.create(afterFour());
    const good = step(afterFour(), 4);
    const bad = { ...good, core: { ...good.core, wpm: 120 } };
    expect(repo.commit("kid-1", bad, { expectedVersion: 1, idempotencyKey: "x" })).toMatchObject({ ok: false, reason: "INVARIANT_VIOLATION" });
    const other = { ...good, learnerId: "someone-else" };
    expect(repo.commit("kid-1", other, { expectedVersion: 1, idempotencyKey: "y" })).toMatchObject({ ok: false, reason: "INVARIANT_VIOLATION" });
    expect(repo.load("kid-1")!.version).toBe(1);
  });

  it("unknown learners fail closed, create never overwrites, and learner state is isolated", () => {
    const repo = new FileLearnerRepository(dir);
    expect(repo.load("nobody")).toBeNull();
    expect(repo.commit("nobody", afterFour(), { expectedVersion: 1, idempotencyKey: "k" })).toMatchObject({ ok: false, reason: "UNKNOWN_LEARNER" });
    repo.create(afterFour());
    expect(() => repo.create(afterFour())).toThrow(/already exists/);
    repo.create(newLearnerAggregate("kid-2", 100));
    expect(repo.load("kid-2")!.learner.core.wpm).toBe(100);
    expect(repo.load("kid-1")!.learner.core.wpm).toBe(90);
  });

  it("path-hostile learner ids stay inside the root", () => {
    const repo = new FileLearnerRepository(dir);
    repo.create(newLearnerAggregate("../../evil", 100));
    const files = readdirSync(dir);
    expect(files).toHaveLength(1);
    expect(files[0]).not.toMatch(/[\/]/); // no separators: the file is a direct child of the root
    expect(repo.load("../../evil")!.version).toBe(1);
  });
});
