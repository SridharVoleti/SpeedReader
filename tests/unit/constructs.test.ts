import { describe, expect, it } from "vitest";
import { AssessmentItem, ConstructId, scoreItem, summarizeConstructOutcomes } from "../../lib/item-types";

// SR-R1-006: Basic constructs.
// "Identify main idea, explicit detail and sequence/relationship in item metadata."
// "Every item has one primary R1 construct; result reports construct outcomes."
const mainIdeaItem: AssessmentItem = {
  itemId: "mi1",
  itemType: "single_choice",
  constructId: "main_idea",
  prompt: "What is this story mainly about?",
  options: [
    { id: "a", label: "Honesty" },
    { id: "b", label: "Cooking" }
  ],
  correctOptionId: "a"
};

const detailItem: AssessmentItem = {
  itemId: "d1",
  itemType: "constrained_short_answer",
  constructId: "detail",
  prompt: "What did the shopkeeper give Ravi by mistake?",
  minimumResponseWords: 2,
  requiredKeywords: ["change"]
};

const sequenceItem: AssessmentItem = {
  itemId: "s1",
  itemType: "ordering",
  constructId: "sequence_relationship",
  prompt: "Order the events.",
  items: [
    { id: "1", label: "Ravi buys items" },
    { id: "2", label: "He notices the mistake" }
  ],
  correctOrderIds: ["1", "2"]
};

describe("item constructs", () => {
  it("requires every item to declare exactly one of the R1 constructs", () => {
    const constructs: ConstructId[] = [mainIdeaItem.constructId, detailItem.constructId, sequenceItem.constructId];
    expect(constructs).toEqual(["main_idea", "detail", "sequence_relationship"]);
  });

  it("reports the construct id on every scored result", () => {
    const result = scoreItem(mainIdeaItem, { type: "single_choice", selectedOptionId: "a" });
    expect(result.constructId).toBe("main_idea");
  });

  it("reports the construct id even for an invalid response", () => {
    const result = scoreItem(detailItem, { type: "single_choice", selectedOptionId: "a" });
    expect(result.itemResult).toBe("invalid_response");
    expect(result.constructId).toBe("detail");
  });
});

describe("summarizeConstructOutcomes", () => {
  it("aggregates correct/total per construct across a set of results", () => {
    const results = [
      scoreItem(mainIdeaItem, { type: "single_choice", selectedOptionId: "a" }), // correct
      scoreItem(detailItem, { type: "constrained_short_answer", text: "extra change" }), // correct
      scoreItem(sequenceItem, { type: "ordering", orderedItemIds: ["2", "1"] }) // incorrect
    ];

    const summary = summarizeConstructOutcomes(results);

    expect(summary).toEqual(
      expect.arrayContaining([
        { constructId: "main_idea", correct: 1, total: 1 },
        { constructId: "detail", correct: 1, total: 1 },
        { constructId: "sequence_relationship", correct: 0, total: 1 }
      ])
    );
  });

  it("combines multiple items tagged with the same construct", () => {
    const secondDetailItem: AssessmentItem = { ...detailItem, itemId: "d2" };
    const results = [
      scoreItem(detailItem, { type: "constrained_short_answer", text: "extra change" }), // correct
      scoreItem(secondDetailItem, { type: "constrained_short_answer", text: "nothing" }) // incorrect
    ];

    const summary = summarizeConstructOutcomes(results);
    expect(summary).toEqual([{ constructId: "detail", correct: 1, total: 2 }]);
  });

  it("returns an empty summary for no results", () => {
    expect(summarizeConstructOutcomes([])).toEqual([]);
  });
});
