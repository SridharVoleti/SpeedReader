// Canonical authority contract (issue #31). One portable, explicit way for Pipeline V2 and the V3 readiness conformance tests to
// locate and verify the canonical Band A package. Nothing here hard-codes a personal filesystem path, and nothing here approves
// a candidate: the pinned identity below records WHICH package the tests compare against and its status as the package reports it.
//
//   SR_CANONICAL_DIR=<dir>    explicit location (preferred); otherwise <repo>/canonical (gitignored, documented in the README)
//   SR_REQUIRE_CANONICAL=1    release / CI validation: missing or unverified canonical input FAILS (never silently skips)
//   SR_RELEASE_GATE=1         same as SR_REQUIRE_CANONICAL=1
//
// Without either flag (local development) a missing package is an explicit, reported skip.

import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";

export type CanonicalAuthority = {
  readonly version: string;
  /** Package Lock file inside the package; its sha256 identifies the whole package (it lists every artifact hash). */
  readonly lockFile: string;
  readonly lockSha256: string;
  readonly rsModelFile: string;
  /** Status as the package itself reports it. FREEZE_CANDIDATE_UNCERTIFIED = not an approved canonical package. */
  readonly status: "FREEZE_CANDIDATE_UNCERTIFIED" | "FROZEN_CERTIFIED";
};

export const CANONICAL_AUTHORITY: CanonicalAuthority = {
  version: "v0.56",
  lockFile: "SpeedReader_W1_BandA_Package_Lock_v0.56.csv",
  lockSha256: "5c1c085ed223e7292c58e9831449a539cc65139571bb37a3388ea7232bee5eda",
  rsModelFile: "SpeedReader_W1_BandA_RS_Model_v0.56.csv",
  status: "FREEZE_CANDIDATE_UNCERTIFIED"
};

export type Env = Record<string, string | undefined>;

export function resolveCanonicalDir(env: Env = process.env, repoRoot: string = resolve(__dirname, "../../..")): string {
  return env.SR_CANONICAL_DIR ? env.SR_CANONICAL_DIR : join(repoRoot, "canonical");
}

export type CanonicalGate = {
  dir: string;
  available: boolean;
  verified: boolean;
  required: boolean;
  /** true only in optional (local) mode when the package is absent: the caller should skip, visibly */
  skip: boolean;
  version: string;
  status: CanonicalAuthority["status"];
  lockSha256: string | null;
  problem: string | null;
  report: string;
  /** Throws a clear error unless the package is present, verified against the pin. */
  assertUsable(): void;
};

export function canonicalGate(env: Env = process.env, opts: { authority?: CanonicalAuthority; repoRoot?: string } = {}): CanonicalGate {
  const authority = opts.authority ?? CANONICAL_AUTHORITY;
  const dir = resolveCanonicalDir(env, opts.repoRoot);
  const required = env.SR_REQUIRE_CANONICAL === "1" || env.SR_RELEASE_GATE === "1";
  const lockPath = join(dir, authority.lockFile);
  const available = existsSync(lockPath);
  let actual: string | null = null;
  let problem: string | null = null;
  if (!available) {
    problem = `canonical package ${authority.version} not found (looked for ${authority.lockFile} in ${dir}); set SR_CANONICAL_DIR to the approved package directory`;
  } else {
    actual = createHash("sha256").update(readFileSync(lockPath)).digest("hex");
    if (actual !== authority.lockSha256) problem = `canonical package hash mismatch: pinned ${authority.lockSha256}, found ${actual} in ${dir}`;
  }
  const verified = available && problem === null;
  const report = `canonical authority ${authority.version} (${authority.status}); pinned lock sha256 ${authority.lockSha256}; ` +
    (available ? `found sha256 ${actual} at ${dir}` : `NOT FOUND at ${dir}`) + (required ? "; REQUIRED" : "; optional");
  return {
    dir, available, verified, required, skip: !available && !required, version: authority.version, status: authority.status,
    lockSha256: actual, problem, report,
    assertUsable() {
      if (verified) return;
      if (!available) throw new Error(`canonical authority is required but unavailable: ${problem}`);
      throw new Error(`canonical authority failed verification: ${problem}`);
    }
  };
}
