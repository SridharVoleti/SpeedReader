import { describe, expect, it } from "vitest";
import { verifyHashesAndVersion } from "../../../lib/sr/pipeline/version-lock";
import { buildValidPackage } from "./helpers/package";
import { canonicalHash } from "../../../lib/sr/pipeline/hash";

const clone = <T,>(v: T): T => JSON.parse(JSON.stringify(v));
const lock = (pkg = buildValidPackage()) => ({ packageVersion: pkg.packageVersion as number, schemaVersion: "1.0", roleHashes: pkg.lock.roleHashes });

describe("SR-039 version and hash verification with package lock", () => {
  it("matching recomputed hashes, version and lock pass", () => {
    expect(verifyHashesAndVersion(buildValidPackage(), lock())).toEqual({ ok: true, problems: [] });
  });
  it("a stale recorded hash fails (content changed after hashing)", () => {
    const p = clone(buildValidPackage());
    p.passage.wordCount = 81;
    const r = verifyHashesAndVersion(p, lock(buildValidPackage()));
    expect(r.ok).toBe(false);
    expect(r.problems.join()).toMatch(/role 2.*stale hash/);
  });
  it("a package whose embedded lock disagrees with the approved lock fails", () => {
    const p = clone(buildValidPackage());
    p.lock.roleHashes["3"] = canonicalHash("something else");
    expect(verifyHashesAndVersion(p, lock(buildValidPackage())).problems.join()).toMatch(/role 3.*lock/);
  });
  it("a stale package version fails", () => {
    const p = clone(buildValidPackage());
    p.packageVersion = 1;
    expect(verifyHashesAndVersion(p, { ...lock(), packageVersion: 2 }).problems.join()).toMatch(/version/);
  });
  it("a schema version mismatch fails", () => {
    expect(verifyHashesAndVersion(buildValidPackage(), { ...lock(), schemaVersion: "2.0" }).problems.join()).toMatch(/schema version/);
  });
  it("a missing role hash in the lock fails", () => {
    const l = lock();
    const roleHashes = { ...l.roleHashes } as Record<string, string>;
    delete roleHashes["6"];
    expect(verifyHashesAndVersion(buildValidPackage(), { ...l, roleHashes }).problems.join()).toMatch(/role 6.*missing/);
  });
});
