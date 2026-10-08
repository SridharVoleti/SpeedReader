// Orchestrator behaviour: queue eligibility, WIP isolation, QA-gated promotion, self-approval prevention, hash/stale
// checks, restart/resume, cowork packet export/import. (Routing, invalidation, retry: engine-routing.test.ts.)

import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { art, Cowork, defectFor, hundred, makeEnv, type Env } from "./helpers/harness";
import { ImportRejected, PipelineEngine } from "../../../../lib/sr/pipeline-v2/engine";
import { loadSchemas } from "../../../../lib/sr/pipeline-v2/packets";
import { canonicalHash } from "../../../../lib/sr/pipeline/hash";

let env: Env;
let cw: Cowork;
const P = "W1-0001";
beforeEach(() => { env = makeEnv(); cw = new Cowork(env); });
afterEach(() => env.cleanup());

const states = (passage = P) => Object.fromEntries(env.eng.items(passage).map((i) => [i.role_id, i.state]));
const rejected = (fn: () => unknown): string => { try { fn(); } catch (e) { if (e instanceof ImportRejected) return e.code; throw e; } return "NOT_REJECTED"; };

describe("registration and queue eligibility", () => {
  it("registering a passage creates all eight work items; only Role 1 can start", () => {
    env.eng.registerUnits([P]);
    expect(states()).toEqual({ 1: "READY", 2: "PENDING", 3: "PENDING", 4: "PENDING", 5: "PENDING", 6: "PENDING", 7: "PENDING", 8: "PENDING" });
    const unit = env.eng.unit(P)!;
    expect(unit).toMatchObject({ registry_coordinate: "RS01-P1", delivery_session: 1, canonical_package_hash: env.eng.canonical.hash });
  });

  it("registering is idempotent and rejects unknown passages (no guessing)", () => {
    env.eng.registerUnits([P]);
    expect(env.eng.registerUnits([P]).alreadyRegistered).toEqual([P]);
    expect(() => env.eng.registerUnits(["W1-9999"])).toThrow(/BLOCKED_CANONICAL_INPUT/);
  });

  it("deterministic Role 1 runs on resume and promotes through a machine certificate; Role 2 becomes READY with a creator job", () => {
    env.eng.registerUnits([P]);
    const r = env.eng.resume();
    expect(r.deterministic.map((d) => `${d.passage}:${d.role}:${d.result}`)).toEqual([`${P}:1:APPROVED`]);
    expect(states()[1]).toBe("APPROVED");
    expect(states()[2]).toBe("READY");
    const a = env.eng.artifacts(P, 1)[0];
    expect(a).toMatchObject({ status: "APPROVED", version: 1 });
    expect(env.eng.certificates(a.artifact_id)[0]).toMatchObject({ qa_kind: "MACHINE_DETERMINISTIC", verdict: "PASS", candidate_hash: a.content_hash });
    expect(existsSync(join(env.cfg.approvedRoot, "role1", P, "v1.json"))).toBe(true);
    const job = env.eng.nextJob()!;
    expect(job).toMatchObject({ role_id: 2, job_type: "CREATOR", attempt_no: 1, state: "READY" });
    expect(JSON.parse(job.input_hashes_json)).toMatchObject({ "1": a.content_hash, canonical: env.eng.canonical.hash });
  });

  it("downstream roles become eligible only from APPROVED upstream (R3 needs R1+R2, R5 needs R2+R4, R6 needs R3+R4, R7 needs R6, R8 needs R1-R7)", () => {
    env.eng.registerUnits([P]);
    env.eng.resume();
    expect(states()).toMatchObject({ 3: "PENDING", 4: "PENDING" });
    cw.approve(P, 2); env.eng.resume();
    expect(states()).toMatchObject({ 3: "READY", 4: "READY", 5: "PENDING", 6: "PENDING" });
    cw.approve(P, 3); env.eng.resume();
    expect(states()).toMatchObject({ 5: "PENDING", 6: "PENDING" });
    cw.approve(P, 4); env.eng.resume();
    expect(states()).toMatchObject({ 5: "READY", 6: "READY", 7: "PENDING" });
    cw.approve(P, 5); cw.approve(P, 6); env.eng.resume();
    expect(states()).toMatchObject({ 7: "APPROVED", 8: "FINAL_APPROVED" });
  });

  it("next picks READY semantic jobs in delivery order; there is never a QA job without a candidate", () => {
    env.eng.registerUnits(["W1-0002", P]); // W1-0002 is RS01-P2 (session 16)
    env.eng.resume();
    expect(env.eng.nextJob()).toMatchObject({ passage_id: P, role_id: 2 });
    expect(env.eng.listJobs({ type: "QA" })).toEqual([]);
  });
});

