// Canonical package loader and hash lock. The canonical authority is the version-locked package
// (Spec v0.56 "Canonical authority declaration"): GLOBAL_RULES (spec md) + ROW_INSTANCE_VALUES (row contracts)
// + PACKAGE_IDENTITY (package lock). This module verifies identity only; it never interprets curriculum rules.
//
// Fail-closed: anything missing, mixed-version or hash-mismatched is a CanonicalError with the spec's own code.
// A package that is a FINAL_FREEZE_CANDIDATE without a PASS independent-QA certification (FG-06) is
// FREEZE_CANDIDATE_UNCERTIFIED and cannot be used for production unless the caller explicitly opts in.

import { createHash } from "node:crypto";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { parseCsv, type CsvRow } from "./csv";

export type CanonicalErrorCode =
  | "BLOCKED_CANONICAL_INPUT"
  | "PACKAGE_HASH_MISMATCH"
  | "PACKAGE_VERSION_MISMATCH"
  | "PACKAGE_LOCK_MEMBERSHIP_MISMATCH"
  | "INVALID_CANONICAL_PACKAGE"
  | "INVALID_ROW_CONTRACT";

export class CanonicalError extends Error {
  constructor(public code: CanonicalErrorCode, public details: string[]) {
    super(`${code}: ${details.join("; ")}`);
    this.name = "CanonicalError";
  }
}

export const CANONICAL_PACKAGE_ID = "SPEEDREADER-W1-BANDA-CANONICAL";
export type FreezeStatus = "FROZEN_CERTIFIED" | "FREEZE_CANDIDATE_UNCERTIFIED" | "CERTIFICATION_NOT_PASS";

export type LockedArtifact = { name: string; authorityDomain: string; required: boolean; sha256: string; bytes: number; present: boolean };
export type CanonicalPackage = {
  id: string;
  version: string;
  dir: string;
  /** SHA-256 of the Package Lock bytes: the PACKAGE_IDENTITY root of trust that pins every other member. */
  hash: string;
  lockFile: string;
  freeze: { status: FreezeStatus; evidence: string };
  artifacts: LockedArtifact[];
  readArtifact(name: string): Buffer;
  readArtifactText(name: string): string;
  readCsv(name: string): CsvRow[];
  /** name of the single artifact owning an authority domain (GLOBAL_RULES / ROW_INSTANCE_VALUES) */
  domainArtifact(domain: "GLOBAL_RULES" | "ROW_INSTANCE_VALUES"): string;
};

export type LoadOptions = {
  /** production use requires an independent-QA PASS freeze certification; false allows a clearly flagged candidate */
  requireFrozen: boolean;
};

const sha256 = (b: Buffer | string) => createHash("sha256").update(b).digest("hex");

function findOne(dir: string, re: RegExp, what: string): string {
  const hits = existsSync(dir) ? readdirSync(dir).filter((f) => re.test(f)) : [];
  if (hits.length !== 1) throw new CanonicalError("BLOCKED_CANONICAL_INPUT", [`expected exactly one ${what} in ${dir}, found ${hits.length}`]);
  return hits[0];
}

