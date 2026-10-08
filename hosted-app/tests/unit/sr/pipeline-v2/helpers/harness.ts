// Test harness: a temporary pipeline root, a synthetic canonical fixture, and a "Cowork simulator" that produces
// structured creator/QA results. It stands in for the human-run Cowork tasks - no model is involved anywhere.

import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { PipelineEngine, type ImportOutcome, type JobRow } from "../../../../../lib/sr/pipeline-v2/engine";
import { resolveConfig, findArchitectureDir, type PipelineConfig } from "../../../../../lib/sr/pipeline-v2/config";
import { buildCanonicalFixture } from "./canonical-fixture";

export const ALL_GAPS = ["G-R4-MEANING-UNITS", "G-R5-BPC", "G-R6-SEMANTIC-MAP", "G-R8-FINAL-SCHEMA", "G-R8-REFERENTIAL-RULES"];

export type Env = ReturnType<typeof makeEnv>;

export function makeEnv(over: Partial<PipelineConfig> = {}) {
  const base = mkdtempSync(join(tmpdir(), "sr-engine-"));
  const canonicalDir = join(base, "canonical");
  buildCanonicalFixture(canonicalDir);
  let tick = 0;
  const cfg = resolveConfig({
    root: join(base, "pipeline"), canonicalDir, requireFrozenCanonical: false,
    architectureDir: findArchitectureDir(join(__dirname, "..", "..", "..", "..", "..", "..")),
    acknowledgedGaps: ALL_GAPS, allowInterimEnvelopeSchema: true,
    clock: () => new Date(Date.UTC(2026, 0, 1, 0, 0, tick++)).toISOString(),
    ...over
  });
  let eng = PipelineEngine.open(cfg);
  const env = {
    base, cfg, get eng() { return eng; },
    reopen() { eng.close(); eng = PipelineEngine.open(cfg); return eng; },
    cleanup() { try { eng.close(); } catch { /* already closed */ } rmSync(base, { recursive: true, force: true, maxRetries: 3 }); }
  };
  return env;
}

let runCounter = 0;
export const nextRun = (prefix: string) => `${prefix}-${++runCounter}`;

export function hundred(variant = "a"): string {
  return Array.from({ length: 100 }, (_, i) => `${variant}w${i + 1}`).join(" ");
}

export function art(role: number, passage: string, variant = "a"): Record<string, unknown> {
  const base = { passage_id: passage, variant };
  switch (role) {
    case 2: return { ...base, title: `Title ${variant}`, body: hundred(variant) };
    case 3: return { ...base, items: [{ itemId: "Q1" }, { itemId: "Q2" }] };
    case 4: return { ...base, units: [{ muId: "M1", text: `unit ${variant}` }] };
    case 5: return { ...base, text: `bpc ${variant}` };
    case 6: return { ...base, primaryItemId: "Q1", maps: [{ item: "Q1", mu: "M1" }] };
    default: throw new Error(`no simulated artifact for role ${role}`);
  }
}

export const defectFor = (o: { passage: string; owner: string | number; detectedBy: number; rule?: string; actual?: string; sourceArtifactId?: string; sourceHash?: string }) => ({
  violated_rule_id: o.rule ?? "R-1", expected: "correct", actual: o.actual ?? "wrong", evidence_locator: "line 1",
  severity: "BLOCKER", owner_role: String(o.owner), source_role: String(o.owner), source_artifact_id: o.sourceArtifactId ?? `${o.passage}:r${o.owner}`,
  source_hash: o.sourceHash ?? null, production_unit_id: o.passage, detected_by_role: String(o.detectedBy)
});

const label = (r: number) => (r === 6 ? "6S" : String(r));

export class Cowork {
  constructor(private env: Env) {}
  private get eng() { return this.env.eng; }

  readyCreator(passage: string, role: number): JobRow {
    const j = this.eng.listJobs({ passage, role, type: "CREATOR", state: "READY" })[0];
    if (!j) throw new Error(`no READY creator job for ${passage} role ${role}; item is ${this.eng.item(passage, role).state}`);
    return j;
  }

  /** run a creator job end to end: export -> result -> import. Returns the QA job created. */
  creator(passage: string, role: number, artifact: Record<string, unknown> = art(role, passage), opts: { state?: string; defects?: unknown[]; runRef?: string; job?: JobRow } = {}): { job: JobRow; outcome: ImportOutcome } {
    const job = opts.job ?? this.readyCreator(passage, role);
    if (job.state === "READY") this.eng.exportJob(job.job_id);
    const result = {
      job_id: job.job_id, production_unit_id: passage, role_id: label(role), job_type: "CREATOR",
      state: opts.state ?? "READY_FOR_INDEPENDENT_QA", artifact: (opts.state ?? "READY_FOR_INDEPENDENT_QA") === "READY_FOR_INDEPENDENT_QA" ? artifact : null,
      checks_run: [{ check: "self", result: "ok" }], blocking_defects: opts.defects ?? [], nonblocking_observations: [], notes: "creator private reasoning must never reach QA"
    };
    return { job, outcome: this.eng.importResult(job.job_id, result, { runRef: opts.runRef ?? nextRun("creator") }) };
  }

  qa(qaJobId: number, verdict: "QA_PASS" | "QA_FAIL" | "QA_BLOCKED_NOT_EXECUTED", opts: { defects?: unknown[]; runRef?: string; candidateHash?: string | null; artifact?: unknown } = {}): ImportOutcome {
    const job = this.eng.getJob(qaJobId);
    if (job.state === "READY") this.eng.exportJob(qaJobId);
    const packet = JSON.parse(readFileSync(this.eng.getJob(qaJobId).packet_path!, "utf8"));
    const result = {
      job_id: qaJobId, production_unit_id: job.passage_id, role_id: label(job.role_id), job_type: "QA", state: verdict,
      artifact: opts.artifact ?? null,
      candidate_hash: opts.candidateHash === undefined ? packet.candidate_artifact.content_hash : opts.candidateHash,
      checks_run: [{ check: "review", result: verdict }], blocking_defects: opts.defects ?? [], nonblocking_observations: [], notes: null
    };
    return this.eng.importResult(qaJobId, result, { runRef: opts.runRef ?? nextRun("qa") });
  }

  /** creator + independent PASS for one semantic role */
  approve(passage: string, role: number, variant = "a"): string {
    const { outcome } = this.creator(passage, role, art(role, passage, variant));
    if (outcome.status !== "READY_FOR_INDEPENDENT_QA") throw new Error(`creator import for role ${role} gave ${outcome.status}`);
    const done = this.qa(outcome.qaJobId!, "QA_PASS");
    if (done.status !== "APPROVED") throw new Error(`QA for role ${role} gave ${done.status}`);
    return done.contentHash!;
  }

  /** drive deterministic roles + semantic roles up to and including `through` (semantic order 2..6) */
  approveThrough(passage: string, through: number): void {
    this.eng.resume();
    for (const r of [2, 3, 4, 5, 6]) {
      if (r > through) break;
      this.approve(passage, r);
      this.eng.resume();
    }
  }
}
