// Durable AssessmentStore (APP-ASSESS-005 / APP-DATA-009): one atomically replaced JSON file per learner.
import { closeSync, existsSync, fsyncSync, mkdirSync, openSync, readFileSync, renameSync, writeSync } from "node:fs";
import { join } from "node:path";
import type { AssessmentStore } from "./learner-service";

type Stored = NonNullable<ReturnType<AssessmentStore["load"]>>;

export class FileAssessmentStore implements AssessmentStore {
  constructor(private readonly root: string) {
    mkdirSync(root, { recursive: true });
  }
  private path(learnerId: string) {
    if (!learnerId) throw new Error("learnerId is required");
    return join(this.root, `${encodeURIComponent(learnerId)}.assessment.json`);
  }
  load(learnerId: string): Stored | null {
    const p = this.path(learnerId);
    return existsSync(p) ? (JSON.parse(readFileSync(p, "utf8")) as Stored) : null;
  }
  save(learnerId: string, value: Stored): void {
    const target = this.path(learnerId);
    const tmp = `${target}.tmp-${process.pid}-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    const fd = openSync(tmp, "wx");
    try { writeSync(fd, JSON.stringify(value)); fsyncSync(fd); } finally { closeSync(fd); }
    renameSync(tmp, target);
  }
}
