import { createHash } from "node:crypto";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { CANONICAL_AUTHORITY, canonicalGate, resolveCanonicalDir } from "../../../lib/sr/canonical-authority";
import { DEFAULT_CANONICAL_DIR, resolveConfig } from "../../../lib/sr/pipeline-v2/config";

// Issue #31: portable, explicit canonical-input contract shared by Pipeline V2 and the V3 readiness conformance tests.
const sha = (b: string) => createHash("sha256").update(b).digest("hex");
let dir: string;
beforeEach(() => { dir = mkdtempSync(join(tmpdir(), "sr-auth-")); });
afterEach(() => rmSync(dir, { recursive: true, force: true }));

const lockText = "canonical_package_version,artifact\nv0.56,x.csv\n";
const authority = { version: "v0.56", lockFile: "Lock.csv", lockSha256: sha(lockText), rsModelFile: "RS.csv", status: "FREEZE_CANDIDATE_UNCERTIFIED" as const };
const pkg = (lock = lockText) => { writeFileSync(join(dir, "Lock.csv"), lock); writeFileSync(join(dir, "RS.csv"), "rs"); return dir; };

describe("canonical authority resolution and verification (#31)", () => {
  it("is pinned explicitly: version, status and the package-lock sha256 are recorded in the repository", () => {
    expect(CANONICAL_AUTHORITY.version).toBe("v0.56");
    expect(CANONICAL_AUTHORITY.lockSha256).toMatch(/^[0-9a-f]{64}$/);
    expect(CANONICAL_AUTHORITY.status).toBe("FREEZE_CANDIDATE_UNCERTIFIED");               // not claimed as approved
  });

  it("resolves SR_CANONICAL_DIR first, then a repository-relative ./canonical, never a personal absolute path", () => {
    expect(resolveCanonicalDir({ SR_CANONICAL_DIR: "/x/y" }, "/repo")).toBe("/x/y");
    expect(resolveCanonicalDir({}, "/repo").split("\\").join("/")).toBe("/repo/canonical");
    expect(DEFAULT_CANONICAL_DIR).not.toMatch(/SpeedReader_CC/);
    expect(resolveConfig({ root: dir }).canonicalDir).not.toMatch(/SpeedReader_CC/);
  });

  it("available + verified when the lock hash matches the pin; the report records version and hashes", () => {
    const g = canonicalGate({ SR_CANONICAL_DIR: pkg() }, { authority, repoRoot: dir });
    expect(g).toMatchObject({ available: true, verified: true, skip: false, version: "v0.56", lockSha256: authority.lockSha256 });
    expect(g.report).toMatch(/v0\.56/);
    expect(g.report).toContain(authority.lockSha256);
  });

  it("a package whose lock hash differs from the pin is rejected even when present", () => {
    const g = canonicalGate({ SR_CANONICAL_DIR: pkg("tampered") }, { authority, repoRoot: dir });
    expect(g).toMatchObject({ available: true, verified: false, skip: false });
    expect(g.problem).toMatch(/hash/i);
  });

  it("missing input: optional mode skips explicitly; required mode (SR_REQUIRE_CANONICAL=1) fails clearly", () => {
    const optional = canonicalGate({ SR_CANONICAL_DIR: join(dir, "absent") }, { authority, repoRoot: dir });
    expect(optional).toMatchObject({ available: false, required: false, skip: true });
    expect(optional.problem).toMatch(/SR_CANONICAL_DIR/);
    const required = canonicalGate({ SR_CANONICAL_DIR: join(dir, "absent"), SR_REQUIRE_CANONICAL: "1" }, { authority, repoRoot: dir });
    expect(required).toMatchObject({ available: false, required: true, skip: false });
    expect(() => required.assertUsable()).toThrow(/canonical authority is required but unavailable/i);
  });

  it("CI=true with GITHUB_REF on a release branch requires canonical input", () => {
    const g = canonicalGate({ SR_CANONICAL_DIR: join(dir, "absent"), SR_RELEASE_GATE: "1" }, { authority, repoRoot: dir });
    expect(g.required).toBe(true);
  });

  it("an unverified present package cannot pass assertUsable", () => {
    const g = canonicalGate({ SR_CANONICAL_DIR: pkg("tampered") }, { authority, repoRoot: dir });
    expect(() => g.assertUsable()).toThrow(/hash/i);
  });
});

describe("no test or library hard-codes the personal canonical package path (#31)", () => {
  it("scans lib and tests", async () => {
    const { readdirSync, readFileSync, statSync } = await import("node:fs");
    const hits: string[] = [];
    const walk = (d: string) => {
      for (const f of readdirSync(d)) {
        const p = join(d, f);
        if (statSync(p).isDirectory()) { if (f !== "node_modules") walk(p); continue; }
        if (!/\.(ts|mjs)$/.test(f) || p.endsWith("canonical-authority.test.ts")) continue;
        if (/SpeedReader_CC/.test(readFileSync(p, "utf8"))) hits.push(p);
      }
    };
    walk(join(__dirname, "../../../lib"));
    walk(join(__dirname, ".."));
    expect(hits).toEqual([]);
  });
});
