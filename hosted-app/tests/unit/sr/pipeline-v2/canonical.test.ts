// Canonical package identity: exact SHA-256 lock, version lock, membership, freeze certification, registry validity.

import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { CanonicalError, loadCanonicalPackage } from "../../../../lib/sr/pipeline-v2/canonical";
import { loadRegistry, validateRow } from "../../../../lib/sr/pipeline-v2/registry";
import { buildCanonicalFixture, fixtureRow, FIXTURE_VERSION, sha, toCsv } from "./helpers/canonical-fixture";
import { canonicalGate } from "../../../../lib/sr/canonical-authority";

let dir: string;
let fx: ReturnType<typeof buildCanonicalFixture>;
beforeEach(() => { dir = mkdtempSync(join(tmpdir(), "sr-canon-")); fx = buildCanonicalFixture(dir); });
afterEach(() => rmSync(dir, { recursive: true, force: true }));

const code = (fn: () => unknown) => { try { fn(); } catch (e) { return (e as CanonicalError).code; } return "NO_ERROR"; };

describe("canonical package lock", () => {
  it("loads a consistent package; hash is the SHA-256 of the lock bytes", () => {
    const pkg = loadCanonicalPackage(dir, { requireFrozen: false });
    expect(pkg.version).toBe(FIXTURE_VERSION);
    expect(pkg.hash).toBe(sha(readFileSync(join(dir, fx.names.lock))));
    expect(pkg.domainArtifact("GLOBAL_RULES")).toBe(fx.names.spec);
    expect(pkg.domainArtifact("ROW_INSTANCE_VALUES")).toBe(fx.names.rows);
  });

  it("fails closed when the package directory is missing", () => {
    expect(code(() => loadCanonicalPackage(join(dir, "nope"), { requireFrozen: false }))).toBe("BLOCKED_CANONICAL_INPUT");
  });

  it("detects a tampered artifact (PACKAGE_HASH_MISMATCH)", () => {
    writeFileSync(join(dir, fx.names.spec), readFileSync(join(dir, fx.names.spec), "utf8") + "\nextra");
    expect(code(() => loadCanonicalPackage(dir, { requireFrozen: false }))).toBe("PACKAGE_HASH_MISMATCH");
  });

  it("detects a missing required artifact (BLOCKED_CANONICAL_INPUT)", () => {
    rmSync(join(dir, fx.names.mirror));
    expect(code(() => loadCanonicalPackage(dir, { requireFrozen: false }))).toBe("BLOCKED_CANONICAL_INPUT");
  });

  it("rejects a Lock/Manifest membership mismatch (PACKAGE-LOCK-SELF-1.0)", () => {
    const man = readFileSync(join(dir, fx.names.manifest), "utf8").trimEnd().split("\n");
    writeFileSync(join(dir, fx.names.manifest), man.slice(0, -1).join("\n") + "\n"); // drop a member row
    expect(code(() => loadCanonicalPackage(dir, { requireFrozen: false }))).toBe("PACKAGE_LOCK_MEMBERSHIP_MISMATCH");
  });

  it("rejects mixed package versions", () => {
    const lock = readFileSync(join(dir, fx.names.lock), "utf8").replace(FIXTURE_VERSION, "v0.98");
    writeFileSync(join(dir, fx.names.lock), lock);
    expect(code(() => loadCanonicalPackage(dir, { requireFrozen: false }))).toBe("PACKAGE_VERSION_MISMATCH");
  });

  it("will not read a file that is not a locked member", () => {
    const pkg = loadCanonicalPackage(dir, { requireFrozen: false });
    writeFileSync(join(dir, "stowaway.md"), "x");
    expect(() => pkg.readArtifact("stowaway.md")).toThrow(/not a member/);
  });
});

describe("freeze certification gate (FG-06)", () => {
  it("an uncertified candidate is flagged and refused for production use", () => {
    const pkg = loadCanonicalPackage(dir, { requireFrozen: false });
    expect(pkg.freeze.status).toBe("FREEZE_CANDIDATE_UNCERTIFIED");
    expect(code(() => loadCanonicalPackage(dir, { requireFrozen: true }))).toBe("BLOCKED_CANONICAL_INPUT");
  });

  it("a PASS + freeze=YES certification naming this lock is accepted", () => {
    rmSync(dir, { recursive: true, force: true });
    dir = mkdtempSync(join(tmpdir(), "sr-canon-"));
    buildCanonicalFixture(dir, { certified: true });
    expect(loadCanonicalPackage(dir, { requireFrozen: true }).freeze.status).toBe("FROZEN_CERTIFIED");
  });

  it("a certification that is not PASS does not freeze the package", () => {
    writeFileSync(join(dir, fx.names.cert), toCsv(["canonical_package_version", "package_lock_reference", "final_qa_status", "knowledge_map_final_freeze"], [[FIXTURE_VERSION, fx.names.lock, "FAIL", "NO"]]));
    const pkg = loadCanonicalPackage(dir, { requireFrozen: false });
    expect(pkg.freeze.status).toBe("CERTIFICATION_NOT_PASS");
  });
});

