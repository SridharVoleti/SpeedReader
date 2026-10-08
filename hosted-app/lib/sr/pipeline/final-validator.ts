// SR-033..041 - Final JSON QA: the terminal production gate. Each mandatory machine/fidelity check lives
// here and returns an evidence record; the gate promotes a package only when every check executed and passed.

import type { RoleId } from "./roles";

export type ManifestEntry = { role: RoleId; hash: string; qa: "PASS" | "FAIL" | "NONE" };

/** SR-033 - every approved gate output (Role 8 assembly + Roles 1-7 with QA PASS) must be an input. */
export function verifyInputManifest(assembly: { role: RoleId; hash: string } | undefined, upstream: readonly ManifestEntry[]) {
  const problems: string[] = [];
  if (!assembly || assembly.role !== 8 || !assembly.hash) problems.push("role 8 assembly missing from manifest");
  const seen = new Set<RoleId>();
  for (const e of upstream) {
    if (seen.has(e.role)) problems.push(`duplicate manifest entry for role ${e.role}`);
    seen.add(e.role);
  }
  for (const r of [1, 2, 3, 4, 5, 6, 7] as RoleId[]) {
    const e = upstream.find((x) => x.role === r);
    if (!e) { problems.push(`role ${r} artifact missing from manifest`); continue; }
    if (!e.hash) problems.push(`role ${r} manifest entry has no hash`);
    if (e.qa !== "PASS") problems.push(`role ${r} artifact lacks QA PASS (status ${e.qa})`);
  }
  return { ok: problems.length === 0, problems };
}
