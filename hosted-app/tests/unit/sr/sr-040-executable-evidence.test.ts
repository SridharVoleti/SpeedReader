import { describe, expect, it } from "vitest";
import { runCheck, notExecuted, evidenceSummary, MANDATORY_CHECKS } from "../../../lib/sr/pipeline/evidence";

describe("SR-040 executable test evidence", () => {
  it("captures command, validator version, result and no failure details on success", () => {
    const e = runCheck("STRICT_JSON", { command: "strictParseBytes(pkgBytes)", validatorVersion: "node-18 JSON.parse" }, () => ({ ok: true, problems: [] }));
    expect(e).toEqual({ check: "STRICT_JSON", command: "strictParseBytes(pkgBytes)", validatorVersion: "node-18 JSON.parse", executed: true, result: "PASS", failures: [] });
  });
  it("captures failure details when the check fails", () => {
    const e = runCheck("JSON_SCHEMA", { command: "ajv.validate", validatorVersion: "ajv 8.17.1" }, () => ({ ok: false, problems: ["/bpc required"] }));
    expect(e).toMatchObject({ executed: true, result: "FAIL", failures: ["/bpc required"] });
  });
  it("a validator that throws is recorded as FAIL with the error, never as PASS", () => {
    const e = runCheck("UPSTREAM_FIDELITY", { command: "diff", validatorVersion: "v1" }, () => { throw new Error("boom"); });
    expect(e).toMatchObject({ executed: true, result: "FAIL" });
    expect(e.failures.join()).toMatch(/boom/);
  });
  it("NOT_EXECUTED is its own result and is not a pass", () => {
    const e = notExecuted("VERSION_HASHES", "recompute hashes", "v1");
    expect(e).toMatchObject({ executed: false, result: "NOT_EXECUTED" });
  });
  it("the mandatory check list covers the six final-validator checks", () => {
    expect([...MANDATORY_CHECKS]).toEqual(["STRICT_JSON", "DUPLICATE_KEYS", "JSON_SCHEMA", "REFERENTIAL_INTEGRITY", "UPSTREAM_FIDELITY", "VERSION_HASHES"]);
  });
  it("a summary cannot PASS if any mandatory check is NOT_EXECUTED or absent", () => {
    const pass = (c: string) => runCheck(c, { command: "x", validatorVersion: "v" }, () => ({ ok: true, problems: [] }));
    const all = MANDATORY_CHECKS.map(pass);
    expect(evidenceSummary(all).canPass).toBe(true);
    expect(evidenceSummary([...all.slice(0, 5), notExecuted("VERSION_HASHES", "x", "v")])).toMatchObject({ canPass: false, notExecuted: ["VERSION_HASHES"] });
    expect(evidenceSummary(all.slice(0, 4))).toMatchObject({ canPass: false, notExecuted: ["UPSTREAM_FIDELITY", "VERSION_HASHES"] });
  });
  it("a summary with a failed check cannot pass and lists it", () => {
    const ev = MANDATORY_CHECKS.map((c) => runCheck(c, { command: "x", validatorVersion: "v" }, () => ({ ok: c !== "JSON_SCHEMA", problems: ["bad"] })));
    expect(evidenceSummary(ev)).toMatchObject({ canPass: false, failed: ["JSON_SCHEMA"] });
  });
  it("evidence missing a command or validator version is not accepted as executed evidence", () => {
    const e = runCheck("STRICT_JSON", { command: "", validatorVersion: "" }, () => ({ ok: true, problems: [] }));
    expect(e.result).toBe("NOT_EXECUTED");
  });
});
