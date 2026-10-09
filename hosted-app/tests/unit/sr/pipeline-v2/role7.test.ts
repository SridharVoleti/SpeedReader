// Role 7 is deterministic code: the ATTEMPT-OUTCOME-1.0 state machine parsed from the canonical spec.
// No LLM-created state transitions, no invented thresholds.

import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { CanonicalError, loadCanonicalPackage } from "../../../../lib/sr/pipeline-v2/canonical";
import { loadRegistry } from "../../../../lib/sr/pipeline-v2/registry";
import { applyAttempt, buildAttemptContract, parseOutcomeMachine, resolveAttemptOutcome, verifyAttemptContract } from "../../../../lib/sr/pipeline-v2/role7";
import { buildCanonicalFixture, FIXTURE_VERSION, sha, toCsv } from "./helpers/canonical-fixture";
import { canonicalGate } from "../../../../lib/sr/canonical-authority";

let dir: string;
let names: ReturnType<typeof buildCanonicalFixture>["names"];
beforeEach(() => { dir = mkdtempSync(join(tmpdir(), "sr-r7-")); names = buildCanonicalFixture(dir).names; });
afterEach(() => rmSync(dir, { recursive: true, force: true }));
const load = () => loadCanonicalPackage(dir, { requireFrozen: false });

