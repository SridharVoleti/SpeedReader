import { describe, expect, it } from "vitest";
import { AssessmentItem, validateItemSequence } from "../../lib/item-types";

// SR-R1-010: Question non-contamination.
// "Assessment items shall not reveal answers needed by later scored items."
// "Reveal-risk dependency is rejected or dependent evidence is collected before reveal/feedback."
// (TC-R1-010-B: "Earlier question reveals later answer" -> reject the sequence.)
function item(itemId: string, revealRisk?: string[]): AssessmentItem {
  return {
    itemId,
    itemType: "single_choice",
    constructId: "detail",
    mandatory: false,
    revealRisk,
    prompt: `Prompt for ${itemId}`,
    options: [{ id: "a", label: "A" }],
    correctOptionId: "a"
  };
}

describe("validateItemSequence", () => {
  it("rejects a sequence where an earlier item reveals a later item's evidence (TC-R1-010-B)", () => {
    const revealer = item("earlier-question", ["later-question"]);
    const dependent = item("later-question");

    const result = validateItemSequence([revealer, dependent]);

    expect(result.valid).toBe(false);
    expect(result.violations).toEqual([
      expect.objectContaining({ revealingItemId: "earlier-question", revealedItemId: "later-question" })
    ]);
  });

  it("accepts the same pair reordered so the dependent item's evidence is collected first", () => {
    const revealer = item("later-reveal", ["earlier-question"]);
    const dependent = item("earlier-question");

    const result = validateItemSequence([dependent, revealer]);

    expect(result.valid).toBe(true);
    expect(result.violations).toEqual([]);
  });

  it("accepts a sequence with no declared reveal risk at all", () => {
    const result = validateItemSequence([item("a"), item("b"), item("c")]);
    expect(result.valid).toBe(true);
  });

  it("reports every violation when multiple reveal-risk dependencies are broken", () => {
    const a = item("a", ["b", "c"]);
    const b = item("b");
    const c = item("c");

    const result = validateItemSequence([a, b, c]);

    expect(result.violations).toHaveLength(2);
    expect(result.violations.map((v) => v.revealedItemId).sort()).toEqual(["b", "c"]);
  });

  it("treats an item revealing itself as a violation, not a false pass", () => {
    const selfRevealing = item("a", ["a"]);
    const result = validateItemSequence([selfRevealing]);
    expect(result.valid).toBe(false);
  });

  it("ignores a reveal_risk reference to an item id that isn't in the sequence", () => {
    const result = validateItemSequence([item("a", ["not-in-sequence"])]);
    expect(result.valid).toBe(true);
  });

  it("is deterministic for identical inputs", () => {
    const items = [item("a", ["b"]), item("b")];
    expect(validateItemSequence(items)).toEqual(validateItemSequence(items));
  });
});