describe("WIP isolation and QA-gated approval", () => {
  beforeEach(() => { env.eng.registerUnits([P]); env.eng.resume(); });

  it("a creator result lands in WIP only; nothing is approved and downstream stays PENDING/READY-blocked", () => {
    const { outcome } = cw.creator(P, 2);
    expect(outcome.status).toBe("READY_FOR_INDEPENDENT_QA");
    expect(existsSync(join(env.cfg.wipRoot, "role2", P, "v1.json"))).toBe(true);
    expect(existsSync(join(env.cfg.approvedRoot, "role2"))).toBe(false);
    expect(states()).toMatchObject({ 2: "WIP_READY_FOR_QA", 3: "PENDING", 4: "PENDING" });
    expect(env.eng.artifacts(P, 2)[0]).toMatchObject({ status: "QA_PENDING" });
    expect(() => env.eng.store.readApproved(2, P, 1)).toThrow();
  });

  it("only an independent QA PASS with the exact candidate hash promotes the artifact to APPROVED", () => {
    const { outcome } = cw.creator(P, 2);
    const done = cw.qa(outcome.qaJobId!, "QA_PASS");
    expect(done).toMatchObject({ status: "APPROVED" });
    const a = env.eng.artifacts(P, 2)[0];
    expect(a).toMatchObject({ status: "APPROVED", qa_verdict: "PASS", content_hash: canonicalHash(art(2, P)) });
    expect(a.qa_certificate_hash).toMatch(/^[0-9a-f]{64}$/);
    expect(a.qa_run_ref).toMatch(/^qa-/);
    expect(a.creator_run_ref).toMatch(/^creator-/);
    expect(env.eng.store.readApproved(2, P, 1).hash).toBe(a.content_hash);
    expect(states()[2]).toBe("APPROVED");
    expect(env.eng.item(P, 2).approved_artifact_id).toBe(a.artifact_id);
  });

  it("QA PASS naming a different candidate hash is rejected and promotes nothing", () => {
    const { outcome } = cw.creator(P, 2);
    expect(rejected(() => cw.qa(outcome.qaJobId!, "QA_PASS", { candidateHash: "f".repeat(64) }))).toBe("CANDIDATE_HASH_MISMATCH");
    expect(rejected(() => cw.qa(outcome.qaJobId!, "QA_PASS", { candidateHash: null }))).toBe("CANDIDATE_HASH_MISMATCH");
    expect(states()[2]).toBe("WIP_READY_FOR_QA");
    expect(existsSync(join(env.cfg.approvedRoot, "role2"))).toBe(false);
  });

  it("if the WIP bytes change after the creator import, QA cannot approve them", () => {
    const { outcome } = cw.creator(P, 2);
    const wip = env.eng.store.wipPath(2, P, 1);
    const tampered = JSON.parse(readFileSync(wip, "utf8"));
    tampered.title = "tampered after review";
    writeFileSync(wip, JSON.stringify(tampered, null, 2));
    expect(rejected(() => cw.qa(outcome.qaJobId!, "QA_PASS"))).toBe("CANDIDATE_TAMPERED");
    expect(states()[2]).toBe("WIP_READY_FOR_QA");
    expect(existsSync(join(env.cfg.approvedRoot, "role2"))).toBe(false);
  });

  it("self-approval is prevented: the creator's own context cannot QA, a creator cannot return PASS, a QA job cannot return creator output", () => {
    const { job, outcome } = cw.creator(P, 2, art(2, P), { runRef: "ctx-A" });
    expect(rejected(() => cw.qa(outcome.qaJobId!, "QA_PASS", { runRef: "ctx-A" }))).toBe("SELF_APPROVAL");
    expect(rejected(() => cw.qa(outcome.qaJobId!, "QA_PASS", { runRef: "" }))).toBe("RUN_REF_REQUIRED");
    expect(states()[2]).toBe("WIP_READY_FOR_QA");
    // a QA verdict smuggled into a CREATOR job result
    const cj = env.eng.listJobs({ passage: P, role: 2, type: "CREATOR" })[0];
    expect(cj.state).toBe("DONE");
    // second passage role to test creator-with-QA_PASS on a live creator job
    env.eng.registerUnits(["W1-0002"]); env.eng.resume();
    cw.approve("W1-0002", 2);
    env.eng.resume();
    const live = env.eng.listJobs({ passage: "W1-0002", role: 3, type: "CREATOR", state: "READY" })[0];
    env.eng.exportJob(live.job_id);
    expect(rejected(() => env.eng.importResult(live.job_id, {
      job_id: live.job_id, production_unit_id: "W1-0002", role_id: "3", job_type: "CREATOR", state: "QA_PASS", artifact: art(3, "W1-0002"),
      checks_run: [], blocking_defects: [], nonblocking_observations: []
    }, { runRef: "x1" }))).toBe("WRONG_RESULT_STATE");
    expect(rejected(() => env.eng.importResult(live.job_id, {
      job_id: live.job_id, production_unit_id: "W1-0002", role_id: "3", job_type: "QA", state: "QA_PASS", artifact: null, candidate_hash: "a".repeat(64),
      checks_run: [], blocking_defects: [], nonblocking_observations: []
    }, { runRef: "x2" }))).toBe("JOB_MISMATCH");
    void job;
  });

  it("QA is read-only: a QA result that carries an artifact is rejected", () => {
    const { outcome } = cw.creator(P, 2);
    expect(rejected(() => cw.qa(outcome.qaJobId!, "QA_PASS", { artifact: art(2, P, "repaired") }))).toBe("QA_MUST_NOT_REPAIR");
  });

  it("QA_PASS may not carry blocking defects", () => {
    const { outcome } = cw.creator(P, 2);
    expect(rejected(() => cw.qa(outcome.qaJobId!, "QA_PASS", { defects: [defectFor({ passage: P, owner: 2, detectedBy: 2 })] }))).toBe("QA_PASS_WITH_BLOCKERS");
  });

  it("a QA PASS is refused while an open blocker exists against that candidate", () => {
    const { outcome } = cw.creator(P, 2);
    const a = env.eng.artifacts(P, 2)[0];
    env.eng.db.run(`INSERT INTO defects(defect_id, fingerprint, passage_id, detected_by_role, owner_role, source_artifact_id, source_hash, violated_rule_id, severity, expected, actual, evidence_locator, detail_json, status, created_at, updated_at)
      VALUES ('D-open','fp',?,8,'2',?,?, 'R','BLOCKER','e','a','l','{}','OPEN','t','t')`, P, a.artifact_id, a.content_hash);
    expect(rejected(() => cw.qa(outcome.qaJobId!, "QA_PASS"))).toBe("OPEN_BLOCKER");
  });

  it("results are single-use: replaying an imported job is rejected", () => {
    const { job } = cw.creator(P, 2);
    expect(rejected(() => env.eng.importResult(job.job_id, { job_id: job.job_id, production_unit_id: P, role_id: "2", job_type: "CREATOR", state: "READY_FOR_INDEPENDENT_QA", artifact: art(2, P, "z"), checks_run: [], blocking_defects: [], nonblocking_observations: [] }, { runRef: "again" }))).toBe("JOB_ALREADY_IMPORTED");
  });

  it("a result must match the job envelope (job id, passage, role) and validate against agent_result.schema.json", () => {
    const job = cw.readyCreator(P, 2);
    env.eng.exportJob(job.job_id);
    const ok = { job_id: job.job_id, production_unit_id: P, role_id: "2", job_type: "CREATOR", state: "READY_FOR_INDEPENDENT_QA", artifact: art(2, P), checks_run: [], blocking_defects: [], nonblocking_observations: [] };
    expect(rejected(() => env.eng.importResult(job.job_id, { ...ok, job_id: job.job_id + 99 }, { runRef: "r" }))).toBe("JOB_MISMATCH");
    expect(rejected(() => env.eng.importResult(job.job_id, { ...ok, production_unit_id: "W1-0002" }, { runRef: "r" }))).toBe("JOB_MISMATCH");
    expect(rejected(() => env.eng.importResult(job.job_id, { ...ok, role_id: "3" }, { runRef: "r" }))).toBe("JOB_MISMATCH");
    expect(rejected(() => env.eng.importResult(job.job_id, { ...ok, state: "CONDITIONAL_PASS" }, { runRef: "r" }))).toBe("INVALID_RESULT_SCHEMA");
    expect(rejected(() => env.eng.importResult(job.job_id, { ...ok, surprise: 1 }, { runRef: "r" }))).toBe("INVALID_RESULT_SCHEMA");
    expect(rejected(() => env.eng.importResult(999, ok, { runRef: "r" }))).toBe("JOB_NOT_FOUND");
    expect(rejected(() => env.eng.importResult(job.job_id, { ...ok, artifact: { ...art(2, P), passage_id: "W1-0002" } }, { runRef: "r" }))).toBe("ARTIFACT_INVALID");
    expect(rejected(() => env.eng.importResult(job.job_id, { ...ok, candidate_hash: "0".repeat(64) }, { runRef: "r" }))).toBe("CANDIDATE_HASH_MISMATCH");
    expect(env.eng.getJob(job.job_id).state).toBe("EXPORTED");
    expect(env.eng.events().filter((e) => e.type === "IMPORT_REJECTED").length).toBeGreaterThanOrEqual(8);
  });

  it("an unexported job cannot be imported", () => {
    const job = cw.readyCreator(P, 2);
    expect(rejected(() => env.eng.importResult(job.job_id, { job_id: job.job_id, production_unit_id: P, role_id: "2", job_type: "CREATOR", state: "READY_FOR_INDEPENDENT_QA", artifact: art(2, P), checks_run: [], blocking_defects: [], nonblocking_observations: [] }, { runRef: "r" }))).toBe("JOB_NOT_EXPORTED");
  });
});

