// Phase-A INFRASTRUCTURE demonstration (pilot/PILOT_PLAN.md): proves the factory on 5 representative Band A rows.
// Every "Cowork" result below is SIMULATED by this script - synthetic JSON that exists only to drive the state
// machine. Nothing here is passage content, and none of it is ever written to the production pipeline folders: the
// demo uses its own root. No model is called.

import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { PipelineEngine, ImportRejected, type ImportOutcome, type JobRow } from "./engine";
import { resolveConfig, type PipelineConfig } from "./config";
import { PHASE_A } from "./cli";
import { roleLabel } from "./packets";

export const DEMO_ACKNOWLEDGED_GAPS = ["G-R4-MEANING-UNITS", "G-R5-BPC", "G-R6-SEMANTIC-MAP", "G-R8-FINAL-SCHEMA", "G-R8-REFERENTIAL-RULES"];
const SIM = "INFRASTRUCTURE_DEMO_SIMULATED_NOT_CONTENT";

export type DemoReport = {
  disclaimer: string;
  canonical: { id: string; version: string; hash: string; freeze: string };
  passages: { id: string; coordinate: string; finalState: Record<number, string> }[];
  jobs: { total: number; byType: Record<string, number> };
  qaSimulations: number;
  touchbacks: number;
  invalidations: number;
  escalations: { passage: string; role: number; reason: string; resolved: boolean }[];
  staleRejections: number;
  machineRejections: number;
  restarts: number;
  scenarios: { passage: string; name: string; result: string }[];
  caveats: string[];
};

const hundred = (v: string) => Array.from({ length: 100 }, (_, i) => `${v}${i + 1}`).join(" ");

function simArtifact(role: number, passage: string, v = "a", over: Record<string, unknown> = {}): Record<string, unknown> {
  const base = { passage_id: passage, variant: v, _simulated: SIM };
  switch (role) {
    case 2: return { ...base, title: `SIM title ${v}`, body: hundred(`sim${v}`), ...over };
    case 3: return { ...base, items: [{ itemId: "Q1" }, { itemId: "Q2" }], ...over };
    case 4: return { ...base, units: [{ muId: "M1", text: `sim unit ${v}` }], ...over };
    case 5: return { ...base, text: `sim bpc ${v}`, ...over };
    case 6: return { ...base, primaryItemId: "Q1", maps: [{ item: "Q1", mu: "M1" }], ...over };
    default: throw new Error(`no simulated artifact for role ${role}`);
  }
}

const defect = (passage: string, owner: number | string, detectedBy: number, rule: string, actual: string, src?: { id: string; hash: string }) => ({
  violated_rule_id: rule, expected: "per canonical rule", actual, evidence_locator: "simulated", severity: "BLOCKER", owner_role: String(owner), source_role: String(owner),
  source_artifact_id: src?.id ?? `${passage}:r${owner}`, source_hash: src?.hash ?? null, production_unit_id: passage, detected_by_role: roleLabel(detectedBy)
});