describe("Role 7 - outcome machine parsed from the canonical transition matrix", () => {
  it("expands 'same' rows and slash lists into the full (state, role, outcome) -> state table", () => {
    const m = parseOutcomeMachine(load());
    expect(m.modelVersion).toBe("ATTEMPT-OUTCOME-1.0");
    expect(m.states).toEqual(["PRIMARY_PENDING", "CONFIRMATION_PENDING", "REVALIDATION_PENDING"]);
    expect(m.outcomes.map((o) => o.outcome).sort()).toEqual(["FAIL", "INSUFFICIENT_EVIDENCE", "INVALID_FORM", "PASS", "TECHNICAL_INVALID"]);
    // 3 PRIMARY roles x 5 + 3 CONFIRMATION roles x 5 + 2 REVALIDATION roles x 5
    expect(m.table).toHaveLength(8 * 5);
  });

  it.each([
    ["PRIMARY_PENDING", "PRIMARY", "PASS", "CONFIRMATION_PENDING", false],
    ["PRIMARY_PENDING", "NEW_CYCLE_PRIMARY", "FAIL", "NOT_YET", true],
    ["PRIMARY_PENDING", "TECHNICAL_REPLACEMENT", "TECHNICAL_INVALID", "PRIMARY_PENDING", false],
    ["PRIMARY_PENDING", "PRIMARY", "INSUFFICIENT_EVIDENCE", "PRIMARY_PENDING", false],
    ["PRIMARY_PENDING", "PRIMARY", "INVALID_FORM", "PRIMARY_PENDING", false],
    ["CONFIRMATION_PENDING", "CONFIRMATION", "PASS", "CONFIRMED_READY", false],
    ["CONFIRMATION_PENDING", "NEW_CYCLE_CONFIRMATION", "FAIL", "DISCORDANT_NOT_YET", true],
    ["CONFIRMATION_PENDING", "CONFIRMATION", "INVALID_FORM", "CONFIRMATION_PENDING", false],
    ["REVALIDATION_PENDING", "REVALIDATION", "PASS", "CURRENT_REVALIDATED", false],
    ["REVALIDATION_PENDING", "REVALIDATION", "FAIL", "NOT_YET_AFTER_REVALIDATION", false],
    ["REVALIDATION_PENDING", "TECHNICAL_REPLACEMENT", "INSUFFICIENT_EVIDENCE", "REVALIDATION_PENDING", false]
  ])("%s + %s + %s -> %s (failed-cycle increment %s)", (before, role, outcome, after, inc) => {
    expect(applyAttempt(parseOutcomeMachine(load()), { before, role, outcome })).toEqual({ after, failedCycleIncrement: inc });
  });

  it("is deterministic and total over the defined domain", () => {
    const m = parseOutcomeMachine(load());
    for (const row of m.table) {
      const a = applyAttempt(m, { before: row.before, role: row.role, outcome: row.outcome });
      expect(a).toEqual(applyAttempt(m, { before: row.before, role: row.role, outcome: row.outcome }));
      expect(a.after).toBe(row.after);
    }
  });

  it("only PASS and FAIL advance the lifecycle; the other three preserve the phase", () => {
    const m = parseOutcomeMachine(load());
    for (const o of ["TECHNICAL_INVALID", "INSUFFICIENT_EVIDENCE", "INVALID_FORM"]) {
      for (const row of m.table.filter((r) => r.outcome === o)) expect(row.after).toBe(row.before);
      expect(m.outcomes.find((x) => x.outcome === o)).toMatchObject({ advancesLifecycle: false, preservesPhase: true, learnerFailure: false });
    }
    expect(m.outcomes.find((x) => x.outcome === "FAIL")).toMatchObject({ advancesLifecycle: true, learnerFailure: true });
    expect(m.outcomes.find((x) => x.outcome === "PASS")).toMatchObject({ advancesLifecycle: true, learnerFailure: false });
  });

  it("rejects combinations the matrix does not define (no invented transitions)", () => {
    const m = parseOutcomeMachine(load());
    expect(() => applyAttempt(m, { before: "PRIMARY_PENDING", role: "CONFIRMATION", outcome: "PASS" })).toThrow(/ILLEGAL_TRANSITION/);
    expect(() => applyAttempt(m, { before: "CONFIRMED_READY", role: "PRIMARY", outcome: "PASS" })).toThrow(/ILLEGAL_TRANSITION/);
    expect(() => applyAttempt(m, { before: "PRIMARY_PENDING", role: "PRIMARY", outcome: "CONDITIONAL_PASS" })).toThrow(/ILLEGAL_TRANSITION/);
  });

  it("a single PRIMARY pass can never close readiness (PRIMARY -> CONFIRMATION -> CONFIRMED_READY)", () => {
    const m = parseOutcomeMachine(load());
    const first = applyAttempt(m, { before: "PRIMARY_PENDING", role: "PRIMARY", outcome: "PASS" });
    expect(first.after).toBe("CONFIRMATION_PENDING");
    expect(applyAttempt(m, { before: first.after, role: "CONFIRMATION", outcome: "PASS" }).after).toBe("CONFIRMED_READY");
  });

  it("fails closed when the transition matrix is absent from the spec", () => {
    const spec = readFileSync(join(dir, names.spec), "utf8").replace("### Canonical transition matrix", "### Something else");
    // re-lock so only the Role 7 parse fails, not package identity
    writeFileSync(join(dir, names.spec), spec);
    relock();
    expect(() => parseOutcomeMachine(load())).toThrow(/BLOCKED_CANONICAL_INPUT/);
  });

  it("detects mirror drift between the spec matrix and the Attempt Outcome Model CSV", () => {
    const mirror = readFileSync(join(dir, names.mirror), "utf8").replace(/FAIL,def FAIL,YES,NO,YES/, "FAIL,def FAIL,NO,NO,YES");
    writeFileSync(join(dir, names.mirror), mirror);
    relock();
    expect(() => parseOutcomeMachine(load())).toThrow(/MIRROR_DRIFT/);
  });

  function relock() {
    const lockRows = ["canonical_package_version,package_model_version,artifact,authority_domain,required_in_package,sha256,bytes,lock_validation_rule"];
    for (const [n, d] of [[names.spec, "GLOBAL_RULES"], [names.rows, "ROW_INSTANCE_VALUES"], [names.mirror, "DERIVED_MIRROR"]]) {
      const b = readFileSync(join(dir, n));
      lockRows.push([FIXTURE_VERSION, "PACKAGE-1.0", n, d, "YES", sha(b), b.length, "exact"].join(","));
    }
    writeFileSync(join(dir, names.lock), lockRows.join("\n") + "\n");
  }
  void toCsv;
});