describe("Cowork job packets", () => {
  beforeEach(() => { env.eng.registerUnits([P]); env.eng.resume(); });

  it("a creator packet validates against job_packet.schema.json and the prompt is self-contained", () => {
    const job = cw.readyCreator(P, 2);
    const { packet, packetPath, promptPath } = env.eng.exportJob(job.job_id);
    const schemas = loadSchemas(env.cfg.architectureDir);
    expect(schemas.validatePacket(JSON.parse(readFileSync(packetPath, "utf8")))).toEqual({ ok: true, errors: [] });
    expect(packet).toMatchObject({ job_id: job.job_id, production_unit_id: P, role_id: "2", job_type: "CREATOR", attempt_no: 1, canonical_package_hash: env.eng.canonical.hash });
    expect(packet.approved_upstream_artifacts.map((a) => a.role_id)).toEqual(["1"]);
    const prompt = readFileSync(promptPath, "utf8");
    expect(prompt).toContain("COMMON SEMANTIC AGENT CONTRACT v2.0"); // common contract, verbatim
    expect(prompt).toContain("Role 2 Creator"); // role contract
    expect(prompt).toContain(env.eng.canonical.hash);
    expect(prompt).toContain("Registry row");
    expect(prompt).toContain("Canonical passage tokenizer and exact-word-count contract"); // excerpt
    expect(prompt).toContain("agent_result"); // output schema
    expect(prompt).toMatch(/FRESH Cowork context/);
    expect(env.eng.getJob(job.job_id)).toMatchObject({ state: "EXPORTED" });
    expect(states()[2]).toBe("IN_PROGRESS");
  });

  it("the common contract is injected, not duplicated: role contract files do not repeat it", () => {
    for (const f of readdirSync(join(env.cfg.architectureDir, "contracts")).filter((n) => n.startsWith("ROLE_"))) {
      expect(readFileSync(join(env.cfg.architectureDir, "contracts", f), "utf8")).not.toContain("COMMON SEMANTIC AGENT CONTRACT");
    }
  });

  it("the packet for a role never contains unapproved WIP", () => {
    cw.creator(P, 2); // WIP candidate exists, not approved
    env.eng.registerUnits(["W1-0002"]);
    const { packet } = env.eng.exportJob(env.eng.listJobs({ passage: P, role: 2, type: "QA" })[0].job_id);
    expect(packet.approved_upstream_artifacts.map((a) => a.role_id)).toEqual(["1"]); // QA gets only approved upstream (R1) + the candidate
    expect(packet.candidate_artifact).toMatchObject({ role_id: "2", content_hash: canonicalHash(art(2, P)) });
  });

  it("the independent QA packet is generated automatically on creator import and carries NO creator reasoning", () => {
    const { outcome } = cw.creator(P, 2, art(2, P), { runRef: "creator-secret-ref" });
    expect(outcome.status).toBe("READY_FOR_INDEPENDENT_QA");
    expect(outcome.qaJobId).toBeGreaterThan(0);
    const qaPacketText = readFileSync(outcome.packetPath!, "utf8");
    const qaPrompt = readFileSync(outcome.promptPath!, "utf8");
    for (const text of [qaPacketText, qaPrompt]) {
      expect(text).not.toContain("creator private reasoning");
      expect(text).not.toContain("creator-secret-ref");
    }
    expect(qaPrompt).toMatch(/INDEPENDENT QA/);
    expect(qaPrompt).toContain("Role 2 Independent QA");
    expect(qaPrompt).toContain(canonicalHash(art(2, P)));
    expect(JSON.parse(qaPacketText)).toMatchObject({ job_type: "QA", role_id: "2" });
    expect(loadSchemas(env.cfg.architectureDir).validatePacket(JSON.parse(qaPacketText)).ok).toBe(true);
    expect(env.eng.getJob(outcome.qaJobId!)).toMatchObject({ state: "EXPORTED", job_type: "QA" });
  });

  it("Role 2 QA packets carry the COUNT-100 machine evidence computed by code", () => {
    const { outcome } = cw.creator(P, 2);
    const packet = JSON.parse(readFileSync(outcome.packetPath!, "utf8"));
    const count = packet.machine_check_evidence.find((e: { check: string }) => e.check === "COUNT-100");
    expect(count).toMatchObject({ executed: true, result: "PASS", validator: "COUNT-100-v2.0" });
    expect(count.details.token_count).toBe(100);
  });

  it("acknowledged canonical gaps travel in the packet as authority caveats", () => {
    cw.approve(P, 2); env.eng.resume();
    const job = cw.readyCreator(P, 4);
    const { promptPath } = env.eng.exportJob(job.job_id);
    const prompt = readFileSync(promptPath, "utf8");
    expect(prompt).toContain("AUTHORITY CAVEATS");
    expect(prompt).toContain("G-R4-MEANING-UNITS");
  });
});

