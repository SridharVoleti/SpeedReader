// Role 8: deterministic assembly + machine validation. Zero educational semantics; every mandatory check executes.

import { describe, expect, it } from "vitest";
import { canonicalHash } from "../../../../lib/sr/pipeline/hash";
import {
  assembleFinalPackage, finalEvidenceSummary, INTERIM_ENVELOPE_SCHEMA, promotionSmoke, validateFinalPackage, V2_MANDATORY_CHECKS,
  type Role8Context
} from "../../../../lib/sr/pipeline-v2/role8";

const PID = "W1-0007";
const H = "a".repeat(64);
const artifactFor = (role: number): Record<string, unknown> => {
  const base = { passage_id: PID };
  switch (role) {
    case 1: return { ...base, artifact_type: "PASSAGE_SPEC" };
    case 2: return { ...base, title: "T", body: "b" };
    case 3: return { ...base, items: [{ itemId: "Q1" }, { itemId: "Q2" }] };
    case 4: return { ...base, units: [{ muId: "M1" }] };
    case 5: return { ...base, text: "bpc" };
    case 6: return { ...base, primaryItemId: "Q1", maps: [{ item: "Q1", mu: "M1" }] };
    default: return { ...base, artifact_type: "ATTEMPT_OUTCOME_CONTRACT" };
  }
};
function makeCtx(over: Partial<Role8Context> = {}): Role8Context {
  const sections: Role8Context["sections"] = {};
  for (let role = 1; role <= 7; role++) {
    const artifact = artifactFor(role);
    const hash = canonicalHash(artifact);
    sections[role] = { role, artifactId: `${PID}:r${role}:v1`, version: 1, hash, artifact, certificateHash: `${role}`.repeat(64), qaKind: role === 1 || role === 7 ? "MACHINE_DETERMINISTIC" : "INDEPENDENT_SEMANTIC", currentHash: hash };
  }
  return {
    passageId: PID, packageVersion: 1, canonical: { id: "CAN", version: "v9", hash: H }, unitCanonicalHash: H, sections,
    schema: { authority: "INTERIM_ENVELOPE", id: "interim-envelope", schema: INTERIM_ENVELOPE_SCHEMA },
    refRules: [
      { id: "primary-item-exists", from: { section: "scoring", path: "$.primaryItemId" }, to: { section: "assessment", path: "$.items[*].itemId" } },
      { id: "mu-exists", from: { section: "scoring", path: "$.maps[*].mu" }, to: { section: "meaningUnits", path: "$.units[*].muId" } }
    ],
    refRulesAuthority: "CONFIGURED_NON_CANONICAL",
    ...over
  };
}
const run = (ctx = makeCtx(), mutate?: (pkg: any, text: string) => string) => {
  const { pkg, bytes } = assembleFinalPackage(ctx);
  const text = mutate ? mutate(JSON.parse(JSON.stringify(pkg)), new TextDecoder().decode(bytes)) : new TextDecoder().decode(bytes);
  return { pkg, v: validateFinalPackage(new TextEncoder().encode(text), ctx) };
};
const failing = (v: ReturnType<typeof validateFinalPackage>) => v.evidence.filter((e) => e.result === "FAIL").map((e) => e.check);

describe("Role 8 assembly", () => {
  it("assembles the approved artifacts unchanged and adds only identity/lock metadata", () => {
    const ctx = makeCtx();
    const { pkg } = assembleFinalPackage(ctx);
    const sections = pkg.sections as Record<string, unknown>;
    expect(sections.passage).toEqual(artifactFor(2));
    expect(sections.attemptContract).toEqual(artifactFor(7));
    expect(Object.keys(sections).sort()).toEqual(["assessment", "attemptContract", "bpc", "meaningUnits", "passage", "scoring", "spec"]);
    expect(pkg).toMatchObject({ package_id: `PKG-${PID}`, package_version: 1, passage_id: PID });
    expect((pkg.lock as any).role_hashes["4"]).toBe(ctx.sections[4].hash);
  });

  it("is deterministic (byte-identical for identical inputs)", () => {
    const a = assembleFinalPackage(makeCtx()).bytes;
    const b = assembleFinalPackage(makeCtx()).bytes;
    expect(Buffer.from(a).equals(Buffer.from(b))).toBe(true);
  });

  it("refuses to assemble when an approved input is missing", () => {
    const ctx = makeCtx();
    delete ctx.sections[5];
    expect(() => assembleFinalPackage(ctx)).toThrow(/role 5/);
  });
});

