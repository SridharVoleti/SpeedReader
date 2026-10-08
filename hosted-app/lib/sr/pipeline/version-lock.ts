// SR-039 - Recompute every required canonical hash and verify the package lock and versions.

import { canonicalHash } from "./hash";
import { SECTIONS, SECTION_ROLE } from "./sections";

type Obj = Record<string, unknown>;
export type ApprovedLock = { packageVersion: number; schemaVersion: string; roleHashes: Record<string, string> };

export function verifyHashesAndVersion(pkg: Obj, approved: ApprovedLock) {
  const problems: string[] = [];
  if (pkg.packageVersion !== approved.packageVersion) problems.push(`package version ${String(pkg.packageVersion)} != locked version ${approved.packageVersion}`);
  if (pkg.schemaVersion !== approved.schemaVersion) problems.push(`schema version ${String(pkg.schemaVersion)} != locked schema version ${approved.schemaVersion}`);
  const embedded = ((pkg.lock as Obj | undefined)?.roleHashes ?? {}) as Record<string, string>;
  for (const section of SECTIONS) {
    const role = String(SECTION_ROLE[section]);
    const locked = approved.roleHashes[role];
    if (!locked) { problems.push(`role ${role} (${section}): hash missing from approved lock`); continue; }
    if (embedded[role] !== locked) problems.push(`role ${role} (${section}): package lock hash does not match approved lock`);
    if (canonicalHash(pkg[section]) !== locked) problems.push(`role ${role} (${section}): stale hash - recomputed content hash differs from lock`);
  }
  return { ok: problems.length === 0, problems };
}
