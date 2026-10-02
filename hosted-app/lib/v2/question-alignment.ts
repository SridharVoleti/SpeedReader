// FR-022 - Structured question alignment [FROZEN]
// Structured questions align to the approved P1->P10 comprehension progression, and scoring is
// deterministic and stored at item level (reusing the existing deterministic item scorer).

import { scoreItem, type AssessmentItem } from "../item-types";
import { structuredEvidence, type StructuredEvidence } from "./comprehension-score";

export const P_LEVEL_QUESTION_TYPES = [
  "DIRECT_RECALL",
  "SEQUENCE",
  "CAUSE_AND_EFFECT",
  "PREDICTION",
  "FEELINGS_MOTIVATION",
  "MAIN_IDEA",
  "SIMPLE_INFERENCE",
  "VOCABULARY_IN_CONTEXT",
  "JUDGMENT_APPLICATION",
  "MIXED_MASTERY"
] as const;
export type QuestionType = (typeof P_LEVEL_QUESTION_TYPES)[number];

export function questionTypeForPLevel(pLevel: number): QuestionType {
  if (!Number.isInteger(pLevel) || pLevel < 1 || pLevel > 10) throw new RangeError("P level must be an integer 1..10");
  return P_LEVEL_QUESTION_TYPES[pLevel - 1];
}

export type AlignedItem = { pLevel: number; questionType: QuestionType; item: AssessmentItem };

/** Wrap an item for a P level; the declared type is always derived from the progression. */
export function alignItem(pLevel: number, item: AssessmentItem): AlignedItem {
  return { pLevel, questionType: questionTypeForPLevel(pLevel), item };
}

/** Errors for items whose declared question type does not match their P level (e.g. loaded content). */
export function validateAlignment(items: readonly { pLevel: number; questionType: string; item: { itemId: string } }[]): string[] {
  const errors: string[] = [];
  for (const entry of items) {
    try {
      const expected = questionTypeForPLevel(entry.pLevel);
      if (entry.questionType !== expected) {
        errors.push(`${entry.item.itemId}: P${entry.pLevel} requires ${expected}, got ${entry.questionType}`);
      }
    } catch {
      errors.push(`${entry.item.itemId}: invalid P level ${entry.pLevel}`);
    }
  }
  return errors;
}

export type ItemRecord = { itemId: string; pLevel: number; questionType: QuestionType; points: number; result: string };

/** Deterministic, item-level scoring: same items + responses always give the same stored records. */
export function scoreAlignedItems(
  aligned: readonly AlignedItem[],
  responses: Readonly<Record<string, unknown>>
): { evidence: StructuredEvidence; records: ItemRecord[] } {
  const errors = validateAlignment(aligned.map((a) => ({ pLevel: a.pLevel, questionType: a.questionType, item: a.item })));
  if (errors.length) throw new Error(`misaligned structured questions: ${errors.join("; ")}`);
  const records: ItemRecord[] = aligned.map((a) => {
    const result = scoreItem(a.item, responses[a.item.itemId]);
    return { itemId: a.item.itemId, pLevel: a.pLevel, questionType: a.questionType, points: result.points, result: result.itemResult };
  });
  const evidence = structuredEvidence(records.map((r) => ({ itemId: r.itemId, score: Math.max(0, Math.min(1, r.points)) })));
  return { evidence, records };
}
