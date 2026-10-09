// APP-DATA-007/008/009 / APP-DB-001..005 - Server-side learner persistence port.
//
// LearnerRepository is the only way production code may persist a learner aggregate: the progression
// update, decision ledger and evidence snapshot commit as ONE atomic replacement (APP-DATA-007), a retry
// carrying an already-applied idempotency key replays instead of re-applying (APP-DATA-008), and
// concurrent writers are serialised by optimistic versioning. Browser localStorage is never authoritative
// (APP-DATA-009). FileLearnerRepository is the durable adapter used where no database is configured;
// supabase/migrations/0001_speedreader_learner_state.sql defines the equivalent Supabase schema
// (APP-DATA-010) for a SupabaseLearnerRepository to implement against this same port.

import { closeSync, existsSync, fsyncSync, mkdirSync, openSync, readFileSync, renameSync, unlinkSync, writeSync } from "node:fs";
import { join } from "node:path";
import type { LearnerAggregate } from "./learner-aggregate";
import { consistencyErrors } from "./progress-store";

export type StoredSnapshot = { readonly learner: LearnerAggregate; readonly version: number };

export type CommitOptions = {
  /** Version the caller read; a different stored version is a lost-update conflict. */
  expectedVersion: number;
  /** Stable per logical event (attempt id / event id): replays can never double-apply. */
  idempotencyKey: string;
};

export type RepositoryCommit =
  | { ok: true; snapshot: StoredSnapshot; replayed: boolean }
  | { ok: false; reason: "UNKNOWN_LEARNER" | "VERSION_CONFLICT" | "INVARIANT_VIOLATION" | "LOCKED" | "WRITE_FAILED"; error: string; snapshot: StoredSnapshot | null };

export interface LearnerRepository {
  load(learnerId: string): StoredSnapshot | null;
  /** Create a learner's initial state (version 1). An existing learner is never overwritten. */
  create(learner: LearnerAggregate): StoredSnapshot;
  commit(learnerId: string, next: LearnerAggregate, options: CommitOptions): RepositoryCommit;
}

type Row = { version: number; learner: LearnerAggregate; applied: Record<string, number> };

/** Test seam: throw inside the commit to prove the previous state survives (rollback by construction). */
export type WriteFault = (stage: "BEFORE_WRITE" | "AFTER_TEMP_WRITE") => void;

export class FileLearnerRepository implements LearnerRepository {
  constructor(private readonly root: string, private readonly fault: WriteFault = () => undefined) {
    mkdirSync(root, { recursive: true });
  }

  private path(learnerId: string): string {
    if (!learnerId) throw new Error("learnerId is required");
    return join(this.root, `${encodeURIComponent(learnerId)}.learner.json`);
  }

  private read(learnerId: string): Row | null {
    const p = this.path(learnerId);
    return existsSync(p) ? (JSON.parse(readFileSync(p, "utf8")) as Row) : null;
  }

  private write(learnerId: string, row: Row): void {
    const target = this.path(learnerId);
    const tmp = `${target}.tmp-${process.pid}-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    this.fault("BEFORE_WRITE");
    const fd = openSync(tmp, "wx");
    try {
      writeSync(fd, JSON.stringify(row));
      fsyncSync(fd);
    } finally {
      closeSync(fd);
    }
    try {
      this.fault("AFTER_TEMP_WRITE");
      renameSync(tmp, target); // single atomic replacement: ledger + WPM + pointer land together or not at all
    } catch (e) {
      try { unlinkSync(tmp); } catch { /* temp already gone */ }
      throw e;
    }
  }

  load(learnerId: string): StoredSnapshot | null {
    const row = this.read(learnerId);
    return row ? { learner: row.learner, version: row.version } : null;
  }

  create(learner: LearnerAggregate): StoredSnapshot {
    if (this.read(learner.learnerId)) throw new Error(`learner ${learner.learnerId} already exists`);
    const errors = consistencyErrors(learner);
    if (errors.length) throw new Error(errors.join("; "));
    this.write(learner.learnerId, { version: 1, learner, applied: {} });
    return { learner, version: 1 };
  }

  commit(learnerId: string, next: LearnerAggregate, options: CommitOptions): RepositoryCommit {
    const lock = `${this.path(learnerId)}.lock`;
    let lockFd: number;
    try {
      lockFd = openSync(lock, "wx");
    } catch {
      return { ok: false, reason: "LOCKED", error: "another writer holds this learner", snapshot: this.load(learnerId) };
    }
    try {
      const row = this.read(learnerId);
      if (!row) return { ok: false, reason: "UNKNOWN_LEARNER", error: `no learner ${learnerId}`, snapshot: null };
      const current: StoredSnapshot = { learner: row.learner, version: row.version };
      if (options.idempotencyKey in row.applied) return { ok: true, snapshot: current, replayed: true };
      if (row.version !== options.expectedVersion) {
        return { ok: false, reason: "VERSION_CONFLICT", error: `expected version ${options.expectedVersion}, stored ${row.version}`, snapshot: current };
      }
      if (next.learnerId !== learnerId) {
        return { ok: false, reason: "INVARIANT_VIOLATION", error: "aggregate learnerId does not match", snapshot: current };
      }
      const errors = consistencyErrors(next);
      if (errors.length) return { ok: false, reason: "INVARIANT_VIOLATION", error: errors.join("; "), snapshot: current };
      const version = row.version + 1;
      try {
        this.write(learnerId, { version, learner: next, applied: { ...row.applied, [options.idempotencyKey]: version } });
      } catch (e) {
        return { ok: false, reason: "WRITE_FAILED", error: e instanceof Error ? e.message : String(e), snapshot: current };
      }
      return { ok: true, snapshot: { learner: next, version }, replayed: false };
    } finally {
      closeSync(lockFd);
      try { unlinkSync(lock); } catch { /* released */ }
    }
  }
}
