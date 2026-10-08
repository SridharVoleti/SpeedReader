// SR-032 - When authorities (Knowledge Map, schema, ...) contradict each other, agents do not resolve it:
// the conflict is escalated with the exact citations and blocks release. No precedence is invented here.

export type Citation = { source: string; ref: string; ruleKey: string; value: string };
export type Escalation = {
  ruleKey: string;
  citations: { source: string; ref: string; value: string }[];
  status: "ESCALATED_TO_HUMAN";
  agentMayResolve: false;
};

export function detectAuthorityConflicts(citations: readonly Citation[]): Escalation[] {
  const byRule = new Map<string, Citation[]>();
  for (const c of citations) byRule.set(c.ruleKey, [...(byRule.get(c.ruleKey) ?? []), c]);
  const out: Escalation[] = [];
  for (const [ruleKey, cs] of byRule) {
    if (new Set(cs.map((c) => c.value)).size > 1) {
      out.push({ ruleKey, citations: cs.map(({ source, ref, value }) => ({ source, ref, value })), status: "ESCALATED_TO_HUMAN", agentMayResolve: false });
    }
  }
  return out;
}

export function releaseDecision(open: readonly Escalation[]): { release: true } | { release: false; reason: "AUTHORITY_CONFLICT"; escalations: readonly Escalation[] } {
  return open.length === 0 ? { release: true } : { release: false, reason: "AUTHORITY_CONFLICT", escalations: open };
}
