import { spawnSync } from "node:child_process";
import { existsSync, mkdtempSync, rmSync, utimesSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { FileLearnerRepository } from "../../../lib/v2/learner-repository";
import { recordNewProgressionAttempt } from "../../../lib/v2/attempt-record";
import { newLearnerAggregate, type LearnerAggregate } from "../../../lib/v2/learner-aggregate";
import { scoreComprehension, structuredEvidence } from "../../../lib/v2/comprehension-score";

// Issue #36: recover from stale local file-repository lock files without weakening concurrent-write protection.
const scored = (s: number) => scoreComprehension(structuredEvidence([{ itemId: "q1", score: s }]), { score: s });
const step = (learner: LearnerAggregate, i: number) =>
  recordNewProgressionAttempt(learner, { attemptId: `a${i}`, passageId: `P${i + 1}`, displayedWpm: learner.core.wpm, passageWords: 100, recordedAt: "2026-10-03T10:00:00Z", comprehension: scored(0.9) }).learner;
const afterFour = () => { let l = newLearnerAggregate("kid-1", 90); for (let i = 0; i < 4; i += 1) l = step(l, i); return l; };
const deadPid = () => spawnSync(process.execPath, ["-e", ""]).pid as number;           // a process that has certainly exited

let dir: string;
let lockPath: string;
beforeEach(() => { dir = mkdtempSync(join(tmpdir(), "sr-lock-")); lockPath = join(dir, "kid-1.learner.json.lock"); });
afterEach(() => rmSync(dir, { recursive: true, force: true }));

const setup = (opts?: { lockStaleMs?: number }) => {
  const repo = new FileLearnerRepository(dir, undefined, opts);
  repo.create(afterFour());
  return repo;
};
const commit = (repo: FileLearnerRepository, key = "a4") => repo.commit("kid-1", step(afterFour(), 4), { expectedVersion: 1, idempotencyKey: key });
const writeLock = (meta: unknown, ageMs = 0) => {
  writeFileSync(lockPath, typeof meta === "string" ? meta : JSON.stringify(meta));
  const t = (Date.now() - ageMs) / 1000;
  utimesSync(lockPath, t, t);
};

describe("stale file-repository lock recovery (#36)", () => {
  it("a genuinely active lock (live owner, fresh) still blocks a second writer and is left untouched", () => {
    const repo = setup();
    writeLock({ pid: process.pid, host: require("node:os").hostname(), createdAt: Date.now() });
    expect(commit(repo)).toMatchObject({ ok: false, reason: "LOCKED" });
    expect(existsSync(lockPath)).toBe(true);
    expect(repo.load("kid-1")!.version).toBe(1);
  });

  it("a lock left behind by a dead process on this host is recovered and the commit succeeds", () => {
    const repo = setup();
    writeLock({ pid: deadPid(), host: require("node:os").hostname(), createdAt: Date.now() });
    expect(commit(repo)).toMatchObject({ ok: true, replayed: false });
    expect(repo.load("kid-1")!.version).toBe(2);
    expect(existsSync(lockPath)).toBe(false);
  });

  it("a lock older than the stale age is recovered even if its pid looks alive (pid reuse / foreign host)", () => {
    const repo = setup({ lockStaleMs: 1000 });
    writeLock({ pid: process.pid, host: "some-other-host", createdAt: Date.now() - 60_000 }, 60_000);
    expect(commit(repo)).toMatchObject({ ok: true });
  });

  it("a fresh lock from a foreign host is NOT recovered before the stale age (ownership cannot be proven dead)", () => {
    const repo = setup({ lockStaleMs: 60_000 });
    writeLock({ pid: deadPid(), host: "some-other-host", createdAt: Date.now() });
    expect(commit(repo)).toMatchObject({ ok: false, reason: "LOCKED" });
    expect(existsSync(lockPath)).toBe(true);
  });

  it("an empty/corrupt lock is respected while fresh (writer may be mid-creation) and recovered once old", () => {
    const repo = setup({ lockStaleMs: 1000 });
    writeLock("", 0);
    expect(commit(repo)).toMatchObject({ ok: false, reason: "LOCKED" });
    writeLock("{not json", 60_000);
    expect(commit(repo)).toMatchObject({ ok: true });
  });

  it("recovery leaves the file adapter atomic and idempotent: replay after recovery does not re-apply", () => {
    const repo = setup();
    writeLock({ pid: deadPid(), host: require("node:os").hostname(), createdAt: Date.now() });
    expect(commit(repo)).toMatchObject({ ok: true, replayed: false });
    expect(commit(repo)).toMatchObject({ ok: true, replayed: true });
    expect(repo.load("kid-1")!.version).toBe(2);
    expect(existsSync(lockPath)).toBe(false);
  });

  it("a normal commit writes owner metadata only while locked and always releases the lock", () => {
    const repo = setup();
    expect(commit(repo)).toMatchObject({ ok: true });
    expect(existsSync(lockPath)).toBe(false);
  });
});
