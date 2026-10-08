import { describe, expect, it } from "vitest";
import { runFinalQa, promote } from "../../../lib/sr/pipeline/terminal-gate";
import { buildValidPackage } from "./helpers/package";
import { UPSTREAM } from "./helpers/artifacts";
import type { RoleId } from "../../../lib/sr/pipeline/roles";
import type { ManifestEntry } from "../../../lib/sr/pipeline/final-validator";

const clone = <T,>(v: T): T => JSON.parse(JSON.stringify(v));
const approvedPayloads = { 1: UPSTREAM[1], 2: UPSTREAM[2], 3: UPSTREAM[3], 4: UPSTREAM[4], 5: UPSTREAM[5], 6: UPSTREAM[6], 7: UPSTREAM[7] };
const manifest = () => ([1, 2, 3, 4, 5, 6, 7] as RoleId[]).map((role) => ({ role, hash: `h${role}`, qa: "PASS" as const }));
const input = (pkg: unknown) => {
  const good = buildValidPackage();
  return {
    bytes: new TextEncoder().encode(JSON.stringify(pkg)),
    approvedPayloads,
    manifest: { assembly: { role: 8 as RoleId, hash: "h8" }, upstream: manifest() },
    lock: { packageVersion: 1, schemaVersion: "1.0", roleHashes: good.lock.roleHashes }
  };
};

describe("SR-041 final QA is the terminal production gate", () => {
  it("a clean package yields exactly one FINAL_JSON_QA_PASS with all mandatory checks executed", () => {
    const r = runFinalQa(input(buildValidPackage()));
    expect(r.result).toBe("FINAL_JSON_QA_PASS");
    expect(r.evidence.map((e) => e.result)).toEqual(Array(6).fill("PASS"));
    expect(r.defects).toEqual([]);
  });
  it("PASS permits promotion of the approved package", () => {
    expect(promote(runFinalQa(input(buildValidPackage())))).toEqual({ promoted: true });
  });
  it("any failed check yields FAIL and never promotes", () => {
    const bad = clone(buildValidPackage());
    bad.passage.text = "tampered";
    const r = runFinalQa(input(bad));
    expect(r.result).toBe("FINAL_JSON_QA_FAIL");
    expect(promote(r)).toEqual({ promoted: false, reason: "FINAL_QA_FAILED" });
  });
  it("defects are routed to the owning role from the failing section", () => {
    const bad = clone(buildValidPackage());
    (bad.assessment.items as { answerIndex: number }[])[0].answerIndex = 2;
    const r = runFinalQa(input(bad));
    const d = r.defects.find((x) => x.violated_rule === "UPSTREAM_FIDELITY");
    expect(d).toMatchObject({ owner_role: 3, return_to_role: 3 });
    expect(d!.affected_dependencies).toEqual([6, 7, 8]);
  });
  it("malformed bytes fail strict parsing and later checks are recorded NOT_EXECUTED, so the gate cannot pass", () => {
    const r = runFinalQa({ ...input(buildValidPackage()), bytes: new TextEncoder().encode('{"a":') });
    expect(r.result).toBe("FINAL_JSON_QA_FAIL");
    expect(r.evidence.find((e) => e.check === "STRICT_JSON")!.result).toBe("FAIL");
    expect(r.evidence.filter((e) => e.result === "NOT_EXECUTED").length).toBeGreaterThan(0);
  });
  it("an upstream artifact without QA PASS blocks the final gate", () => {
    const i = input(buildValidPackage());
    (i.manifest.upstream as ManifestEntry[])[2] = { role: 3, hash: "h3", qa: "FAIL" };
    expect(runFinalQa(i).result).toBe("FINAL_JSON_QA_FAIL");
  });
  it("emits one result per package, with a package id", () => {
    const r = runFinalQa(input(buildValidPackage()));
    expect(r.packageId).toBe("PKG-W1-0007");
  });
  it("promote refuses a PASS result that is missing executed evidence", () => {
    const r = runFinalQa(input(buildValidPackage()));
    const forged = { ...r, evidence: r.evidence.slice(0, 5) };
    expect(promote(forged)).toMatchObject({ promoted: false });
  });
});
