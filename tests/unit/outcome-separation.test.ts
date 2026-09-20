import { describe, expect, it } from "vitest";
import { AssessmentItem, deriveAttemptOutcome, scoreItem } from "../../lib/item-types";
import { levels, Progress, recordResult } from "../../lib/progression";

// SR-R1-012: Outcome separation.
// "Produce PASS, HOLD/FAIL and INVALID/INSUFFICIENT_EVIDENCE without conflation."
// "Technical/content invalidity does not lower learner state; comprehension failure does;
//  reason code stored." (TC-R1-012-B: technical interruption -> INVALID.)
const item: AssessmentItem = {
  itemId: "sc1",
  itemType: "single_choice",
  constructId: "detail",
  mandatory: false,
  prompt: "Prompt",
  options: [
    { id: "a", label: "A" },
    { id: "b", label: "B" }
  ],
  correctOptionId: "a"
};

describe("deriveAttemptOutcome", () => {
  it("produces INVALID with a reason code when the attempt was technically interrupted (TC-R1-012-B)", () => {
    const results = [scoreItem(item, { type: "single_choice", selectedOptionId: "a" })];

    const outcome = deriveAttemptOutcome([item], results, 70, { interrupted: true });

    expect(outcome.attemptOutcome).toBe("INVALID");
    expect(outcome.reasonCode).toBe("TECHNICAL_INTERRUPTION");
  });

  it("produces INVALID when a response shape was rejected, distinct from comprehension failure", () => {
    const results = [scoreItem(item, { type: "ordering", orderedItemIds: ["x"] })]; // wrong shape

    const outcome = deriveAttemptOutcome([item], results, 70);

    expect(outcome.attemptOutcome).toBe("INVALID");
    expect(outcome.reasonCode).toBe("INSUFFICIENT_EVIDENCE");
  });

  it("produces PASS with reason code PASS when comprehension genuinely passes", () => {
    const results = [scoreItem(item, { type: "single_choice", selectedOptionId: "a" })];
    const outcome = deriveAttemptOutcome([item], results, 70);

    expect(outcome.attemptOutcome).toBe("PASS");
    expect(outcome.reasonCode).toBe("PASS");
  });

  it("produces HOLD (not INVALID) when comprehension genuinely fails", () => {
    const results = [scoreItem(item, { type: "single_choice", selectedOptionId: "b" })];
    const outcome = deriveAttemptOutcome([item], results, 70);

    expect(outcome.attemptOutcome).toBe("HOLD");
    expect(outcome.reasonCode).toBe("AGGREGATE_BELOW_THRESHOLD");
  });

  it("never conflates the three outcomes - each maps to exactly one attemptOutcome", () => {
    const passResult = deriveAttemptOutcome(
      [item],
      [scoreItem(item, { type: "single_choice", selectedOptionId: "a" })],
      70
    );
    const holdResult = deriveAttemptOutcome(
      [item],
      [scoreItem(item, { type: "single_choice", selectedOptionId: "b" })],
      70
    );
    const invalidResult = deriveAttemptOutcome([item], [], 70, { interrupted: true });

    const outcomes = new Set([passResult.attemptOutcome, holdResult.attemptOutcome, invalidResult.attemptOutcome]);
    expect(outcomes).toEqual(new Set(["PASS", "HOLD", "INVALID"]));
  });
});

describe("recordResult with an INVALID attempt outcome", () => {
  it("leaves learner state completely unchanged (TC-R1-012-B: injected interruption)", () => {
    const before: Progress = recordResult({}, levels[0], 100); // a genuine prior pass

    // A high score submitted on an INVALID (e.g. technically interrupted) attempt must not
    // touch the learner's recorded state at all - not even to record a "better" score.
    const after = recordResult(before, levels[0], 100, undefined, undefined, "INVALID");

    expect(after).toEqual(before);
  });

  it("still records state normally when the outcome is PASS or HOLD (or omitted)", () => {
    const passed = recordResult({}, levels[0], 100, undefined, undefined, "PASS");
    expect(passed["1"].passed).toBe(true);

    const held = recordResult({}, levels[0], 10, undefined, undefined, "HOLD");
    expect(held["1"].passed).toBe(false);
    expect(held["1"].bestScore).toBe(10);
  });
});
