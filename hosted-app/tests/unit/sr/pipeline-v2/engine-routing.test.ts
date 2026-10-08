// Defect routing, upstream touchback, hash-based descendant invalidation, retry limit and repeated-blocker escalation.

import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { art, Cowork, defectFor, makeEnv, type Env } from "./helpers/harness";
import { ImportRejected } from "../../../../lib/sr/pipeline-v2/engine";
import { canonicalHash } from "../../../../lib/sr/pipeline/hash";

let env: Env;
let cw: Cowork;
const P = "W1-0001";
const Q = "W1-0002";
beforeEach(() => { env = makeEnv(); cw = new Cowork(env); });
afterEach(() => env.cleanup());

const state = (p: string, r: number) => env.eng.item(p, r).state;
const approvedHash = (p: string, r: number) => env.eng.artifacts(p, r).find((a) => a.status === "APPROVED")?.content_hash;
const rejected = (fn: () => unknown): string => { try { fn(); } catch (e) { if (e instanceof ImportRejected) return e.code; throw e; } return "NOT_REJECTED"; };

/** a QA FAIL for the role's current QA job */
const failQa = (p: string, role: number, defects: unknown[], variant = "a") => {
  const { outcome } = cw.creator(p, role, art(role, p, variant));
  expect(outcome.status).toBe("READY_FOR_INDEPENDENT_QA");
  return cw.qa(outcome.qaJobId!, "QA_FAIL", { defects });
};

