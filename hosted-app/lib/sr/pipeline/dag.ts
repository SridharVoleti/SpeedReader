// SR-031 - Dependency-aware invalidation: a correction to one artifact clears QA only for that artifact
// and its descendants in the role DAG; every unrelated approved artifact keeps its PASS.

import { descendants, type RoleId } from "./roles";
import type { Pipeline, StageState } from "./gates";

export function applyCorrection(p: Pipeline, role: RoleId, newHash: string): Pipeline {
  const current = p.stages[role];
  if (!current || current.hash === newHash) return p;
  const stages: Partial<Record<RoleId, StageState>> = { ...p.stages, [role]: { hash: newHash, creatorActor: current.creatorActor } };
  for (const d of descendants(role)) {
    const s = p.stages[d];
    if (s) stages[d] = { hash: s.hash, creatorActor: s.creatorActor };
  }
  return { stages };
}

/** Roles holding an artifact that lacks a current QA PASS and so needs (re)validation. */
export function staleRoles(p: Pipeline): RoleId[] {
  return (Object.keys(p.stages).map(Number) as RoleId[]).filter((r) => p.stages[r]?.qa?.verdict !== "PASS").sort((a, b) => a - b);
}
