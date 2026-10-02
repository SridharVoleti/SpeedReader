// FR-039 and section 19 - Supersession register [FROZEN]
// Any older rule that makes oral/News Reader performance a mandatory gate for core reading progression
// or core World progression is SUPERSEDED: oral communication belongs to the parallel News Reader track.
// This register records every superseded historical rule so a later change cannot silently restore one.

export type Supersession = { id: string; historical: string; replacement: string };

export const SUPERSESSION_REGISTER: readonly Supersession[] = Object.freeze([
  { id: "SUP-01", historical: "Age-group passage libraries", replacement: "Content-difficulty Worlds; all learners start World 1" },
  { id: "SUP-02", historical: "Two green lights for WPM (comprehension + oral)", replacement: "Comprehension only" },
  { id: "SUP-03", historical: "Oral/News Reader blocks core reading progress", replacement: "News Reader is a parallel oral communication track" },
  { id: "SUP-04", historical: "Stable success across generic 3-5 sessions", replacement: "First-five 4/5, then 3 consecutive GREEN" },
  { id: "SUP-05", historical: "-1 WPM after poor performance", replacement: "Earned WPM is never removed" },
  { id: "SUP-06", historical: "-1 WPM after 0/5 or after ten attempts", replacement: "Familiar confidence practice at current WPM" },
  { id: "SUP-07", historical: "Familiar passage can prove progress", replacement: "New passages prove progress; earlier passages practise progress" },
  { id: "SUP-08", historical: "Learner sees score/pass/fail", replacement: "Numeric score/state internal only" },
  { id: "SUP-09", historical: "Best answer = answer key/paraphrase", replacement: "Story-style Best Possible Comprehension" },
  { id: "SUP-10", historical: "Direct 100->200 stamina transition", replacement: "25-word stamina staircase" },
  { id: "SUP-11", historical: "Simultaneous speed + length jump", replacement: "Length first; no same-passage double jump" },
  { id: "SUP-12", historical: "\"Graduated\" terminology", replacement: "\"You Levelled Up!\"" },
  { id: "SUP-13", historical: "Core Level may mix dimensions", replacement: "Core Level Up = +1 WPM" },
  { id: "SUP-14", historical: "Runtime-generated readiness-critical form", replacement: "Pre-generated independently QA-approved equivalent form" }
]);

export function supersededRuleFor(id: string): Supersession | undefined {
  return SUPERSESSION_REGISTER.find((s) => s.id === id);
}

/** The only gate on a core WPM Level Up. */
export const CORE_WPM_GATES = ["COMPREHENSION"] as const;

/** Signals that may never be a gate on core reading or core World progression (FR-012, FR-035, FR-039, FR-043). */
export const FORBIDDEN_CORE_GATES: readonly string[] = Object.freeze([
  "ORAL", "ORAL_QUALITY", "NEWS_READER", "PRONUNCIATION", "DELIVERY", "INTONATION", "CONFIDENCE", "FLUENCY"
]);

/** Throws if a proposed gate list makes oral/News Reader performance a core gate. */
export function assertNoOralGate(gates: readonly string[]): void {
  const offending = gates.filter((g) => FORBIDDEN_CORE_GATES.includes(g.toUpperCase()));
  if (offending.length) {
    throw new Error(`oral/News Reader gate(s) ${offending.join(", ")} are SUPERSEDED for core progression (FR-039)`);
  }
}
