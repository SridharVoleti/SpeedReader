// SR-012 / SR-013 - The eight production roles. The frozen Knowledge Map is the authority; readiness is a
// runtime behaviour traced to it, not an artifact any role authors (there is no ninth lifecycle author).

export type RoleId = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8;
export type Role = { id: RoleId; name: string; owns: string; upstream: readonly RoleId[] };

export const ROLES: readonly Role[] = Object.freeze([
  { id: 1, name: "Passage Specification", owns: "PASSAGE_SPEC", upstream: [] },
  { id: 2, name: "Passage Authoring", owns: "PASSAGE_TEXT", upstream: [1] },
  { id: 3, name: "Assessment Authoring", owns: "ASSESSMENT", upstream: [1, 2] },
  { id: 4, name: "Meaning Units", owns: "MEANING_UNITS", upstream: [2] },
  { id: 5, name: "Best Possible Comprehension", owns: "BPC", upstream: [2, 4] },
  { id: 6, name: "Scoring Contract", owns: "SCORING_CONTRACT", upstream: [3, 4] },
  { id: 7, name: "Attempt Outcome Contract", owns: "ATTEMPT_CONTRACT", upstream: [6] },
  { id: 8, name: "Final JSON Assembly", owns: "FINAL_PACKAGE", upstream: [1, 2, 3, 4, 5, 6, 7] }
] as Role[]);

/** Runtime readiness behaviour -> canonical Knowledge Map acceptance criterion. */
export const READINESS_TRACE: readonly { module: string; canonicalAc: string }[] = Object.freeze([
  { module: "hosted-app/lib/sr/separate-gates.ts", canonicalAc: "AC-36" },
  { module: "hosted-app/lib/sr/non-blocking.ts", canonicalAc: "AC-36" },
  { module: "hosted-app/lib/sr/separate-gates.ts", canonicalAc: "AC-42" },
  { module: "hosted-app/lib/sr/p10-scoring.ts", canonicalAc: "AC-17" },
  { module: "hosted-app/lib/sr/semantic-recall.ts", canonicalAc: "AC-21" },
  { module: "hosted-app/lib/sr/model-answer-support.ts", canonicalAc: "AC-19" },
  { module: "hosted-app/lib/sr/inactivity.ts", canonicalAc: "AC-44" }
]);

export const roleById = (id: RoleId): Role => {
  const r = ROLES.find((x) => x.id === id);
  if (!r) throw new Error(`unknown role ${id}`);
  return r;
};

/** Every role that directly or transitively depends on `id`, ascending. */
export function descendants(id: RoleId): RoleId[] {
  const out = new Set<RoleId>();
  const walk = (cur: RoleId) => {
    for (const r of ROLES) if (r.upstream.includes(cur) && !out.has(r.id)) { out.add(r.id); walk(r.id); }
  };
  walk(id);
  return [...out].sort((a, b) => a - b);
}