export function loadCanonicalPackage(dir: string, opts: LoadOptions): CanonicalPackage {
  if (!existsSync(dir)) throw new CanonicalError("BLOCKED_CANONICAL_INPUT", [`canonical package directory not found: ${dir}`]);
  const lockFile = findOne(dir, /_Package_Lock_v[\d.]+\.csv$/, "Package Lock");
  const manifestFile = findOne(dir, /_Package_Manifest_v[\d.]+\.csv$/, "Package Manifest");
  const lockBytes = readFileSync(join(dir, lockFile));
  const lockRows = parseCsv(lockBytes.toString("utf8"));
  const manifestRows = parseCsv(readFileSync(join(dir, manifestFile), "utf8"));
  if (!lockRows.length) throw new CanonicalError("INVALID_CANONICAL_PACKAGE", ["Package Lock has no rows"]);

  const versions = new Set(lockRows.map((r) => r.canonical_package_version).concat(manifestRows.map((r) => r.canonical_package_version)));
  if (versions.size !== 1) throw new CanonicalError("PACKAGE_VERSION_MISMATCH", [`mixed package versions: ${[...versions].join(", ")}`]);
  const version = [...versions][0];

  const versionErrors: string[] = [];
  for (const m of manifestRows) if (!m.artifact.includes(`_${version}.`)) versionErrors.push(`${m.artifact}: filename does not encode ${version}`);
  if (versionErrors.length) throw new CanonicalError("PACKAGE_VERSION_MISMATCH", versionErrors);

  // PACKAGE-LOCK-SELF-1.0: Manifest = Lock rows + exactly the Lock file itself
  const lockNames = lockRows.map((r) => r.artifact);
  const manifestNames = manifestRows.map((r) => r.artifact);
  const dupLock = lockNames.filter((n, i) => lockNames.indexOf(n) !== i);
  const lockSet = new Set(lockNames);
  const manifestSet = new Set(manifestNames);
  const membership: string[] = [];
  if (dupLock.length) membership.push(`Lock lists artifacts more than once: ${[...new Set(dupLock)].join(", ")}`);
  if (lockSet.has(lockFile)) membership.push("Package Lock must not contain a row for itself");
  if (!manifestSet.has(lockFile)) membership.push("Manifest has no row for the Package Lock");
  for (const n of manifestNames) if (n !== lockFile && !lockSet.has(n)) membership.push(`Manifest artifact missing from Lock: ${n}`);
  for (const n of lockNames) if (!manifestSet.has(n)) membership.push(`Lock artifact absent from Manifest: ${n}`);
  if (membership.length) throw new CanonicalError("PACKAGE_LOCK_MEMBERSHIP_MISMATCH", membership);

  const artifacts: LockedArtifact[] = lockRows.map((r) => ({
    name: r.artifact, authorityDomain: r.authority_domain, required: r.required_in_package === "YES",
    sha256: r.sha256, bytes: Number(r.bytes), present: existsSync(join(dir, r.artifact))
  }));
  const missing: string[] = [];
  const mismatched: string[] = [];
  for (const a of artifacts) {
    if (!a.present) {
      if (a.required) missing.push(`${a.name}: required artifact is missing`);
      continue;
    }
    const buf = readFileSync(join(dir, a.name));
    if (buf.length !== a.bytes) mismatched.push(`${a.name}: byte count ${buf.length} != locked ${a.bytes}`);
    if (sha256(buf) !== a.sha256) mismatched.push(`${a.name}: sha256 differs from the Package Lock`);
  }
  if (mismatched.length) throw new CanonicalError("PACKAGE_HASH_MISMATCH", [...mismatched, ...missing]);
  if (missing.length) throw new CanonicalError("BLOCKED_CANONICAL_INPUT", missing);

  const domainArtifact = (domain: "GLOBAL_RULES" | "ROW_INSTANCE_VALUES"): string => {
    const hits = artifacts.filter((a) => a.authorityDomain === domain && a.present);
    if (hits.length !== 1) throw new CanonicalError("BLOCKED_CANONICAL_INPUT", [`expected exactly one ${domain} artifact, found ${hits.length}`]);
    return hits[0].name;
  };
  domainArtifact("GLOBAL_RULES");
  domainArtifact("ROW_INSTANCE_VALUES");

  const freeze = freezeStatus(dir, version, lockFile);
  if (opts.requireFrozen && freeze.status !== "FROZEN_CERTIFIED") {
    throw new CanonicalError("BLOCKED_CANONICAL_INPUT", [`canonical package ${version} is not a certified freeze (${freeze.status}): ${freeze.evidence}`]);
  }

  const read = (name: string): Buffer => {
    if (!lockSet.has(name)) throw new CanonicalError("BLOCKED_CANONICAL_INPUT", [`${name} is not a member of the locked package`]);
    return readFileSync(join(dir, name));
  };
  return {
    id: CANONICAL_PACKAGE_ID, version, dir, hash: sha256(lockBytes), lockFile, freeze, artifacts,
    readArtifact: read,
    readArtifactText: (n) => read(n).toString("utf8"),
    readCsv: (n) => parseCsv(read(n).toString("utf8")),
    domainArtifact
  };
}

function freezeStatus(dir: string, version: string, lockFile: string): { status: FreezeStatus; evidence: string } {
  const certName = readdirSync(dir).find((f) => /_Independent_QA_Final_Certification_v[\d.]+\.csv$/.test(f) && !/Template/.test(f));
  if (!certName) return { status: "FREEZE_CANDIDATE_UNCERTIFIED", evidence: `no Independent_QA_Final_Certification_${version}.csv (FG-06) is present` };
  const rows = parseCsv(readFileSync(join(dir, certName), "utf8"));
  const ok = rows.length === 1 && rows[0].final_qa_status === "PASS" && rows[0].knowledge_map_final_freeze === "YES"
    && rows[0].canonical_package_version === version && rows[0].package_lock_reference === lockFile;
  return ok
    ? { status: "FROZEN_CERTIFIED", evidence: certName }
    : { status: "CERTIFICATION_NOT_PASS", evidence: `${certName} does not record final_qa_status=PASS and knowledge_map_final_freeze=YES for ${lockFile}` };
}
