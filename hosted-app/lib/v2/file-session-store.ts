// Durable SessionPersistence on the file system: one atomically replaced JSON file per learner.
import { closeSync, existsSync, fsyncSync, mkdirSync, openSync, readFileSync, renameSync, writeSync } from "node:fs";
import { join } from "node:path";
import type { SessionPersistence, SessionRecord, VersionedSessions } from "./session-envelope";

export class FileSessionPersistence implements SessionPersistence {
  constructor(private readonly root: string) {
    mkdirSync(root, { recursive: true });
  }
  private path(learnerId: string) {
    if (!learnerId) throw new Error("learnerId is required");
    return join(this.root, `${encodeURIComponent(learnerId)}.sessions.json`);
  }
  /** Files hold { version, records }; a legacy bare array reads as version 1. */
  private read(learnerId: string): VersionedSessions {
    const p = this.path(learnerId);
    if (!existsSync(p)) return { records: [], version: 0 };
    const raw = JSON.parse(readFileSync(p, "utf8")) as SessionRecord[] | VersionedSessions;
    return Array.isArray(raw) ? { records: raw, version: 1 } : raw;
  }
  load(learnerId: string): SessionRecord[] { return this.read(learnerId).records; }
  loadVersioned(learnerId: string): VersionedSessions { return this.read(learnerId); }
  save(learnerId: string, records: readonly SessionRecord[]): void { this.write(learnerId, records, this.read(learnerId).version + 1); }
  /** Synchronous read-compare-write: atomic within a process (the file store is for single-instance use). */
  saveIfVersion(learnerId: string, records: readonly SessionRecord[], expectedVersion: number): boolean {
    if (this.read(learnerId).version !== expectedVersion) return false;
    this.write(learnerId, records, expectedVersion + 1);
    return true;
  }
  private write(learnerId: string, records: readonly SessionRecord[], version: number): void {
    const target = this.path(learnerId);
    const tmp = `${target}.tmp-${process.pid}-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    const fd = openSync(tmp, "wx");
    try { writeSync(fd, JSON.stringify({ version, records })); fsyncSync(fd); } finally { closeSync(fd); }
    renameSync(tmp, target);
  }
}
