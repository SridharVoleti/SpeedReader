// SR-002 - A previously struggled passage can be revisited for confidence without blocking the next new
// passage, and a revisit never stands in for readiness evidence.

export type RevisitState = { readonly struggled: readonly string[] };
export type Outcome = "GREEN" | "NOT_GREEN";

export const emptyRevisitState = (): RevisitState => ({ struggled: [] });

export function recordPassageOutcome(s: RevisitState, passageId: string, outcome: Outcome): RevisitState {
  const rest = s.struggled.filter((p) => p !== passageId);
  return { struggled: outcome === "NOT_GREEN" ? [...rest, passageId] : s.struggled };
}

export const revisitCandidates = (s: RevisitState): string[] => [...s.struggled];

export function scheduleRevisit(s: RevisitState, passageId: string, nextNew: string): { revisit: string; nextNew: string } {
  if (!s.struggled.includes(passageId)) throw new Error(`passage ${passageId} is not revisit-eligible`);
  return { revisit: passageId, nextNew };
}

export function completeRevisit(s: RevisitState, passageId: string, outcome: Outcome) {
  if (!s.struggled.includes(passageId)) throw new Error(`passage ${passageId} is not revisit-eligible`);
  const state: RevisitState = outcome === "GREEN" ? { struggled: s.struggled.filter((p) => p !== passageId) } : s;
  return { state, evidence: { kind: "CONFIDENCE_REVISIT" as const, passageId, outcome, countsAsReadinessEvidence: false as const } };
}
