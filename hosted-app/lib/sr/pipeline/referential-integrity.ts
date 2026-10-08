// SR-037 - Every id in the final package must resolve in the registry of approved artifacts, and only
// within its own passage: dangling ids and ids/sections from another passage both fail.

type Obj = Record<string, unknown>;
export type PassageRegistry = { itemIds: string[]; muIds: string[]; factIds: string[] };
export type Registry = Record<string, PassageRegistry>;

/** Build the registry from approved Role 3 (assessment) and Role 4 (meaning units) payloads. */
export function buildRegistry(approved: { 3?: Obj; 4?: Obj; 5?: Obj }): Registry {
  const reg: Registry = {};
  const slot = (pid: string) => (reg[pid] ??= { itemIds: [], muIds: [], factIds: [] });
  const a = approved[3];
  if (a) slot(String(a.passageId)).itemIds.push(...((a.items as { itemId: string }[]) ?? []).map((i) => i.itemId));
  const m = approved[4];
  if (m) for (const u of (m.units as { muId: string; factIds: string[] }[]) ?? []) {
    slot(String(m.passageId)).muIds.push(u.muId);
    slot(String(m.passageId)).factIds.push(...u.factIds);
  }
  return reg;
}

export function checkReferentialIntegrity(pkg: Obj, registry: Registry) {
  const problems: string[] = [];
  const pid = String(pkg.passageId);
  const local = registry[pid];
  if (!local) problems.push(`passage ${pid} not found in approved registry`);
  for (const section of ["spec", "passage", "assessment", "meaningUnits", "bpc", "scoring", "attemptContract"]) {
    const sp = (pkg[section] as Obj | undefined)?.passageId;
    if (sp !== pid) problems.push(`cross-passage reference: ${section} belongs to ${String(sp)}, package is ${pid}`);
  }
  const dangling = (kind: string, id: string, known: string[] | undefined) => {
    if (!known?.includes(id)) problems.push(`dangling ${kind} reference ${id}`);
  };
  const scoring = pkg.scoring as { primaryItemId: string; itemPoints: Record<string, number> } | undefined;
  if (scoring) {
    dangling("item", scoring.primaryItemId, local?.itemIds);
    for (const k of Object.keys(scoring.itemPoints ?? {})) dangling("item", k, local?.itemIds);
  }
  for (const f of ((pkg.bpc as { factIds?: string[] } | undefined)?.factIds) ?? []) dangling("fact", f, local?.factIds);
  for (const u of ((pkg.meaningUnits as { units?: { muId: string }[] } | undefined)?.units) ?? []) dangling("meaning unit", u.muId, local?.muIds);
  return { ok: problems.length === 0, problems };
}