describe("own-role QA failure, retry limit and escalation", () => {
  beforeEach(() => { env.eng.registerUnits([P]); env.eng.resume(); });

  it("a QA FAIL traverses QA_FAILED, preserves the failed attempt and schedules attempt 2 with the defect as context", () => {
    const r = failQa(P, 2, [defectFor({ passage: P, owner: 2, detectedBy: 2, rule: "PG4", actual: "vocabulary too hard" })]);
    expect(r.status).toBe("QA_FAILED");
    expect(env.eng.artifacts(P, 2).map((a) => [a.version, a.status])).toEqual([[1, "QA_FAILED"]]);
    expect(env.eng.history(P, 2).map((h) => h.to_state)).toEqual(["PENDING", "READY", "IN_PROGRESS", "WIP_READY_FOR_QA", "QA_FAILED", "READY"]);
    expect(env.eng.item(P, 2)).toMatchObject({ state: "READY", failed_attempts: 1 });
    const next = env.eng.listJobs({ passage: P, role: 2, type: "CREATOR", state: "READY" })[0];
    expect(next).toMatchObject({ attempt_no: 2, is_correction: 1, upstream_caused: 0 });
    expect(JSON.parse(next.defect_ids_json)).toHaveLength(1);
    expect(env.eng.listJobs({ passage: P, role: 2, type: "CREATOR" })).toHaveLength(2); // history preserved
    expect(env.eng.defects({ passage: P })[0]).toMatchObject({ status: "ROUTED", owner_role: "2" });
  });

  it("after a correction passes, the defect closes and the new version is approved", () => {
    failQa(P, 2, [defectFor({ passage: P, owner: 2, detectedBy: 2 })]);
    cw.approve(P, 2, "fixed");
    expect(env.eng.artifacts(P, 2).map((a) => [a.version, a.status])).toEqual([[1, "QA_FAILED"], [2, "APPROVED"]]);
    expect(env.eng.defects({ passage: P })[0].status).toBe("CLOSED");
    expect(env.eng.item(P, 2).state).toBe("APPROVED");
  });

  it("three failed creator attempts (attempt 1 initial, 2 correction, 3 final) escalate to human review; no 4th job exists", () => {
    failQa(P, 2, [defectFor({ passage: P, owner: 2, detectedBy: 2, rule: "PG1", actual: "problem one" })], "a");
    failQa(P, 2, [defectFor({ passage: P, owner: 2, detectedBy: 2, rule: "PG2", actual: "problem two" })], "b");
    expect(env.eng.item(P, 2)).toMatchObject({ state: "READY", failed_attempts: 2 });
    const r = failQa(P, 2, [defectFor({ passage: P, owner: 2, detectedBy: 2, rule: "PG3", actual: "problem three" })], "c");
    expect(r.status).toBe("ESCALATED_HUMAN_REVIEW");
    expect(env.eng.item(P, 2)).toMatchObject({ state: "ESCALATED_HUMAN_REVIEW", failed_attempts: 3 });
    expect(env.eng.item(P, 2).escalation_reason).toMatch(/RETRY_LIMIT/);
    expect(env.eng.listJobs({ passage: P, role: 2, type: "CREATOR" }).map((j) => j.attempt_no)).toEqual([1, 2, 3]);
    expect(env.eng.listJobs({ passage: P, role: 2, state: "READY" })).toEqual([]);
    expect(state(P, 3)).toBe("PENDING");
  });

  it("substantially the same blocker twice in a row escalates early (after the 2nd failure)", () => {
    const same = () => defectFor({ passage: P, owner: 2, detectedBy: 2, rule: "PG4", actual: "Same  Vocabulary problem" });
    failQa(P, 2, [same()], "a");
    const r = failQa(P, 2, [{ ...same(), actual: "same vocabulary problem" }], "b"); // different case/spacing, same blocker
    expect(r.status).toBe("ESCALATED_HUMAN_REVIEW");
    expect(env.eng.item(P, 2)).toMatchObject({ state: "ESCALATED_HUMAN_REVIEW", failed_attempts: 2 });
    expect(env.eng.item(P, 2).escalation_reason).toMatch(/REPEATED_BLOCKER/);
    expect(env.eng.defects({ passage: P }).every((d) => d.status === "ESCALATED" || d.status === "ROUTED")).toBe(true);
  });

  it("different blockers on consecutive failures do not trigger early escalation", () => {
    failQa(P, 2, [defectFor({ passage: P, owner: 2, detectedBy: 2, rule: "PG1", actual: "x" })], "a");
    failQa(P, 2, [defectFor({ passage: P, owner: 2, detectedBy: 2, rule: "PG2", actual: "y" })], "b");
    expect(state(P, 2)).toBe("READY");
  });

  it("a human can resolve an escalation: the chain resets and a fresh attempt 1 job is created", () => {
    const same = () => defectFor({ passage: P, owner: 2, detectedBy: 2, rule: "PG4", actual: "same" });
    failQa(P, 2, [same()], "a"); failQa(P, 2, [same()], "b");
    expect(state(P, 2)).toBe("ESCALATED_HUMAN_REVIEW");
    env.eng.resolveEscalation(P, 2, "canonical owner clarified PG4");
    expect(env.eng.item(P, 2)).toMatchObject({ state: "READY", failed_attempts: 0 });
    expect(env.eng.listJobs({ passage: P, role: 2, state: "READY" })[0].attempt_no).toBe(1);
    expect(env.eng.events().some((e) => e.type === "ESCALATION_RESOLVED")).toBe(true);
    expect(() => env.eng.resolveEscalation(P, 2, "again")).toThrow(/not escalated/);
  });

  it("a QA FAIL must carry at least one complete BLOCKER defect", () => {
    const { outcome } = cw.creator(P, 2);
    expect(rejected(() => cw.qa(outcome.qaJobId!, "QA_FAIL", { defects: [] }))).toBe("QA_FAIL_WITHOUT_BLOCKER");
    expect(rejected(() => cw.qa(outcome.qaJobId!, "QA_FAIL", { defects: [{ violated_rule_id: "x" }] }))).toBe("INVALID_DEFECT");
    expect(state(P, 2)).toBe("WIP_READY_FOR_QA");
  });

  it("non-blocking observations never force rework", () => {
    const { outcome } = cw.creator(P, 2);
    const done = cw.qa(outcome.qaJobId!, "QA_PASS");
    expect(done.status).toBe("APPROVED");
  });
});

