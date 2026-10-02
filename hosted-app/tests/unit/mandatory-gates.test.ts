import { describe, expect, it } from "vitest";
import { AssessmentItem, evaluateComprehension, scoreItem } from "../../lib/item-types";

// SR-R1-007: Mandatory gates.
// "Passage comprehension is not solely an average percentage."
// "Configured mandatory gate failure prevents PASS even if aggregate threshold is exceeded;
//  reason is recorded." (TC-R1-007-B: "High aggregate but main idea fails")
const mandatoryMainIdea: AssessmentItem = {
  itemId: "mi1",
  itemType: "single_choice",
  constructId: "main_idea",
  mandatory: true,
  prompt: "What is this story mainly about?",
  options: [
    { id: "a", label: "Honesty" },
    { id: "b", label: "Cooking" }
  ],
  correctOptionId: "a"
};

function easyDetailItem(itemId: string): AssessmentItem {
  return {
    itemId,
    itemType: "single_choice",
    constructId: "detail",
    mandatory: false,
    prompt: "Easy detail question.",
    options: [
      { id: "a", label: "Correct" },
      { id: "b", label: "Wrong" }
    ],
    correctOptionId: "a"
  };
}

const items = [mandatoryMainIdea, easyDetailItem("d1"), easyDetailItem("d2"), easyDetailItem("d3"), easyDetailItem("d4")];

describe("evaluateComprehension", () => {
  it("does not PASS when the mandatory item fails, even though the aggregate exceeds threshold (TC-R1-007-B)", () => {
    const results = [
      scoreItem(mandatoryMainIdea, { type: "single_choice", selectedOptionId: "b" }), // fails
      scoreItem(items[1], { type: "single_choice", selectedOptionId: "a" }),
      scoreItem(items[2], { type: "single_choice", selectedOptionId: "a" }),
      scoreItem(items[3], { type: "single_choice", selectedOptionId: "a" }),
      scoreItem(items[4], { type: "single_choice", selectedOptionId: "a" })
    ];

    const evaluation = evaluateComprehension(items, results, 70);

    expect(evaluation.aggregateScore).toBeGreaterThanOrEqual(70);
    expect(evaluation.mandatoryGateFailed).toBe(true);
    expect(evaluation.failedMandatoryItemIds).toEqual(["mi1"]);
    expect(evaluation.comprehensionState).toBe("FAIL");
    expect(evaluation.reasonCode).toBe("MANDATORY_GATE_FAILED");
  });

  it("PASSes when the mandatory item succeeds and the aggregate meets threshold", () => {
    const results = items.map((item) => scoreItem(item, { type: "single_choice", selectedOptionId: "a" }));

    const evaluation = evaluateComprehension(items, results, 70);

    expect(evaluation.mandatoryGateFailed).toBe(false);
    expect(evaluation.comprehensionState).toBe("PASS");
    expect(evaluation.reasonCode).toBe("PASS");
  });

  it("FAILs for aggregate reasons when mandatory gates pass but the aggregate is below threshold", () => {
    const results = [
      scoreItem(mandatoryMainIdea, { type: "single_choice", selectedOptionId: "a" }), // passes
      scoreItem(items[1], { type: "single_choice", selectedOptionId: "b" }),
      scoreItem(items[2], { type: "single_choice", selectedOptionId: "b" }),
      scoreItem(items[3], { type: "single_choice", selectedOptionId: "b" }),
      scoreItem(items[4], { type: "single_choice", selectedOptionId: "b" })
    ];

    const evaluation = evaluateComprehension(items, results, 70);

    expect(evaluation.mandatoryGateFailed).toBe(false);
    expect(evaluation.comprehensionState).toBe("FAIL");
    expect(evaluation.reasonCode).toBe("AGGREGATE_BELOW_THRESHOLD");
  });

  it("records every failed mandatory item id when more than one mandatory item fails", () => {
    const secondMandatory: AssessmentItem = { ...mandatoryMainIdea, itemId: "mi2", mandatory: true };
    const twoMandatoryItems = [mandatoryMainIdea, secondMandatory, ...items.slice(1)];
    const results = [
      scoreItem(mandatoryMainIdea, { type: "single_choice", selectedOptionId: "b" }),
      scoreItem(secondMandatory, { type: "single_choice", selectedOptionId: "b" }),
      ...items.slice(1).map((item) => scoreItem(item, { type: "single_choice", selectedOptionId: "a" }))
    ];

    const evaluation = evaluateComprehension(twoMandatoryItems, results, 70);
    expect(evaluation.failedMandatoryItemIds).toEqual(["mi1", "mi2"]);
  });

  it("is deterministic for identical inputs", () => {
    const results = items.map((item) => scoreItem(item, { type: "single_choice", selectedOptionId: "a" }));
    expect(evaluateComprehension(items, results, 70)).toEqual(evaluateComprehension(items, results, 70));
  });
});
