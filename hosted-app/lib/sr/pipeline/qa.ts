// SR-015.. - Independent, stage-specific QA. It validates, issues PASS/FAIL with defects routed to an
// owner, and never edits the artifact. PASS only when there are zero blockers.

import { roleById, descendants, type RoleId } from "./roles";
import { DEFECT_RECORD_PROMPT } from "./defects";
import { specFor, type Upstream } from "./role-specs";
import { checkCreatorOutput, type Envelope } from "./creator";

export type Defect = {
  defect_id: string; violated_rule: string; evidence: string; owner_role: RoleId; return_to_role: RoleId;
  affected_dependencies: RoleId[]; severity: "BLOCKER" | "NON_BLOCKING";
};
export type QaReport = { role: RoleId; verdict: "PASS" | "FAIL"; blockers: Defect[]; nonBlocking: Defect[] };

export function buildQaPrompt(id: RoleId): string {
  const r = roleById(id);
  return [
    `You are the independent QA for Role ${r.id}: ${r.name}.`,
    `Validate the ${r.owns} artifact against its contract and upstream approvals only.`,
    "Classify every finding as BLOCKER (breaks the contract) or NON_BLOCKING (minor or stylistic); only BLOCKERs fail the stage or trigger rework.",
    "Issue PASS or FAIL. PASS only with zero blockers; with zero blockers, PASS and stop - do not demand theoretical perfection.",
    "For each defect give the violated rule, exact evidence and the owner role.",
    "Do not repair, fix or edit the artifact; send defects to the owner.",
    DEFECT_RECORD_PROMPT
  ].join("\n");
}

export function runQa(id: RoleId, artifact: Envelope, approvedInputs: { role: RoleId; hash: string }[], upstream: Upstream = {}): QaReport {
  const blockers: Defect[] = [];
  const add = (rule: string, evidence: string, owner: RoleId = id) =>
    blockers.push({
      defect_id: `R${id}-D${blockers.length + 1}`, violated_rule: rule, evidence, owner_role: owner, return_to_role: owner,
      affected_dependencies: descendants(owner), severity: "BLOCKER"
    });

  for (const problem of checkCreatorOutput(id, artifact, approvedInputs).problems) add("ARTIFACT_CONTRACT", problem);
  const structurallySound = blockers.length === 0;
  if (structurallySound) for (const [rule, evidence, owner] of specFor(id).blockers(artifact.payload, upstream, approvedInputs)) add(rule, evidence, owner);

  const nonBlocking: Defect[] = structurallySound
    ? (specFor(id).advisories?.(artifact.payload) ?? []).map(([rule, ev], n) => ({
        defect_id: `R${id}-N${n + 1}`, violated_rule: rule, evidence: ev, owner_role: id, return_to_role: id,
        affected_dependencies: [], severity: "NON_BLOCKING" as const
      }))
    : [];

  return { role: id, verdict: blockers.length === 0 ? "PASS" : "FAIL", blockers, nonBlocking };
}

/** Rework is driven by blockers only: minor/stylistic findings never trigger another round. */
export const needsRework = (r: QaReport): boolean => r.blockers.length > 0;