describe("upstream touchback", () => {
  beforeEach(() => { env.eng.registerUnits([P, Q]); });

  /** both passages: R1-R5 approved; R6 candidate for P is under QA and fails because R4 is wrong */
  function scenario() {
    for (const p of [P, Q]) cw.approveThrough(p, 5);
    const h = { r3: approvedHash(P, 3)!, r4: approvedHash(P, 4)!, r5: approvedHash(P, 5)! };
    const q = Object.fromEntries([1, 2, 3, 4, 5].map((r) => [r, approvedHash(Q, r)]));
    const { outcome } = cw.creator(P, 6);
    const r4 = env.eng.artifacts(P, 4).find((a) => a.status === "APPROVED")!;
    const result = cw.qa(outcome.qaJobId!, "QA_FAIL", {
      defects: [defectFor({ passage: P, owner: 4, detectedBy: 6, rule: "MU-FIDELITY", actual: "meaning unit M1 reverses polarity", sourceArtifactId: r4.artifact_id, sourceHash: r4.content_hash })]
    });
    return { h, q, result, r6Job: outcome.qaJobId! };
  }

  it("Role 6 QA reports a Role 4 defect: owner identified, Role 6 BLOCKED_UPSTREAM, Role 4 correction job created, nothing repaired by QA", () => {
    const { result, h } = scenario();
    expect(result.status).toBe("BLOCKED_UPSTREAM");
    expect(state(P, 6)).toBe("BLOCKED_UPSTREAM");
    expect(env.eng.item(P, 6)).toMatchObject({ blocked_on_role: 4, failed_attempts: 0 }); // downstream does not spend its retry quota
    expect(env.eng.artifacts(P, 6)[0].status).toBe("REJECTED_UPSTREAM");
    expect(state(P, 4)).toBe("READY");
    expect(env.eng.item(P, 4)).toMatchObject({ failed_attempts: 1, reopen_count: 1 });
    const fix = env.eng.listJobs({ passage: P, role: 4, type: "CREATOR", state: "READY" })[0];
    expect(fix).toMatchObject({ attempt_no: 2, is_correction: 1 });
    const d = env.eng.defects({ passage: P })[0];
    expect(d).toMatchObject({ owner_role: "4", detected_by_role: 6, status: "ROUTED", routed_job_id: fix.job_id });
    expect(approvedHash(P, 4)).toBe(h.r4); // the defective approved v1 is untouched, not edited by QA
    expect(state(P, 3)).toBe("APPROVED"); // unaffected artifacts are preserved
    expect(state(P, 5)).toBe("APPROVED"); // descendants keep their approval until a corrected hash exists
  });

  it("the Role 4 correction packet carries the defect context; after fresh independent QA and approval only true descendants are invalidated", () => {
    const { h, q } = scenario();
    const fix = env.eng.listJobs({ passage: P, role: 4, type: "CREATOR", state: "READY" })[0];
    const { promptPath } = env.eng.exportJob(fix.job_id);
    expect(require("node:fs").readFileSync(promptPath, "utf8")).toContain("meaning unit M1 reverses polarity");

    const { outcome } = cw.creator(P, 4, art(4, P, "fixed"), { job: fix });
    expect(outcome.status).toBe("READY_FOR_INDEPENDENT_QA"); // fresh independent QA is required
    expect(state(P, 4)).toBe("WIP_READY_FOR_QA");
    expect(state(P, 5)).toBe("APPROVED"); // nothing invalidated before the corrected artifact is approved
    const done = cw.qa(outcome.qaJobId!, "QA_PASS");
    expect(done.status).toBe("APPROVED");

    const h4new = approvedHash(P, 4)!;
    expect(h4new).not.toBe(h.r4);
    expect(env.eng.artifacts(P, 4).map((a) => [a.version, a.status])).toEqual([[1, "SUPERSEDED"], [2, "APPROVED"]]);
    // descendants that relied on the superseded Role 4 hash: 5 (direct); 6 re-runs; 7 and 8 not yet produced
    expect(state(P, 5)).toBe("READY");
    expect(env.eng.artifacts(P, 5).find((a) => a.version === 1)).toMatchObject({ status: "INVALIDATED" });
    expect(env.eng.artifacts(P, 5).find((a) => a.version === 1)!.invalidated_reason).toMatch(/role 4/);
    // unrelated artifacts of the same passage survive
    expect(state(P, 3)).toBe("APPROVED");
    expect(approvedHash(P, 3)).toBe(h.r3);
    expect(state(P, 2)).toBe("APPROVED");
    // the blocked Role 6 resumes in dependency order with an upstream-caused rerun that spends no attempt
    expect(state(P, 6)).toBe("READY");
    const rerun = env.eng.listJobs({ passage: P, role: 6, type: "CREATOR", state: "READY" })[0];
    expect(rerun).toMatchObject({ attempt_no: 1, upstream_caused: 1 });
    expect(env.eng.item(P, 6).failed_attempts).toBe(0);
    expect(JSON.parse(rerun.input_hashes_json)["4"]).toBe(h4new);
    // another passage is completely untouched
    for (const r of [1, 2, 3, 4, 5]) expect(approvedHash(Q, r)).toBe(q[r]);
    expect(env.eng.items(Q).filter((i) => i.role_id <= 5).every((i) => i.state === "APPROVED")).toBe(true);
    void h;
  });

  it("when everything downstream was already approved, the whole descendant chain 5,6,7,8 is invalidated and 3 is kept", () => {
    for (const p of [P, Q]) cw.approveThrough(p, 6);
    env.eng.resume();
    expect(state(P, 8)).toBe("FINAL_APPROVED");
    const before = Object.fromEntries([1, 2, 3, 4, 5, 6, 7, 8].map((r) => [r, approvedHash(P, r)]));
    // Role 8 final validation (or any later QA) finds a Role 4 defect: reopen Role 4 by routing a defect from Role 8
    env.eng.routeExternalDefects(P, 8, [defectFor({ passage: P, owner: 4, detectedBy: 8, rule: "MU-FIDELITY", actual: "late finding" })]);
    expect(state(P, 4)).toBe("READY");
    cw.approve(P, 4, "fixed4");
    env.eng.resume();
    expect(state(P, 3)).toBe("APPROVED");
    expect(approvedHash(P, 3)).toBe(before[3]);
    for (const r of [5, 6, 7, 8]) expect(["READY", "PENDING", "INVALIDATED"], `role ${r}`).toContain(state(P, r));
    for (const r of [5, 6, 7, 8]) expect(env.eng.artifacts(P, r)[0].status, `role ${r} v1`).toBe("INVALIDATED");
    expect(approvedHash(Q, 4)).toBeTruthy();
    expect(state(Q, 8)).toBe("FINAL_APPROVED");
  });

  it("a correction that reproduces the identical artifact hash invalidates nothing", () => {
    scenario();
    const fix = env.eng.listJobs({ passage: P, role: 4, type: "CREATOR", state: "READY" })[0];
    const { outcome } = cw.creator(P, 4, art(4, P, "a"), { job: fix }); // same variant => same hash
    cw.qa(outcome.qaJobId!, "QA_PASS");
    expect(state(P, 5)).toBe("APPROVED");
    expect(env.eng.artifacts(P, 5).every((a) => a.status !== "INVALIDATED")).toBe(true);
  });

  it("a Role 3 defect found in Role 6 QA is routed to Role 3, not to Role 4 or Role 5", () => {
    for (const p of [P]) cw.approveThrough(p, 5);
    const { outcome } = cw.creator(P, 6);
    cw.qa(outcome.qaJobId!, "QA_FAIL", { defects: [defectFor({ passage: P, owner: 3, detectedBy: 6, rule: "A-1", actual: "two defensible answers" })] });
    expect(state(P, 3)).toBe("READY");
    expect(state(P, 4)).toBe("APPROVED");
    expect(state(P, 5)).toBe("APPROVED");
    expect(env.eng.item(P, 6)).toMatchObject({ state: "BLOCKED_UPSTREAM", blocked_on_role: 3 });
  });

  it("a Role 2 source defect found at Role 4 QA cascades: the approved Role 3 (relied on old Role 2) is invalidated, an exported Role 3 job goes stale", () => {
    env.eng.resume(); cw.approve(P, 2); env.eng.resume();
    const r3job = cw.readyCreator(P, 3);
    env.eng.exportJob(r3job.job_id); // Role 3 in flight on the old Role 2 hash
    const { outcome } = cw.creator(P, 4);
    const r2 = env.eng.artifacts(P, 2)[0];
    cw.qa(outcome.qaJobId!, "QA_FAIL", { defects: [defectFor({ passage: P, owner: 2, detectedBy: 4, rule: "SRC-1", actual: "passage ambiguity", sourceArtifactId: r2.artifact_id, sourceHash: r2.content_hash })] });
    expect(state(P, 4)).toBe("BLOCKED_UPSTREAM");
    expect(state(P, 2)).toBe("READY");
    cw.approve(P, 2, "rewritten"); // new hash
    // the in-flight Role 3 job relied on the old hash => stale and replaced
    expect(env.eng.getJob(r3job.job_id).state).toBe("STALE");
    const resultForStale = { job_id: r3job.job_id, production_unit_id: P, role_id: "3", job_type: "CREATOR", state: "READY_FOR_INDEPENDENT_QA", artifact: art(3, P), checks_run: [], blocking_defects: [], nonblocking_observations: [] };
    expect(rejected(() => env.eng.importResult(r3job.job_id, resultForStale, { runRef: "late" }))).toBe("STALE_JOB");
    const fresh = env.eng.listJobs({ passage: P, role: 3, type: "CREATOR", state: "READY" });
    expect(fresh).toHaveLength(1);
    expect(JSON.parse(fresh[0].input_hashes_json)["2"]).toBe(approvedHash(P, 2));
    expect(state(P, 4)).toBe("READY"); // unblocked, rerun
  });

  it("an approved Role 3 is invalidated when Role 2 is re-approved with a different hash", () => {
    cw.approveThrough(P, 3);
    const h3 = approvedHash(P, 3);
    env.eng.routeExternalDefects(P, 3, [defectFor({ passage: P, owner: 2, detectedBy: 3, rule: "SRC-1", actual: "late source defect" })]);
    cw.approve(P, 2, "rewritten");
    expect(env.eng.artifacts(P, 3)[0]).toMatchObject({ status: "INVALIDATED" });
    expect(env.eng.item(P, 3).approved_artifact_id).toBeNull();
    expect(approvedHash(P, 3)).toBeUndefined();
    expect(h3).toBeTruthy();
  });

  it("a Role 4 creator that finds the cause in Role 2 reports BLOCKED_UPSTREAM; the creator's attempt is not consumed", () => {
    env.eng.resume(); cw.approve(P, 2); env.eng.resume();
    const job = cw.readyCreator(P, 4);
    const r2 = env.eng.artifacts(P, 2)[0];
    const { outcome } = cw.creator(P, 4, art(4, P), {
      job, state: "BLOCKED_UPSTREAM",
      defects: [defectFor({ passage: P, owner: 2, detectedBy: 4, rule: "SRC-2", actual: "contradiction in passage", sourceArtifactId: r2.artifact_id, sourceHash: r2.content_hash })]
    });
    expect(outcome.status).toBe("BLOCKED_UPSTREAM");
    expect(env.eng.item(P, 4)).toMatchObject({ state: "BLOCKED_UPSTREAM", failed_attempts: 0, blocked_on_role: 2 });
    expect(state(P, 2)).toBe("READY");
    expect(env.eng.artifacts(P, 4)).toEqual([]); // no candidate was created from a blocked creator
  });

  it("owners must be this role or an upstream role; a downstream or unrelated owner is rejected", () => {
    cw.approveThrough(P, 3);
    const { outcome } = cw.creator(P, 4);
    expect(rejected(() => cw.qa(outcome.qaJobId!, "QA_FAIL", { defects: [defectFor({ passage: P, owner: 6, detectedBy: 4 })] }))).toBe("INVALID_DEFECT_OWNER");
    expect(rejected(() => cw.qa(outcome.qaJobId!, "QA_FAIL", { defects: [defectFor({ passage: P, owner: 3, detectedBy: 4 })] }))).toBe("INVALID_DEFECT_OWNER"); // R3 is not upstream of R4
    expect(state(P, 4)).toBe("WIP_READY_FOR_QA");
  });

  it("CANONICAL_OWNER (or the code-owned Role 1) escalates to human review instead of creating an LLM correction job", () => {
    env.eng.resume(); cw.approve(P, 2); env.eng.resume();
    const { outcome } = cw.creator(P, 3);
    const r = cw.qa(outcome.qaJobId!, "QA_FAIL", { defects: [defectFor({ passage: P, owner: "CANONICAL_OWNER", detectedBy: 3, rule: "CANON-1", actual: "blueprint contradicts row" })] });
    expect(r.status).toBe("ESCALATED_HUMAN_REVIEW");
    expect(state(P, 3)).toBe("ESCALATED_HUMAN_REVIEW");
    expect(env.eng.item(P, 3).escalation_reason).toMatch(/CANONICAL_OWNER/);
    expect(env.eng.defects({ passage: P })[0].status).toBe("ESCALATED");
    const { outcome: o2 } = (() => { env.eng.resolveEscalation(P, 3, "owner decided"); return cw.creator(P, 3, art(3, P, "b")); })();
    const r1 = cw.qa(o2.qaJobId!, "QA_FAIL", { defects: [defectFor({ passage: P, owner: 1, detectedBy: 3, rule: "SPEC-1", actual: "spec impossible" })] });
    expect(r1.status).toBe("ESCALATED_HUMAN_REVIEW");
    expect(state(P, 1)).toBe("APPROVED"); // code-owned role is never given an LLM correction job
  });

  it("the same upstream blocker reported again after the correction escalates the owner (not an endless loop)", () => {
    const { r6Job } = scenario();
    void r6Job;
    const fix = env.eng.listJobs({ passage: P, role: 4, type: "CREATOR", state: "READY" })[0];
    const { outcome } = cw.creator(P, 4, art(4, P, "fixed"), { job: fix });
    cw.qa(outcome.qaJobId!, "QA_PASS");
    // Role 6 reruns and QA finds the very same Role 4 problem
    const { outcome: o6 } = cw.creator(P, 6, art(6, P, "second"));
    const r = cw.qa(o6.qaJobId!, "QA_FAIL", { defects: [defectFor({ passage: P, owner: 4, detectedBy: 6, rule: "MU-FIDELITY", actual: "Meaning unit M1 reverses polarity" })] });
    expect(r.status).toBe("BLOCKED_UPSTREAM");
    expect(state(P, 4)).toBe("ESCALATED_HUMAN_REVIEW");
    expect(env.eng.item(P, 4).escalation_reason).toMatch(/REPEATED_BLOCKER/);
    expect(env.eng.item(P, 6).failed_attempts).toBe(0);
  });

  it("the owner's retry budget bounds repeated touchbacks (third reopen escalates)", () => {
    cw.approveThrough(P, 3);
    for (let k = 1; k <= 3; k++) {
      env.eng.routeExternalDefects(P, 3, [defectFor({ passage: P, owner: 2, detectedBy: 3, rule: `SRC-${k}`, actual: `finding ${k}` })]);
      if (k < 3) cw.approve(P, 2, `v${k}`);
    }
    expect(env.eng.item(P, 2)).toMatchObject({ state: "ESCALATED_HUMAN_REVIEW", failed_attempts: 3 });
    expect(env.eng.item(P, 2).escalation_reason).toMatch(/RETRY_LIMIT/);
  });
});

describe("audit trail", () => {
  it("every transition and import is recorded in append-only history", () => {
    env.eng.registerUnits([P]); env.eng.resume();
    cw.approve(P, 2);
    const types = env.eng.events().map((e) => e.type);
    for (const t of ["UNIT_REGISTERED", "JOB_CREATED", "JOB_EXPORTED", "RESULT_IMPORTED", "ARTIFACT_PROMOTED"]) expect(types).toContain(t);
    expect(() => env.eng.db.run("DELETE FROM state_history")).toThrow(/append-only/);
    expect(canonicalHash(art(2, P))).toBe(approvedHash(P, 2));
  });
});