describe("Role 7 - evidence classification precedence (OS12 step 9)", () => {
  const base = { formValid: true, technicallyValid: true, evidenceSufficient: true, criteriaMet: true };
  it("maps valid scoreable evidence to PASS or FAIL", () => {
    expect(resolveAttemptOutcome(base)).toBe("PASS");
    expect(resolveAttemptOutcome({ ...base, criteriaMet: false })).toBe("FAIL");
  });
  it("technical invalidity -> TECHNICAL_INVALID; underpowered denominator -> INSUFFICIENT_EVIDENCE; bad form -> INVALID_FORM", () => {
    expect(resolveAttemptOutcome({ ...base, technicallyValid: false, criteriaMet: false })).toBe("TECHNICAL_INVALID");
    expect(resolveAttemptOutcome({ ...base, evidenceSufficient: false })).toBe("INSUFFICIENT_EVIDENCE");
    expect(resolveAttemptOutcome({ ...base, formValid: false })).toBe("INVALID_FORM");
  });
  it("technical outranks insufficient (spec order); a bad form combined with another cause fails closed rather than inventing precedence", () => {
    expect(resolveAttemptOutcome({ ...base, technicallyValid: false, evidenceSufficient: false })).toBe("TECHNICAL_INVALID");
    expect(() => resolveAttemptOutcome({ ...base, formValid: false, technicallyValid: false })).toThrow(/AMBIGUOUS/);
  });
  it("a failing learner criterion never masks invalid evidence as a learner FAIL", () => {
    expect(resolveAttemptOutcome({ ...base, evidenceSufficient: false, criteriaMet: false })).toBe("INSUFFICIENT_EVIDENCE");
  });
});

describe("Role 7 - ATTEMPT_OUTCOME_CONTRACT artifact", () => {
  it("is built from the canonical machine, bound to the approved Role 6 hash, and verifies independently", () => {
    const pkg = load();
    const reg = loadRegistry(pkg);
    const c = buildAttemptContract(pkg, reg, "W1-0010", "a".repeat(64));
    expect(c).toMatchObject({ artifact_type: "ATTEMPT_OUTCOME_CONTRACT", passage_id: "W1-0010", registry_coordinate: "RS01-P10", model_version: "ATTEMPT-OUTCOME-1.0", upstream_hashes: { "6": "a".repeat(64) } });
    expect(c.transitions).toHaveLength(8 * 5);
    expect(verifyAttemptContract(c, pkg, reg, "a".repeat(64))).toEqual({ ok: true, problems: [] });
    const tampered = JSON.parse(JSON.stringify(c));
    tampered.transitions[0].after = "CONFIRMED_READY";
    expect(verifyAttemptContract(tampered, pkg, reg, "a".repeat(64)).ok).toBe(false);
    expect(verifyAttemptContract(c, pkg, reg, "b".repeat(64)).problems.join()).toMatch(/role 6 hash/);
  });
  it("requires an upstream Role 6 hash", () => {
    const pkg = load();
    expect(() => buildAttemptContract(pkg, loadRegistry(pkg), "W1-0001", "")).toThrow(CanonicalError);
  });
});

describe("Role 7 against the real v0.56 candidate package (skipped when absent)", () => {
  const gate = canonicalGate();
  const real = gate.dir;
  it.skipIf(gate.skip)("parses the real matrix with no mirror drift and reproduces PRIMARY->CONFIRMATION->CONFIRMED_READY", () => {
    gate.assertUsable();
    console.info(gate.report);
    const m = parseOutcomeMachine(loadCanonicalPackage(real, { requireFrozen: false }));
    expect(m.table).toHaveLength(40);
    expect(applyAttempt(m, { before: "CONFIRMATION_PENDING", role: "CONFIRMATION", outcome: "PASS" }).after).toBe("CONFIRMED_READY");
    expect(m.mirrorChecked).toBe(true);
  });
});
