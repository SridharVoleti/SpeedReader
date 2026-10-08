// SR-013 - Each of Roles 1-8 needs creator self-check plus a separate QA PASS before any downstream stage
// may consume its output. Pipeline state is immutable.

import { roleById, type RoleId } from "./roles";

export type QaRecord = { verdict: "PASS" | "FAIL"; qaActor: string; blockers: number };
export type StageState = { hash: string; creatorActor?: string; qa?: QaRecord };
export type Pipeline = { readonly stages: Readonly<Partial<Record<RoleId, StageState>>> };

export const newPipeline = (): Pipeline => ({ stages: {} });

const approved = (p: Pipeline, id: RoleId): boolean => p.stages[id]?.qa?.verdict === "PASS";

export function canStartRole(p: Pipeline, id: RoleId): { ok: boolean; blockedBy: RoleId[] } {
  const blockedBy = roleById(id).upstream.filter((u) => !approved(p, u));
  return { ok: blockedBy.length === 0, blockedBy };
}

export function submitCreatorOutput(p: Pipeline, id: RoleId, out: { hash: string; selfCheck: boolean; creatorActor?: string }): Pipeline {
  if (!out.selfCheck) throw new Error(`role ${id}: creator self-check is required before QA`);
  return { stages: { ...p.stages, [id]: { hash: out.hash, creatorActor: out.creatorActor } } };
}

export function recordQa(p: Pipeline, id: RoleId, qa: QaRecord): Pipeline {
  const stage = p.stages[id];
  if (!stage) throw new Error(`role ${id}: nothing to QA`);
  if (stage.creatorActor && stage.creatorActor === qa.qaActor) throw new Error(`role ${id}: QA must be independent of the creator`);
  if (qa.verdict === "PASS" && qa.blockers > 0) throw new Error(`role ${id}: PASS is invalid with ${qa.blockers} blocker(s)`);
  return { stages: { ...p.stages, [id]: { ...stage, qa } } };
}

export function consumeUpstream(p: Pipeline, consumer: RoleId, source: RoleId): { role: RoleId; hash: string } {
  if (!roleById(consumer).upstream.includes(source)) throw new Error(`role ${source} is not an upstream of role ${consumer}`);
  if (!approved(p, source)) throw new Error(`role ${consumer} cannot consume unapproved WIP from role ${source}`);
  return { role: source, hash: p.stages[source]!.hash };
}