export async function runPhaseADemo(opts: { canonicalDir: string; root: string; architectureDir: string; log?: (s: string) => void }): Promise<DemoReport> {
  const log = opts.log ?? (() => undefined);
  rmSync(opts.root, { recursive: true, force: true });
  mkdirSync(opts.root, { recursive: true });
  const rulesPath = join(opts.root, "demo-referential-rules.json");
  writeFileSync(rulesPath, JSON.stringify([{ id: "primary-item-exists", from: { section: "scoring", path: "$.primaryItemId" }, to: { section: "assessment", path: "$.items[*].itemId" } }]));
  const cfg: PipelineConfig = resolveConfig({
    root: opts.root, canonicalDir: opts.canonicalDir, architectureDir: opts.architectureDir, requireFrozenCanonical: false,
    acknowledgedGaps: DEMO_ACKNOWLEDGED_GAPS, allowInterimEnvelopeSchema: true, referentialRulesPath: rulesPath
  });
  let eng = PipelineEngine.open(cfg);
  let run = 0;
  const stats = { qa: 0, stale: 0, machine: 0, restarts: 0 };
  const scenarios: DemoReport["scenarios"] = [];
  const note = (passage: string, name: string, result: string) => { scenarios.push({ passage, name, result }); log(`  [${passage}] ${name}: ${result}`); };
  const restart = () => { eng.close(); eng = PipelineEngine.open(cfg); stats.restarts++; };

  const creator = (passage: string, role: number, artifact: Record<string, unknown> | null, o: { state?: string; defects?: unknown[]; job?: JobRow } = {}): ImportOutcome => {
    const job = o.job ?? eng.listJobs({ passage, role, type: "CREATOR", state: "READY" })[0];
    if (!job) throw new Error(`demo: no READY creator job for ${passage} role ${role}`);
    if (job.state === "READY") eng.exportJob(job.job_id);
    const state = o.state ?? "READY_FOR_INDEPENDENT_QA";
    return eng.importResult(job.job_id, { job_id: job.job_id, production_unit_id: passage, role_id: roleLabel(role), job_type: "CREATOR", state, artifact: state === "READY_FOR_INDEPENDENT_QA" ? artifact : null, checks_run: [{ check: "simulated self-check" }], blocking_defects: o.defects ?? [], nonblocking_observations: [], notes: SIM }, { runRef: `sim-creator-${++run}` });
  };
  const qa = (qaJobId: number, verdict: "QA_PASS" | "QA_FAIL", defects: unknown[] = []): ImportOutcome => {
    const job = eng.getJob(qaJobId);
    if (job.state === "READY") eng.exportJob(qaJobId);
    const packet = JSON.parse(readFileSync(eng.getJob(qaJobId).packet_path!, "utf8"));
    stats.qa++;
    return eng.importResult(qaJobId, { job_id: qaJobId, production_unit_id: job.passage_id, role_id: roleLabel(job.role_id), job_type: "QA", state: verdict, artifact: null, candidate_hash: packet.candidate_artifact.content_hash, checks_run: [{ check: "simulated review" }], blocking_defects: defects, nonblocking_observations: [], notes: SIM }, { runRef: `sim-qa-${++run}` });
  };
  const approve = (passage: string, role: number, v = "a", over: Record<string, unknown> = {}) => {
    const c = creator(passage, role, simArtifact(role, passage, v, over));
    if (c.status !== "READY_FOR_INDEPENDENT_QA") throw new Error(`demo: ${passage} role ${role} creator gave ${c.status}`);
    const q = qa(c.qaJobId!, "QA_PASS");
    if (q.status !== "APPROVED") throw new Error(`demo: ${passage} role ${role} QA gave ${q.status}`);
    return q.contentHash!;
  };
  const approvedArtifact = (passage: string, role: number) => eng.artifacts(passage, role).find((a) => a.status === "APPROVED")!;

  log("registering the 5 Phase-A rows");
  eng.registerUnits(PHASE_A);
  eng.resume();
  const [A, B, C, D, E] = PHASE_A;

  // A - happy path
  for (const r of [2, 3, 4, 5, 6]) { approve(A, r); eng.resume(); }
  note(A, "happy path Roles 1-8", `Role 8 ${eng.item(A, 8).state}`);

  // B - Role 6 QA finds a Role 4 defect -> real touchback, hash-driven invalidation, resume in order
  for (const r of [2, 3, 4, 5]) { approve(B, r); eng.resume(); }
  const r4 = approvedArtifact(B, 4);
  const c6 = creator(B, 6, simArtifact(6, B));
  const blocked = qa(c6.qaJobId!, "QA_FAIL", [defect(B, 4, 6, "MU-FIDELITY", "meaning unit M1 does not match the passage", { id: r4.artifact_id, hash: r4.content_hash })]);
  note(B, "Role 6 QA reports Role 4 defect", `Role 6 ${eng.item(B, 6).state}, Role 4 ${eng.item(B, 4).state}, outcome ${blocked.status}`);
  const fix = creator(B, 4, simArtifact(4, B, "fixed"));
  qa(fix.qaJobId!, "QA_PASS");
  note(B, "corrected Role 4 re-approved by fresh QA", `Role 5 ${eng.item(B, 5).state} (was invalidated), Role 3 ${eng.item(B, 3).state} (preserved), Role 6 ${eng.item(B, 6).state}`);
  eng.resume();
  approve(B, 5, "rebuilt"); approve(B, 6, "rerun"); eng.resume();
  note(B, "descendants rebuilt in dependency order", `Role 8 ${eng.item(B, 8).state}`);

  // C - machine rejection, then QA failures -> retry limit escalation
  const short = { ...simArtifact(2, C), body: hundred("short").split(" ").slice(0, 99).join(" ") };
  const m = creator(C, 2, short);
  stats.machine += m.status === "MACHINE_REJECTED" ? 1 : 0;
  note(C, "99-token body", `${m.status} (COUNT-100 decided by code)`);
  let c = creator(C, 2, simArtifact(2, C, "b"));
  qa(c.qaJobId!, "QA_FAIL", [defect(C, 2, 2, "PG4", "controlled stretch vocabulary exceeded")]);
  c = creator(C, 2, simArtifact(2, C, "c"));
  const last = qa(c.qaJobId!, "QA_FAIL", [defect(C, 2, 2, "PG7", "duplicate pattern with a neighbouring passage")]);
  note(C, "three failed creator attempts", `${last.status}; attempts used ${eng.item(C, 2).failed_attempts}`);

  // D - the same blocker twice -> early escalation, then a human decision
  c = creator(D, 2, simArtifact(2, D, "a"));
  qa(c.qaJobId!, "QA_FAIL", [defect(D, 2, 2, "PG1", "premise changed")]);
  c = creator(D, 2, simArtifact(2, D, "b"));
  const rep = qa(c.qaJobId!, "QA_FAIL", [defect(D, 2, 2, "PG1", "Premise changed")]);
  note(D, "same blocker twice", `${rep.status} after ${eng.item(D, 2).failed_attempts} attempts`);
  eng.resolveEscalation(D, 2, "SIMULATED human decision for the demonstration");
  approve(D, 2, "resolved");
  note(D, "human resolved escalation", `Role 2 ${eng.item(D, 2).state}`);

  // E - restart mid-flow, stale-job rejection, and Role 8 routing a Role 6 defect without editing it
  approve(E, 2); eng.resume();
  const r3job = eng.listJobs({ passage: E, role: 3, type: "CREATOR", state: "READY" })[0];
  eng.exportJob(r3job.job_id);
  restart();
  note(E, "restart with a job out", `job ${r3job.job_id} still ${eng.getJob(r3job.job_id).state}`);
  const c4 = creator(E, 4, simArtifact(4, E));
  const r2 = approvedArtifact(E, 2);
  qa(c4.qaJobId!, "QA_FAIL", [defect(E, 2, 4, "SRC-1", "passage statement is ambiguous", { id: r2.artifact_id, hash: r2.content_hash })]);
  approve(E, 2, "rewritten");
  try {
    eng.importResult(r3job.job_id, { job_id: r3job.job_id, production_unit_id: E, role_id: "3", job_type: "CREATOR", state: "READY_FOR_INDEPENDENT_QA", artifact: simArtifact(3, E), checks_run: [], blocking_defects: [], nonblocking_observations: [] }, { runRef: "sim-late" });
  } catch (e) { if (e instanceof ImportRejected) { stats.stale++; note(E, "late result for a stale job", `rejected ${e.code}`); } else throw e; }
  eng.resume();
  for (const r of [3, 4, 5]) { approve(E, r); eng.resume(); }
  approve(E, 6, "bad-ref", { primaryItemId: "Q9" }); // QA does not notice; the machine reference check will
  eng.resume();
  note(E, "Role 8 final validation", `Role 8 ${eng.item(E, 8).state}, Role 6 ${eng.item(E, 6).state}, defects ${eng.defects({ passage: E }).filter((d) => d.detected_by_role === 8).map((d) => `${d.violated_rule_id}->owner ${d.owner_role}`).join("; ")}`);
  approve(E, 6, "fixed-ref"); eng.resume();
  note(E, "Role 6 corrected; Role 8 re-run", `Role 8 ${eng.item(E, 8).state}`);

  const events = eng.events();
  const jobs = eng.listJobs();
  const caveats = [...new Set(eng.artifacts(A, 8).flatMap((a) => JSON.parse(a.authority_caveats_json) as string[]))];
  const report: DemoReport = {
    disclaimer: "INFRASTRUCTURE DEMONSTRATION ONLY - every semantic result is SIMULATED; no passage content was produced; canonical package is an UNCERTIFIED freeze candidate; Role 8 used an interim non-canonical envelope schema.",
    canonical: { id: eng.canonical.id, version: eng.canonical.version, hash: eng.canonical.hash, freeze: eng.canonical.freeze.status },
    passages: PHASE_A.map((id) => ({ id, coordinate: eng.unit(id)!.registry_coordinate, finalState: Object.fromEntries(eng.items(id).map((i) => [i.role_id, i.state])) })),
    jobs: { total: jobs.length, byType: jobs.reduce<Record<string, number>>((acc, j) => ({ ...acc, [j.job_type]: (acc[j.job_type] ?? 0) + 1 }), {}) },
    qaSimulations: stats.qa,
    touchbacks: events.filter((e) => e.type === "TOUCHBACK").length,
    invalidations: events.filter((e) => e.type === "ARTIFACT_INVALIDATED").length,
    escalations: events.filter((e) => e.type === "ESCALATED").map((e) => ({ passage: e.passage_id!, role: e.role_id!, reason: (JSON.parse(e.detail_json) as { reason: string }).reason, resolved: events.some((x) => x.type === "ESCALATION_RESOLVED" && x.passage_id === e.passage_id && x.role_id === e.role_id) })),
    staleRejections: stats.stale,
    machineRejections: stats.machine,
    restarts: stats.restarts,
    scenarios,
    caveats
  };
  writeFileSync(join(opts.root, "demo-report.json"), JSON.stringify(report, null, 2));
  eng.close();
  return report;
}

export const demoRootExists = (root: string) => existsSync(root);