describe("stale inputs and reopened upstream", () => {
  beforeEach(() => { env.eng.registerUnits([P]); env.eng.resume(); cw.approve(P, 2); env.eng.resume(); });

  it("import itself rejects a job whose pinned inputs changed even if reconcile has not run yet", () => {
    const job = cw.readyCreator(P, 3);
    env.eng.exportJob(job.job_id);
    // approve a different Role 2 artifact behind the engine's back (no reconcile)
    const old = env.eng.artifacts(P, 2)[0];
    env.eng.db.run(`INSERT INTO artifacts(artifact_id, passage_id, role_id, version, status, path, content_hash, input_hashes_json, created_at, updated_at) VALUES ('${P}:r2:v9', ?, 2, 9, 'APPROVED', 'p', ?, ?, 't', 't')`, P, "9".repeat(64), old.input_hashes_json);
    env.eng.db.run("UPDATE work_items SET approved_artifact_id=? WHERE passage_id=? AND role_id=2", `${P}:r2:v9`, P);
    const res = { job_id: job.job_id, production_unit_id: P, role_id: "3", job_type: "CREATOR", state: "READY_FOR_INDEPENDENT_QA", artifact: art(3, P), checks_run: [], blocking_defects: [], nonblocking_observations: [] };
    expect(rejected(() => env.eng.importResult(job.job_id, res, { runRef: "r" }))).toBe("STALE_JOB");
    expect(env.eng.getJob(job.job_id).state).toBe("STALE");
  });

  it("while an upstream role is reopened for correction, downstream roles do not start new work from its old approval", () => {
    expect(states()).toMatchObject({ 3: "READY", 4: "READY" });
    env.eng.routeExternalDefects(P, 3, [defectFor({ passage: P, owner: 2, detectedBy: 3, rule: "SRC-9", actual: "late source finding" })]);
    expect(states()[2]).toBe("READY");
    expect(states()).toMatchObject({ 3: "PENDING", 4: "PENDING" });
    expect(env.eng.listJobs({ passage: P, state: "READY" }).map((j) => j.role_id)).toEqual([2]);
  });
});

