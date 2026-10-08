// SR-046 - P10 uses the 4-item blueprint with one designated primary item. First-attempt mastery needs the
// minimum correct count AND the primary item correct, with every counted response committed BEFORE any hint,
// reread, answer feedback or remediation.
//
// Provenance: the numbers below are quoted from the canonical Band A specification (v0.25, "Independent
// first-attempt rule") and Requirements v2.0. That specification is still WIP in this repo (pipeline/approved
// is empty), so the rule is registered with its source and is not described as QA-approved. No pass
// "threshold percent" exists in any source and none is defined here.

export type ScoringRule = Readonly<{
  id: string; itemCount: number; minCorrect: number; primaryRequired: boolean; firstAttemptRequired: boolean; source: string;
}>;

export const P10_RULE: ScoringRule = Object.freeze({
  id: "P10_FIRST_ATTEMPT_3_OF_4_PRIMARY", itemCount: 4, minCorrect: 3, primaryRequired: true, firstAttemptRequired: true,
  source: "SpeedReader_W1_BandA_Spec_v0.25.md 'Independent first-attempt rule'; SpeedReader_Final_Frozen_Requirements_Codex_Acceptance_v2.0.md P10 mastery"
});

/** Only rules with a cited canonical source may be referenced by a scoring contract. */
export const SCORING_RULES: Readonly<Record<string, ScoringRule>> = Object.freeze({ [P10_RULE.id]: P10_RULE });

export type P10Item = {
  itemId: string; correct: boolean; primary: boolean;
  /** true only when the response was committed before any hint, reread targeting, feedback or remediation. */
  firstAttempt: boolean;
};

export function scoreP10(items: readonly P10Item[], rule: ScoringRule = P10_RULE) {
  if (items.length !== rule.itemCount) throw new Error(`P10 needs exactly ${rule.itemCount} items, got ${items.length}`);
  if (items.filter((i) => i.primary).length !== 1) throw new Error("P10 needs exactly one primary item");
  const primary = items.find((i) => i.primary)!;
  const counts = (i: P10Item) => i.correct && (!rule.firstAttemptRequired || i.firstAttempt);
  const correct = items.filter(counts).length;
  if (rule.primaryRequired && !counts(primary)) {
    const reason = primary.correct && !primary.firstAttempt ? ("NOT_FIRST_ATTEMPT" as const) : ("PRIMARY_ITEM_INCORRECT" as const);
    return { pass: false, correct, reason };
  }
  if (correct < rule.minCorrect) {
    const lost = items.some((i) => i.correct && !i.firstAttempt) && items.filter((i) => i.correct).length >= rule.minCorrect;
    return { pass: false, correct, reason: lost ? ("NOT_FIRST_ATTEMPT" as const) : ("BELOW_MIN_CORRECT" as const) };
  }
  return { pass: true, correct, reason: "PASS" as const };
}
