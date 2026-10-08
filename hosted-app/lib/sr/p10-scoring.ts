// SR-046 - P10 uses the approved 4-item blueprint with one designated primary item. Pass needs the
// minimum correct count AND (where the canonical rule applies) the primary item correct.

export const P10_RULE = Object.freeze({ itemCount: 4, minCorrect: 3, primaryRequired: true });

export type P10Item = { itemId: string; correct: boolean; primary: boolean };

export function scoreP10(items: readonly P10Item[], rule = P10_RULE) {
  if (items.length !== rule.itemCount) throw new Error(`P10 needs exactly ${rule.itemCount} items, got ${items.length}`);
  if (items.filter((i) => i.primary).length !== 1) throw new Error("P10 needs exactly one primary item");
  const correct = items.filter((i) => i.correct).length;
  const primary = items.find((i) => i.primary)!;
  if (rule.primaryRequired && !primary.correct) return { pass: false, correct, reason: "PRIMARY_ITEM_INCORRECT" as const };
  if (correct < rule.minCorrect) return { pass: false, correct, reason: "BELOW_MIN_CORRECT" as const };
  return { pass: true, correct, reason: "PASS" as const };
}