describe("Role 2 machine check (COUNT-100) gates the QA hand-off", () => {
  beforeEach(() => { env.eng.registerUnits([P]); env.eng.resume(); });

  it("a 99-token body is MACHINE_REJECTED: no QA job, the attempt is spent, a correction job carries the machine defect", () => {
    const bad = { ...art(2, P), body: hundred("a").split(" ").slice(0, 99).join(" ") };
    const { outcome } = cw.creator(P, 2, bad);
    expect(outcome.status).toBe("MACHINE_REJECTED");
    expect(env.eng.listJobs({ type: "QA" })).toEqual([]);
    expect(env.eng.artifacts(P, 2)[0]).toMatchObject({ status: "MACHINE_REJECTED", version: 1 });
    expect(existsSync(join(env.cfg.wipRoot, "role2", P, "v1.json"))).toBe(true); // history preserved
    expect(env.eng.item(P, 2)).toMatchObject({ state: "READY", failed_attempts: 1 });
    const next = env.eng.listJobs({ passage: P, role: 2, type: "CREATOR", state: "READY" })[0];
    expect(next.attempt_no).toBe(2);
    const d = env.eng.defects({ passage: P })[0];
    expect(d).toMatchObject({ owner_role: "2", detected_by_role: 2, violated_rule_id: "COUNT-100:INVALID_WORD_COUNT", severity: "BLOCKER" });
    const { promptPath } = env.eng.exportJob(next.job_id);
    expect(readFileSync(promptPath, "utf8")).toContain("COUNT-100:INVALID_WORD_COUNT");
  });

  it("101 tokens and hidden characters are rejected too; the LLM never decides the count", () => {
    expect(cw.creator(P, 2, { ...art(2, P), body: hundred("a") + " extra" }).outcome.status).toBe("MACHINE_REJECTED");
    const hidden = { ...art(2, P, "b"), body: hundred("b").replace("bw1", "b​w1") };
    expect(cw.creator(P, 2, hidden).outcome.status).toBe("MACHINE_REJECTED");
    expect(env.eng.defects({ passage: P }).map((d) => d.violated_rule_id)).toEqual(["COUNT-100:INVALID_WORD_COUNT", "COUNT-100:INVALID_COUNT_TEXT"]);
  });

  it("a passage the tokenizer counts as exactly 100 proceeds to independent QA", () => {
    expect(cw.creator(P, 2).outcome.status).toBe("READY_FOR_INDEPENDENT_QA");
  });
});

