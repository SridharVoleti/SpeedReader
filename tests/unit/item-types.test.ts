import { describe, expect, it } from "vitest";
import {
  AssessmentItem,
  ResponsePayload,
  scoreItem,
  validateResponseShape
} from "../../lib/item-types";

// SR-R1-005: Structured response types.
// "Each type can be authored/rendered/answered/scored; invalid response shapes are rejected."
const singleChoice: AssessmentItem = {
  itemId: "sc1",
  itemType: "single_choice",
  constructId: "detail",
  prompt: "Who returned the extra change?",
  options: [
    { id: "a", label: "Ravi" },
    { id: "b", label: "The shopkeeper" },
    { id: "c", label: "Meera" }
  ],
  correctOptionId: "a"
};

const ordering: AssessmentItem = {
  itemId: "or1",
  itemType: "ordering",
  constructId: "sequence_relationship",
  prompt: "Put the events in order.",
  items: [
    { id: "1", label: "Ravi buys items" },
    { id: "2", label: "Shopkeeper gives extra change" },
    { id: "3", label: "Ravi returns the coins" }
  ],
  correctOrderIds: ["1", "2", "3"]
};

const matching: AssessmentItem = {
  itemId: "ma1",
  itemType: "matching",
  constructId: "detail",
  prompt: "Match the character to their role.",
  left: [
    { id: "l1", label: "Ravi" },
    { id: "l2", label: "Shopkeeper" }
  ],
  right: [
    { id: "r1", label: "Customer" },
    { id: "r2", label: "Shop owner" }
  ],
  correctPairs: { l1: "r1", l2: "r2" }
};

const shortAnswer: AssessmentItem = {
  itemId: "sa1",
  itemType: "constrained_short_answer",
  constructId: "main_idea",
  prompt: "What did Ravi do?",
  minimumResponseWords: 3,
  requiredKeywords: ["returned"]
};

describe("validateResponseShape", () => {
  it("accepts a well-formed response for each item type", () => {
    expect(validateResponseShape(singleChoice, { type: "single_choice", selectedOptionId: "a" }).valid).toBe(true);
    expect(
      validateResponseShape(ordering, { type: "ordering", orderedItemIds: ["1", "2", "3"] }).valid
    ).toBe(true);
    expect(
      validateResponseShape(matching, { type: "matching", pairs: { l1: "r1", l2: "r2" } }).valid
    ).toBe(true);
    expect(
      validateResponseShape(shortAnswer, { type: "constrained_short_answer", text: "He returned the coins." }).valid
    ).toBe(true);
  });

  it("rejects a response whose type does not match the item's type", () => {
    const result = validateResponseShape(singleChoice, { type: "ordering", orderedItemIds: ["1"] });
    expect(result.valid).toBe(false);
  });

  it("rejects a single_choice response selecting an option that doesn't exist", () => {
    const result = validateResponseShape(singleChoice, { type: "single_choice", selectedOptionId: "z" });
    expect(result.valid).toBe(false);
  });

  it("rejects an ordering response that omits or duplicates items", () => {
    const missing = validateResponseShape(ordering, { type: "ordering", orderedItemIds: ["1", "2"] });
    const duplicated = validateResponseShape(ordering, {
      type: "ordering",
      orderedItemIds: ["1", "1", "3"]
    });
    expect(missing.valid).toBe(false);
    expect(duplicated.valid).toBe(false);
  });

  it("rejects a matching response with an unknown left or right id", () => {
    const unknownLeft = validateResponseShape(matching, {
      type: "matching",
      pairs: { unknown: "r1", l2: "r2" }
    });
    const unknownRight = validateResponseShape(matching, {
      type: "matching",
      pairs: { l1: "unknown", l2: "r2" }
    });
    const incomplete = validateResponseShape(matching, { type: "matching", pairs: { l1: "r1" } });
    expect(unknownLeft.valid).toBe(false);
    expect(unknownRight.valid).toBe(false);
    expect(incomplete.valid).toBe(false);
  });

  it("rejects a constrained_short_answer response with a non-string text field", () => {
    const result = validateResponseShape(shortAnswer, {
      type: "constrained_short_answer",
      text: 42 as unknown as string
    });
    expect(result.valid).toBe(false);
  });
});

describe("scoreItem", () => {
  it("scores single_choice correct/incorrect", () => {
    expect(
      scoreItem(singleChoice, { type: "single_choice", selectedOptionId: "a" }).itemResult
    ).toBe("correct");
    expect(
      scoreItem(singleChoice, { type: "single_choice", selectedOptionId: "b" }).itemResult
    ).toBe("incorrect");
  });

  it("scores ordering correct only for an exact sequence match", () => {
    expect(
      scoreItem(ordering, { type: "ordering", orderedItemIds: ["1", "2", "3"] }).itemResult
    ).toBe("correct");
    expect(
      scoreItem(ordering, { type: "ordering", orderedItemIds: ["2", "1", "3"] }).itemResult
    ).toBe("incorrect");
  });

  it("scores matching correct only when every pair matches", () => {
    expect(
      scoreItem(matching, { type: "matching", pairs: { l1: "r1", l2: "r2" } }).itemResult
    ).toBe("correct");
    expect(
      scoreItem(matching, { type: "matching", pairs: { l1: "r2", l2: "r1" } }).itemResult
    ).toBe("incorrect");
  });

  it("scores constrained_short_answer via keyword/length evidence", () => {
    expect(
      scoreItem(shortAnswer, { type: "constrained_short_answer", text: "He returned the coins." })
        .itemResult
    ).toBe("correct");
    expect(
      scoreItem(shortAnswer, { type: "constrained_short_answer", text: "He did stuff." }).itemResult
    ).toBe("incorrect");
  });

  it("rejects an invalid response shape instead of scoring it as incorrect", () => {
    const result = scoreItem(singleChoice, { type: "single_choice", selectedOptionId: "z" });
    expect(result.itemResult).toBe("invalid_response");
    expect(result.points).toBe(0);
  });

  it("tags every result with the item id it was scored against", () => {
    const result = scoreItem(singleChoice, { type: "single_choice", selectedOptionId: "a" });
    expect(result.itemId).toBe("sc1");
  });

  it("is deterministic for identical item/response pairs", () => {
    const response: ResponsePayload = { type: "matching", pairs: { l1: "r1", l2: "r2" } };
    expect(scoreItem(matching, response)).toEqual(scoreItem(matching, response));
  });
});
