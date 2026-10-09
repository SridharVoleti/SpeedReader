// Durable SessionPersistence on the file system: one atomically replaced JSON file per learner.
import { closeSync, existsSync, fsyncSync, mkdirSync, openSync, readFileSync, renameSync, writeSync } from "node:fs";
import { join } from "node:path";
import type { SessionPersistence, SessionRecord } from "./session-envelope";

export class FileSessionPersistence implements SessionPersistence {
  constructor(private readonly root: string) {
    mkdirSync(root, { recursive: true });
  }
  private path(learnerId: string) {
    if (!learnerId) throw new Error("learnerId is required");
    return join(this.root, `${encodeURIComponent(learnerId)}.sessions.json`);
  }
  load(learnerId: string): SessionRecord[] {
    const p = this.path(learnerId);
    return existsSync(p) ? (JSON.parse(readFileSync(p, "utf8")) as SessionRecord[]) : [];
  }
  save(learnerId: string, records: readonly SessionRecord[]): void {
    const target = this.path(learnerId);
    const tmp = `${target}.tmp-${process.pid}-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    const fd = openSync(tmp, "wx");
    try { writeSync(fd, JSON.stringify(records)); fsyncSync(fd); } finally { closeSync(fd); }
    renameSync(tmp, target);
  }
}