describe("restart and resume", () => {
  it("state, jobs and candidates survive closing and reopening the database mid-flow", () => {
    env.eng.registerUnits([P]); env.eng.resume();
    const job = cw.readyCreator(P, 2);
    env.eng.exportJob(job.job_id);
    const eng2 = env.reopen();
    expect(eng2.getJob(job.job_id).state).toBe("EXPORTED");
    expect(eng2.item(P, 2).state).toBe("IN_PROGRESS");
    const out = cw.creator(P, 2, art(2, P), { job: eng2.getJob(job.job_id) });
    expect(out.outcome.status).toBe("READY_FOR_INDEPENDENT_QA");
    const eng3 = env.reopen();
    expect(eng3.item(P, 2).state).toBe("WIP_READY_FOR_QA");
    const done = cw.qa(out.outcome.qaJobId!, "QA_PASS");
    expect(done.status).toBe("APPROVED");
    expect(env.reopen().item(P, 2).state).toBe("APPROVED");
    expect(env.eng.store.readApproved(2, P, 1).hash).toBe(canonicalHash(art(2, P)));
  });

  it("resume recovers interrupted file operations and does not duplicate work", () => {
    env.eng.registerUnits([P]);
    const first = env.eng.resume();
    mkdirSync(join(env.cfg.wipRoot, "role2", P), { recursive: true });
    writeFileSync(join(env.cfg.wipRoot, "role2", P, "v9.json.tmp-123-1-abc"), "partial");
    const again = env.eng.resume();
    expect(again.recovery.removedTemps).toBe(1);
    expect(again.deterministic).toEqual([]);
    expect(first.deterministic).toHaveLength(1);
    expect(env.eng.listJobs({ passage: P, role: 2, type: "CREATOR" })).toHaveLength(1);
  });

  it("retry re-issues a lost exported job without spending an attempt and invalidates the old packet", () => {
    env.eng.registerUnits([P]); env.eng.resume();
    const job = cw.readyCreator(P, 2);
    env.eng.exportJob(job.job_id);
    const fresh = env.eng.retryJob(job.job_id);
    expect(fresh).toMatchObject({ job_id: expect.any(Number), state: "READY", attempt_no: 1, role_id: 2 });
    expect(fresh.job_id).not.toBe(job.job_id);
    expect(env.eng.getJob(job.job_id).state).toBe("CANCELLED");
    expect(env.eng.item(P, 2)).toMatchObject({ state: "READY", failed_attempts: 0 });
    expect(rejected(() => env.eng.importResult(job.job_id, { job_id: job.job_id, production_unit_id: P, role_id: "2", job_type: "CREATOR", state: "READY_FOR_INDEPENDENT_QA", artifact: art(2, P), checks_run: [], blocking_defects: [], nonblocking_observations: [] }, { runRef: "r" }))).toBe("JOB_NOT_EXPORTED");
    expect(() => env.eng.retryJob(job.job_id)).toThrow(/cannot be retried/);
  });

  it("QA_BLOCKED_NOT_EXECUTED re-issues a fresh QA job and changes neither the verdict nor the attempt count", () => {
    env.eng.registerUnits([P]); env.eng.resume();
    const { outcome } = cw.creator(P, 2);
    const r = cw.qa(outcome.qaJobId!, "QA_BLOCKED_NOT_EXECUTED");
    expect(r.status).toBe("QA_NOT_EXECUTED_REISSUED");
    expect(env.eng.item(P, 2)).toMatchObject({ state: "WIP_READY_FOR_QA", failed_attempts: 0 });
    const fresh = env.eng.listJobs({ passage: P, role: 2, type: "QA", state: "EXPORTED" });
    expect(fresh).toHaveLength(1);
    expect(fresh[0].job_id).not.toBe(outcome.qaJobId);
    expect(cw.qa(fresh[0].job_id, "QA_PASS").status).toBe("APPROVED");
  });
});