describe("Role 8 validation - mandatory checks", () => {
  it("a clean package passes the eight pre-promotion checks and records executable evidence for each", () => {
    const { v } = run();
    expect(v.ok).toBe(true);
    expect(v.problems).toEqual([]);
    for (const c of V2_MANDATORY_CHECKS.filter((x) => x !== "PROMOTION_SMOKE")) {
      const e = v.evidence.find((x) => x.check === c)!;
      expect(e, c).toMatchObject({ executed: true, result: "PASS" });
      expect(e.command.length).toBeGreaterThan(0);
      expect(e.validatorVersion.length).toBeGreaterThan(0);
    }
    expect(v.evidence.find((e) => e.check === "PROMOTION_SMOKE")!.result).toBe("NOT_EXECUTED");
  });

  it("final PASS needs all nine checks: a NOT_EXECUTED promotion smoke is never a pass", () => {
    const { v } = run();
    expect(finalEvidenceSummary(v.evidence)).toMatchObject({ canPass: false, notExecuted: ["PROMOTION_SMOKE"] });
    const smoke = promotionSmoke(() => ({ text: "{}", hash: "h" }), "h");
    expect(smoke.result).toBe("PASS");
    const all = [...v.evidence.filter((e) => e.check !== "PROMOTION_SMOKE"), smoke];
    expect(finalEvidenceSummary(all).canPass).toBe(true);
  });

  it("the promotion smoke fails on a hash mismatch or a duplicate-key file", () => {
    expect(promotionSmoke(() => ({ text: "{}", hash: "x" }), "h").result).toBe("FAIL");
    expect(promotionSmoke(() => ({ text: '{"a":1,"a":2}', hash: "h" }), "h").result).toBe("FAIL");
  });

  it("strict JSON: BOM, malformed JSON and trailing garbage fail and skip the dependent checks as NOT_EXECUTED", () => {
    const { v } = run(makeCtx(), (_p, t) => "﻿" + t);
    expect(failing(v)).toEqual(["STRICT_JSON"]);
    expect(v.evidence.filter((e) => e.result === "NOT_EXECUTED")).toHaveLength(8);
    expect(v.ok).toBe(false);
    expect(failing(run(makeCtx(), (_p, t) => t.slice(0, -3)).v)).toContain("STRICT_JSON");
  });

  it("duplicate keys are rejected", () => {
    const { v } = run(makeCtx(), (_p, t) => t.replace('"package_version": 1', '"package_version": 1,\n  "package_version": 2'));
    expect(failing(v)).toContain("DUPLICATE_KEYS");
  });

  it("AJV schema: unknown property, missing section and wrong type fail, routed to the section's owner", () => {
    const extra = run(makeCtx(), (p) => JSON.stringify({ ...p, surprise: true }));
    expect(failing(extra.v)).toContain("JSON_SCHEMA");
    const noSection = run(makeCtx(), (p) => { delete p.sections.bpc; return JSON.stringify(p); });
    expect(noSection.v.problems.some((x) => x.check === "JSON_SCHEMA" && /bpc/.test(x.message))).toBe(true);
    const badSection = run(makeCtx(), (p) => { delete p.sections.passage.passage_id; return JSON.stringify(p); });
    const hit = badSection.v.problems.find((x) => x.check === "JSON_SCHEMA" && x.ownerRole === 2);
    expect(hit, "a schema error inside sections.passage routes to Role 2").toBeTruthy();
  });

  it("a custom (canonical-style) schema is honoured and its authority is recorded in the evidence", () => {
    const ctx = makeCtx({ schema: { authority: "CANONICAL", id: "final_package.schema.json", schema: { type: "object", required: ["nope"] } } });
    const { v } = run(ctx);
    expect(failing(v)).toContain("JSON_SCHEMA");
    expect(v.evidence.find((e) => e.check === "JSON_SCHEMA")!.validatorVersion).toMatch(/CANONICAL/);
    expect(run().v.caveats.join()).toMatch(/INTERIM_ENVELOPE/);
  });

  it("referential integrity: a dangling id is reported against the owning role; cross-passage sections are rejected", () => {
    const ctx = makeCtx();
    (ctx.sections[6].artifact as any).primaryItemId = "Q9";
    ctx.sections[6].hash = canonicalHash(ctx.sections[6].artifact);
    ctx.sections[6].currentHash = ctx.sections[6].hash;
    const { v } = run(ctx);
    const p = v.problems.find((x) => x.check === "REFERENTIAL_INTEGRITY")!;
    expect(p.message).toMatch(/dangling reference Q9/);
    expect(p.ownerRole).toBe(6);

    const other = makeCtx();
    (other.sections[3].artifact as any).passage_id = "W1-0099";
    other.sections[3].hash = canonicalHash(other.sections[3].artifact);
    other.sections[3].currentHash = other.sections[3].hash;
    const o = run(other).v.problems.find((x) => x.message.includes("cross-passage"));
    expect(o?.ownerRole).toBe(3);
  });

  it("upstream fidelity: any alteration of an approved artifact inside the package fails with role and path", () => {
    const { v } = run(makeCtx(), (p) => { p.sections.passage.body = "altered"; return JSON.stringify(p); });
    expect(failing(v)).toEqual(expect.arrayContaining(["UPSTREAM_FIDELITY", "VERSION_HASH_LOCK"]));
    expect(v.problems.find((x) => x.check === "UPSTREAM_FIDELITY")!.message).toMatch(/role 2 \(passage\) altered at \$\.body/);
  });

  it("version/hash lock: lock hash, package version and canonical hash must all match", () => {
    expect(failing(run(makeCtx(), (p) => { p.lock.role_hashes["3"] = "b".repeat(64); return JSON.stringify(p); }).v)).toContain("VERSION_HASH_LOCK");
    expect(failing(run(makeCtx(), (p) => { p.package_version = 2; return JSON.stringify(p); }).v)).toContain("VERSION_HASH_LOCK");
    expect(failing(run(makeCtx(), (p) => { p.canonical.package_hash = "c".repeat(64); return JSON.stringify(p); }).v)).toContain("VERSION_HASH_LOCK");
    expect(failing(run(makeCtx({ unitCanonicalHash: "d".repeat(64) })).v)).toContain("VERSION_HASH_LOCK");
  });

  it("current-input check: an approved hash that is no longer current is stale and routes to that role", () => {
    const ctx = makeCtx();
    ctx.sections[4].currentHash = "e".repeat(64);
    const { v } = run(ctx);
    expect(failing(v)).toContain("CURRENT_INPUTS");
    expect(v.problems.find((x) => x.check === "CURRENT_INPUTS")!.ownerRole).toBe(4);
  });

  it("QA certificates: missing, or the wrong kind (machine cert on a semantic role), fails", () => {
    const missing = makeCtx();
    missing.sections[3].certificateHash = null;
    expect(failing(run(missing).v)).toContain("QA_CERTIFICATES");
    const wrongKind = makeCtx();
    wrongKind.sections[2].qaKind = "MACHINE_DETERMINISTIC";
    const v = run(wrongKind).v;
    expect(failing(v)).toContain("QA_CERTIFICATES");
    expect(v.problems.find((x) => x.check === "QA_CERTIFICATES")!.ownerRole).toBe(2);
  });

  it("a Role 2 source defect found at final validation routes to Role 2 (Role 8 never edits it)", () => {
    const ctx = makeCtx();
    delete (ctx.sections[2].artifact as any).passage_id;
    ctx.sections[2].hash = canonicalHash(ctx.sections[2].artifact);
    ctx.sections[2].currentHash = ctx.sections[2].hash;
    const { pkg, v } = run(ctx);
    expect((pkg.sections as any).passage).toEqual(ctx.sections[2].artifact); // still byte-for-byte what was approved
    expect(v.ok).toBe(false);
    expect(v.problems.some((p) => p.ownerRole === 2)).toBe(true);
  });
});
