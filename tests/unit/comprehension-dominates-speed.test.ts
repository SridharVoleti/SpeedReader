import { describe, expect, it } from "vitest";
import { resolveChallengeAttempt } from "../../lib/adaptive-speed";
import { CertificationRateState } from "../../lib/certification";
import { AssessmentItem, deriveAttemptOutcome, scoreItem } from "../../lib/item-types";

// SR-R4-004: Comprehension dominates speed.
// "Higher nominal WPM cannot be rewarded when mandatory comprehension fails."
// "Fast failed-comprehension attempt cannot raise CRR/progression." (TC-R4-004-B: "Fast but poor
//  comprehension" - fast challenge, mandatory comprehension fail -> no rate increase/certification.)
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

describe("comprehension dominates speed", () => {
  it("a fast challenge with every optional detail correct but the mandatory item failed cannot raise the CRR (TC-R4-004-B)", () => {
    const items = [mandatoryMainIdea, easyDetailItem("d1"), easyDetailItem("d2"), easyDetailItem("d3"), easyDetailItem("d4")];
    const results = [
      scoreItem(mandatoryMainIdea, { type: "single_choice", selectedOptionId: "b" }), // mandatory FAILS
      ...items.slice(1).map((item) => scoreItem(item, { type: "single_choice", selectedOptionId: "a" })) // everything else correct
    ];

    // A high aggregate (4/5 = 80%) would normally clear most thresholds - proving speed/aggregate
    // alone cannot compensate for the mandatory gate.
    const attemptEvaluation = deriveAttemptOutcome(items, results, 70);
    expect(attemptEvaluation.attemptOutcome).toBe("HOLD");
    expect(attemptEvaluation.reasonCode).toBe("MANDATORY_GATE_FAILED");

    const crrBefore: CertificationRateState = { certifiedWpm: 150, challengeWpm: 300 }; // a "fast" challenge
    const resolution = resolveChallengeAttempt(crrBefore, attemptEvaluation.attemptOutcome, 20);

    expect(resolution.crrState.certifiedWpm).toBe(150); // unchanged - no certification
    expect(resolution.decision.reasonCode).toBe("COMPREHENSION_FAILED_RETREAT");
    expect(resolution.decision.nextTargetWpm).toBe(150); // retreats, does not stay at the fast 300
  });

  it("the same fast challenge DOES raise the CRR once the mandatory item is also answered correctly", () => {
    const items = [mandatoryMainIdea, easyDetailItem("d1")];
    const results = items.map((item) => scoreItem(item, { type: "single_choice", selectedOptionId: "a" }));

    const attemptEvaluation = deriveAttemptOutcome(items, results, 70);
    expect(attemptEvaluation.attemptOutcome).toBe("PASS");

    const crrBefore: CertificationRateState = { certifiedWpm: 150, challengeWpm: 300 };
    const resolution = resolveChallengeAttempt(crrBefore, attemptEvaluation.attemptOutcome, 20);

    expect(resolution.crrState.certifiedWpm).toBe(300);
  });

  it("is deterministic for identical inputs", () => {
    const items = [mandatoryMainIdea];
    const results = [scoreItem(mandatoryMainIdea, { type: "single_choice", selectedOptionId: "b" })];
    const attemptEvaluation = deriveAttemptOutcome(items, results, 70);
    const crrBefore: CertificationRateState = { certifiedWpm: 150, challengeWpm: 300 };

    expect(resolveChallengeAttempt(crrBefore, attemptEvaluation.attemptOutcome, 20)).toEqual(
      resolveChallengeAttempt(crrBefore, attemptEvaluation.attemptOutcome, 20)
    );
  });
});