describe("registry (15 x 10 matrix, row contracts)", () => {
  it("accepts 150 rows with unique coordinates, sessions and 15 strands per round", () => {
    const reg = loadRegistry(loadCanonicalPackage(dir, { requireFrozen: false }));
    expect(reg.rows).toHaveLength(150);
    expect(new Set(reg.rows.map((r) => r.coordinate)).size).toBe(150);
    expect(reg.byId.get("W1-0001")).toMatchObject({ rs: 1, p: 1, deliverySession: 1, coordinate: "RS01-P1" });
    expect(reg.byId.get("W1-0150")).toMatchObject({ rs: 15, p: 10, deliverySession: 150, coordinate: "RS15-P10" });
  });

  it("delivery_session follows (P-1)*15+RS and sorting by it reconstructs ten RS01..RS15 rounds", () => {
    const reg = loadRegistry(loadCanonicalPackage(dir, { requireFrozen: false }));
    const bySession = [...reg.rows].sort((a, b) => a.deliverySession - b.deliverySession);
    bySession.forEach((r, i) => expect(r.rs).toBe((i % 15) + 1));
    bySession.forEach((r, i) => expect(r.p).toBe(Math.floor(i / 15) + 1));
  });

  it("a blank required field is INVALID_ROW_CONTRACT, not a guess", () => {
    expect(validateRow({ ...fixtureRow(1, 1), title: "  " }, FIXTURE_VERSION)).toEqual([expect.stringContaining("title")]);
  });

  it("a P10 row needs the P10 fields; a non-P10 row may leave them blank", () => {
    expect(validateRow(fixtureRow(1, 1), FIXTURE_VERSION)).toEqual([]);
    expect(validateRow({ ...fixtureRow(1, 10), designated_primary_item_no: "" }, FIXTURE_VERSION)).toEqual([expect.stringContaining("designated_primary_item_no")]);
  });

  it("a delivery formula mismatch is reported", () => {
    expect(validateRow({ ...fixtureRow(2, 3), delivery_session: "99" }, FIXTURE_VERSION)).toEqual([expect.stringContaining("(P-1)*15+RS")]);
  });

  it("a duplicate strand within a round is rejected", () => {
    rmSync(dir, { recursive: true, force: true });
    dir = mkdtempSync(join(tmpdir(), "sr-canon-"));
    const rows = Array.from({ length: 150 }, (_, i) => fixtureRow((i % 15) + 1, Math.floor(i / 15) + 1));
    rows[1].knowledge_strand = rows[0].knowledge_strand;
    buildCanonicalFixture(dir, { rows });
    expect(code(() => loadRegistry(loadCanonicalPackage(dir, { requireFrozen: false })))).toBe("INVALID_ROW_CONTRACT");
  });

  it("a registry with the wrong row count is rejected", () => {
    rmSync(dir, { recursive: true, force: true });
    dir = mkdtempSync(join(tmpdir(), "sr-canon-"));
    buildCanonicalFixture(dir, { rows: Array.from({ length: 149 }, (_, i) => fixtureRow((i % 15) + 1, Math.floor(i / 15) + 1)) });
    expect(code(() => loadRegistry(loadCanonicalPackage(dir, { requireFrozen: false })))).toBe("INVALID_ROW_CONTRACT");
  });
});

describe("the real v0.56 candidate package (integration; skipped when absent)", () => {
  const gate = canonicalGate();
  const real = gate.dir;
  it.skipIf(gate.skip)("verifies its own lock, has 150 valid rows, and is reported as an UNCERTIFIED candidate", () => {
    gate.assertUsable();
    console.info(gate.report);
    const pkg = loadCanonicalPackage(real, { requireFrozen: false });
    expect(pkg.version).toBe("v0.56");
    expect(pkg.freeze.status).toBe("FREEZE_CANDIDATE_UNCERTIFIED");
    expect(() => loadCanonicalPackage(real, { requireFrozen: true })).toThrow(/BLOCKED_CANONICAL_INPUT/);
    const reg = loadRegistry(pkg);
    expect(reg.rows).toHaveLength(150);
    expect(reg.byId.get("W1-0001")?.row.title).toBe("The Red Umbrella");
  });
});
