import { describe, expect, it } from "vitest";
import {
  P_LEVEL_QUESTION_TYPES, alignItem, questionTypeForPLevel, scoreAlignedItems, validateAlignment
} from "../../../lib/v2/question-alignment";
import type { AssessmentItem } from "../../../lib/item-types";

const choice = (itemId: string, correct = "a"): AssessmentItem => ({
  itemId, itemType: "single_choice", constructId: "detail", mandatory: true, prompt: "Q?",
  options: [{ id: "a", label: "A" }, { id: "b", label: "B" }], correctOptionId: correct
} as AssessmentItem);

// FR-022 - Structured question alignment [FROZEN]
describe("FR-022 structured question alignment to P1-P10", () => {
  it("defines the ten approved question types in order", () => {
    expect(P_LEVEL_QUESTION_TYPES).toEqual([
      "DIRECT_RECALL", "SEQUENCE", "CAUSE_AND_EFFECT", "PREDICTION", "FEELINGS_MOTIVATION",
      "MAIN_IDEA", "SIMPLE_INFERENCE", "VOCABULARY_IN_CONTEXT", "JUDGMENT_APPLICATION", "MIXED_MASTERY"
    ]);
  });

  it("maps each P level to its type and rejects P levels outside 1..10", () => {
    expect(questionTypeForPLevel(1)).toBe("DIRECT_RECALL");
    expect(questionTypeForPLevel(7)).toBe("SIMPLE_INFERENCE");
    expect(questionTypeForPLevel(10)).toBe("MIXED_MASTERY");
    expect(() => questionTypeForPLevel(0)).toThrow(RangeError);
    expect(() => questionTypeForPLevel(11)).toThrow(RangeError);
    expect(() => questionTypeForPLevel(2.5)).toThrow(RangeError);
  });

  it("derives the declared type from the P level when aligning an item", () => {
    expect(alignItem(3, choice("q1")).questionType).toBe("CAUSE_AND_EFFECT");
  });

  it("flags misaligned questions", () => {
    const bad = [{ pLevel: 3, questionType: "SEQUENCE", item: { itemId: "q9" } }, { pLevel: 12, questionType: "X", item: { itemId: "q10" } }];
    expect(validateAlignment(bad)).toEqual(["q9: P3 requires CAUSE_AND_EFFECT, got SEQUENCE", "q10: invalid P level 12"]);
    expect(validateAlignment([{ pLevel: 3, questionType: "CAUSE_AND_EFFECT", item: { itemId: "q1" } }])).toEqual([]);
  });

  it("scores deterministically and stores results at item level", () => {
    const aligned = [alignItem(1, choice("q1")), alignItem(2, choice("q2")), alignItem(3, choice("q3"))];
    const responses = {
      q1: { type: "single_choice", selectedOptionId: "a" },
      q2: { type: "single_choice", selectedOptionId: "b" },
      q3: { type: "single_choice", selectedOptionId: "a" }
    };
    const first = scoreAlignedItems(aligned, responses);
    const second = scoreAlignedItems(aligned, responses);
    expect(second).toEqual(first);
    expect(first.records).toEqual([
      { itemId: "q1", pLevel: 1, questionType: "DIRECT_RECALL", points: 1, result: "correct" },
      { itemId: "q2", pLevel: 2, questionType: "SEQUENCE", points: 0, result: "incorrect" },
      { itemId: "q3", pLevel: 3, questionType: "CAUSE_AND_EFFECT", points: 1, result: "correct" }
    ]);
    expect(first.evidence.items.map((i) => i.itemId)).toEqual(["q1", "q2", "q3"]);
    expect(first.evidence.score).toBeCloseTo(2 / 3);
  });

  it("treats an invalid response as zero points without throwing", () => {
    const out = scoreAlignedItems([alignItem(1, choice("q1"))], { q1: { type: "single_choice" } });
    expect(out.records[0]).toMatchObject({ points: 0, result: "invalid_response" });
  });

  it("refuses to score a set containing a misaligned question", () => {
    const misaligned = { pLevel: 3, questionType: "SEQUENCE", item: choice("q1") } as never;
    expect(() => scoreAlignedItems([misaligned], {})).toThrow(/misaligned/);
  });
});