describe("canonical authority", () => {
  it("a role whose canonical definition is missing fails closed as BLOCKED_CANONICAL_INPUT and names exactly what is missing", () => {
    env.cleanup();
    env = makeEnv({ acknowledgedGaps: [] });
    cw = new Cowork(env);
    env.eng.registerUnits([P]); env.eng.resume();
    cw.approve(P, 2); env.eng.resume();
    const r4 = env.eng.item(P, 4);
    expect(r4.state).toBe("ESCALATED_HUMAN_REVIEW");
    expect(r4.escalation_reason).toMatch(/BLOCKED_CANONICAL_INPUT/);
    expect(r4.escalation_reason).toMatch(/G-R4-MEANING-UNITS/);
    expect(env.eng.listJobs({ passage: P, role: 4 })).toEqual([]);
    expect(env.eng.item(P, 3).state).toBe("READY"); // roles whose canonical inputs exist still proceed
  });

  it("acknowledging a gap (human decision, config) lets the blocked role start on the next resume, with a caveat", () => {
    env.cleanup();
    env = makeEnv({ acknowledgedGaps: [] });
    cw = new Cowork(env);
    env.eng.registerUnits([P]); env.eng.resume(); cw.approve(P, 2); env.eng.resume();
    expect(env.eng.item(P, 4).state).toBe("ESCALATED_HUMAN_REVIEW");
    env.cfg.acknowledgedGaps.push("G-R4-MEANING-UNITS");
    env.reopen().resume();
    expect(env.eng.item(P, 4).state).toBe("READY");
  });

  it("a production engine (requireFrozenCanonical) refuses an uncertified canonical freeze", () => {
    expect(() => PipelineEngine.open({ ...env.cfg, requireFrozenCanonical: true })).toThrow(/BLOCKED_CANONICAL_INPUT.*not a certified freeze/);
  });
});
