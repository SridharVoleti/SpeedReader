import { describe, expect, it } from "vitest";
import { verifyInputManifest } from "../../../lib/sr/pipeline/final-validator";
import type { RoleId } from "../../../lib/sr/pipeline/roles";

const entry = (role: RoleId, over: Record<string, unknown> = {}) => ({ role, hash: `h${role}`, qa: "PASS" as const, ...over });
const full = () => ([1, 2, 3, 4, 5, 6, 7] as RoleId[]).map((r) => entry(r));

describe("SR-033 final QA consumes every approved gate output", () => {
  const assembly = { role: 8 as RoleId, hash: "h8" };
  it("passes when the Role 8 assembly and approved Roles 1-7 are all present with QA PASS", () => {
    expect(verifyInputManifest(assembly, full())).toEqual({ ok: true, problems: [] });
  });
  it("a missing upstream artifact blocks final acceptance", () => {
    const m = full().filter((e) => e.role !== 5);
    const r = verifyInputManifest(assembly, m);
    expect(r.ok).toBe(false);
    expect(r.problems.join()).toMatch(/role 5.*missing/);
  });
  it("an upstream artifact without QA PASS blocks final acceptance, per source artifact", () => {
    const m = full().map((e) => (e.role === 3 ? entry(3, { qa: "FAIL" }) : e.role === 6 ? entry(6, { qa: "NONE" }) : e));
    const r = verifyInputManifest(assembly, m);
    expect(r.problems).toHaveLength(2);
    expect(r.problems.join()).toMatch(/role 3/);
    expect(r.problems.join()).toMatch(/role 6/);
  });
  it("the Role 8 assembly itself must be present and QA'd upstream is not enough", () => {
    expect(verifyInputManifest(undefined, full()).ok).toBe(false);
  });
  it("duplicate entries for a role are rejected", () => {
    expect(verifyInputManifest(assembly, [...full(), entry(2)]).problems.join()).toMatch(/duplicate/);
  });
  it("manifest hashes must be present", () => {
    const m = full().map((e) => (e.role === 4 ? entry(4, { hash: "" }) : e));
    expect(verifyInputManifest(assembly, m).problems.join()).toMatch(/role 4.*hash/);
  });
});
