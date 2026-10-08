// Role 1 is deterministic code: canonical registry row -> PASSAGE_SPEC. No LLM, no guessing.

import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { existsSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { loadCanonicalPackage, CanonicalError } from "../../../../lib/sr/pipeline-v2/canonical";
import { loadRegistry } from "../../../../lib/sr/pipeline-v2/registry";
import { buildPassageSpec, verifyPassageSpec } from "../../../../lib/sr/pipeline-v2/role1";
import { canonicalHash } from "../../../../lib/sr/pipeline/hash";
import { buildCanonicalFixture } from "./helpers/canonical-fixture";

let dir: string;
beforeEach(() => { dir = mkdtempSync(join(tmpdir(), "sr-r1-")); buildCanonicalFixture(dir); });
afterEach(() => rmSync(dir, { recursive: true, force: true }));
const load = () => { const pkg = loadCanonicalPackage(dir, { requireFrozen: false }); return { pkg, reg: loadRegistry(pkg) }; };

describe("Role 1 - deterministic passage specification", () => {
  it("derives the spec from the canonical row: identity, coordinates, target rule and verbatim row values", () => {
    const { pkg, reg } = load();
    const spec = buildPassageSpec(pkg, reg, "W1-0016");
    expect(spec).toMatchObject({
      artifact_type: "PASSAGE_SPEC", passage_id: "W1-0016", registry_coordinate: "RS02-P6", rs: 2, p: 6,
      delivery_session: 77, delivery_round: 6, round_position: 2, target_words: 100, count_model_version: "COUNT-100-v2.0",
      is_p10_readiness_form: false
    });
    expect(spec.row.title).toBe(reg.byId.get("W1-0016")!.row.title);
    expect(spec.canonical).toMatchObject({ package_id: pkg.id, package_version: pkg.version, package_hash: pkg.hash });
  });

  it("is deterministic: the same canonical input yields byte-identical output and hash", () => {
    const { pkg, reg } = load();
    const a = buildPassageSpec(pkg, reg, "W1-0001");
    const b = buildPassageSpec(pkg, reg, "W1-0001");
    expect(JSON.stringify(a)).toBe(JSON.stringify(b));
    expect(canonicalHash(a)).toBe(canonicalHash(b));
  });

  it("marks P10 rows as readiness forms and carries the P10 fields without altering them", () => {
    const { pkg, reg } = load();
    const spec = buildPassageSpec(pkg, reg, "W1-0010"); // RS01-P10
    expect(spec.is_p10_readiness_form).toBe(true);
    expect(spec.row.designated_primary_item_no).toBe(reg.byId.get("W1-0010")!.row.designated_primary_item_no);
  });

  it("does not guess: an unknown passage id is BLOCKED_CANONICAL_INPUT", () => {
    const { pkg, reg } = load();
    try { buildPassageSpec(pkg, reg, "W1-9999"); expect.unreachable(); } catch (e) { expect((e as CanonicalError).code).toBe("BLOCKED_CANONICAL_INPUT"); }
  });

  it("hashes the canonical row bytes so a later canonical change is detectable", () => {
    const { pkg, reg } = load();
    const spec = buildPassageSpec(pkg, reg, "W1-0001");
    expect(spec.canonical.row_sha256).toMatch(/^[0-9a-f]{64}$/);
    const other = buildPassageSpec(pkg, reg, "W1-0002");
    expect(other.canonical.row_sha256).not.toBe(spec.canonical.row_sha256);
  });

  it("independent verification passes for a correct spec and flags any alteration", () => {
    const { pkg, reg } = load();
    const spec = buildPassageSpec(pkg, reg, "W1-0001");
    expect(verifyPassageSpec(spec, pkg, reg)).toEqual({ ok: true, problems: [] });
    const tampered = JSON.parse(JSON.stringify(spec));
    tampered.target_words = 120;
    tampered.row.title = "Changed";
    const r = verifyPassageSpec(tampered, pkg, reg);
    expect(r.ok).toBe(false);
    expect(r.problems.join("\n")).toMatch(/target_words/);
    expect(r.problems.join("\n")).toMatch(/row\.title/);
  });

  it("verification rejects a spec built against a different canonical package hash", () => {
    const { pkg, reg } = load();
    const spec = buildPassageSpec(pkg, reg, "W1-0001");
    const stale = { ...spec, canonical: { ...spec.canonical, package_hash: "0".repeat(64) } };
    expect(verifyPassageSpec(stale, pkg, reg).problems.join()).toMatch(/package_hash/);
  });
});

describe("Role 1 against the real v0.56 candidate package (skipped when absent)", () => {
  const real = process.env.SR_CANONICAL_DIR ?? "D:\\Sridhar\\Projects\\SpeedReader_CC\\SpeedReader_W1_BandA_v0.56_FINAL_FREEZE_CANDIDATE_FULL_PACKAGE";
  it.skipIf(!existsSync(real))("produces a verified spec for RS01-P1 and an RS15-P10 readiness form", () => {
    const pkg = loadCanonicalPackage(real, { requireFrozen: false });
    const reg = loadRegistry(pkg);
    const one = buildPassageSpec(pkg, reg, "W1-0001");
    expect(one).toMatchObject({ registry_coordinate: "RS01-P1", delivery_session: 1, is_p10_readiness_form: false });
    expect(verifyPassageSpec(one, pkg, reg).ok).toBe(true);
    const last = buildPassageSpec(pkg, reg, "W1-0150");
    expect(last).toMatchObject({ registry_coordinate: "RS15-P10", delivery_session: 150, is_p10_readiness_form: true });
    expect(verifyPassageSpec(last, pkg, reg).ok).toBe(true);
  });
});
