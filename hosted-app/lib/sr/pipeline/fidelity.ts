// SR-038 - The final package must be exactly the approved Role 1-7 artifacts: any alteration fails,
// reported with role and JSON path.

import { SECTIONS, SECTION_ROLE } from "./sections";

type Obj = Record<string, unknown>;

export function diffPaths(a: unknown, b: unknown, path = "$"): string[] {
  if (Array.isArray(a) && Array.isArray(b)) {
    const out: string[] = [];
    for (let i = 0; i < Math.max(a.length, b.length); i++) out.push(...diffPaths(a[i], b[i], `${path}[${i}]`));
    return out;
  }
  if (a && b && typeof a === "object" && typeof b === "object" && !Array.isArray(a) && !Array.isArray(b)) {
    const o1 = a as Obj, o2 = b as Obj;
    return [...new Set([...Object.keys(o1), ...Object.keys(o2)])].flatMap((k) => diffPaths(o1[k], o2[k], `${path}.${k}`));
  }
  return Object.is(a, b) ? [] : [path];
}

export function checkUpstreamFidelity(pkg: Obj, approved: Partial<Record<number, Obj>>) {
  const problems: string[] = [];
  for (const section of SECTIONS) {
    const role = SECTION_ROLE[section];
    const source = approved[role];
    if (!source) { problems.push(`role ${role} (${section}): no approved artifact to compare against`); continue; }
    for (const path of diffPaths(source, pkg[section])) problems.push(`role ${role} (${section}) altered at ${path}`);
  }
  return { ok: problems.length === 0, problems };
}
