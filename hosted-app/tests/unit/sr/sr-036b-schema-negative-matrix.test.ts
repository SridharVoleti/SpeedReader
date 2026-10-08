import { describe, expect, it } from "vitest";
import { validatePackageSchema, ROLE_HASH_KEYS } from "../../../lib/sr/pipeline/package-schema";
import { buildValidPackage } from "./helpers/package";

// Issue #12: every missing, extra and wrong-typed field in the canonical package must be rejected.
type J = unknown;
const clone = <T,>(v: T): T => JSON.parse(JSON.stringify(v));

/** All object nodes as [path, container-getter] pairs. */
function objectPaths(v: J, path: (string | number)[] = []): (string | number)[][] {
  if (Array.isArray(v)) return v.flatMap((x, i) => objectPaths(x, [...path, i]));
  if (v && typeof v === "object") return [path, ...Object.entries(v).flatMap(([k, x]) => objectPaths(x, [...path, k]))];
  return [];
}
const at = (root: J, path: (string | number)[]) => path.reduce((n: any, k) => n[k], root) as any;
const wrongOf = (v: J): J => (typeof v === "string" ? 42 : typeof v === "number" ? "x" : typeof v === "boolean" ? "x" : Array.isArray(v) ? {} : v && typeof v === "object" ? [] : "x");

describe("SR-036 closed canonical schema: negative matrix", () => {
  const base = buildValidPackage();
  // scoring.itemPoints is a dynamic map keyed by itemId (cross-checked against the assessment by referential integrity)
  const nodes = objectPaths(base).filter((p) => p[p.length - 1] !== "itemPoints");

  it("the baseline package is valid", () => expect(validatePackageSchema(base).ok).toBe(true));

  it("every object rejects an unexpected extra key", () => {
    for (const path of nodes) {
      const p = clone(base);
      at(p, path)["__extra"] = 1;
      expect(validatePackageSchema(p).ok, `extra key at /${path.join("/")}`).toBe(false);
    }
  });
  it("every object field rejects deletion (all canonical fields are required)", () => {
    for (const path of nodes) {
      const n = at(base, path);
      if (Array.isArray(n)) continue;
      for (const key of Object.keys(n)) {
        const p = clone(base);
        delete at(p, path)[key];
        expect(validatePackageSchema(p).ok, `missing /${[...path, key].join("/")}`).toBe(false);
      }
    }
  });
  it("every field (leaf and container) rejects a wrong type", () => {
    for (const path of nodes) {
      const n = at(base, path);
      if (Array.isArray(n)) continue;
      for (const key of Object.keys(n)) {
        const p = clone(base);
        at(p, path)[key] = wrongOf(n[key]);
        expect(validatePackageSchema(p).ok, `wrong type /${[...path, key].join("/")}`).toBe(false);
      }
    }
  });
  it("itemPoints must hold exactly one numeric entry per assessment item", () => {
    const withPoints = (f: (pts: Record<string, unknown>) => void) => { const p = clone(base) as any; f(p.scoring.itemPoints); return validatePackageSchema(p).ok; };
    expect(withPoints((pts) => { delete pts.I1; })).toBe(false);
    expect(withPoints((pts) => { pts.I9 = 1; })).toBe(false);
    expect(withPoints((pts) => { pts.I1 = "25"; })).toBe(false);
    expect(withPoints((pts) => { pts[""] = pts.I1; delete pts.I1; })).toBe(false);
  });
  it("array elements reject wrong types", () => {
    for (const path of objectPaths(base)) {
      const n = at(base, path);
      if (!Array.isArray(n)) continue;
      for (let i = 0; i < n.length; i++) {
        const p = clone(base);
        at(p, path)[i] = wrongOf(n[i]);
        expect(validatePackageSchema(p).ok, `wrong type /${[...path, i].join("/")}`).toBe(false);
      }
    }
  });
});

describe("SR-039 role hash lock: exact key set and hash format", () => {
  const withHashes = (mut: (h: Record<string, unknown>) => void) => {
    const p = clone(buildValidPackage()) as any;
    mut(p.lock.roleHashes);
    return validatePackageSchema(p);
  };
  it("requires exactly roles 1..7", () => {
    for (const k of ROLE_HASH_KEYS) expect(withHashes((h) => { delete h[k]; }).ok, `missing ${k}`).toBe(false);
    expect(withHashes((h) => { h["8"] = h["1"]; }).ok).toBe(false);
    expect(withHashes((h) => { h["spec"] = h["1"]; }).ok).toBe(false);
  });
  it("a mis-keyed lock with the right COUNT of keys is rejected", () => {
    expect(withHashes((h) => { h["x"] = h["1"]; delete h["1"]; }).ok).toBe(false);
  });
  it("hash format: 64 lowercase hex only", () => {
    for (const bad of ["abc", "G".repeat(64), "A".repeat(64), "a".repeat(63), "a".repeat(65), "", 5]) {
      expect(withHashes((h) => { h["3"] = bad; }).ok, String(bad)).toBe(false);
    }
  });
});
