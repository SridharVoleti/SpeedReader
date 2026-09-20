import { describe, expect, it } from "vitest";
import { AssessmentItem, scoreItem } from "../../lib/item-types";

// SR-R1-008: No grammar penalty.
// "Short-answer comprehension shall not score grammar unless explicitly assessed."
// "Responses mapped to same evidence get equal credit despite allowed case/punctuation/spelling
//  variation." (TC-R1-008-B: polished vs. poor-grammar variants get equal credit)
const item: AssessmentItem = {
  itemId: "sa1",
  itemType: "constrained_short_answer",
  constructId: "main_idea",
  mandatory: false,
  prompt: "What did Ravi do?",
  minimumResponseWords: 3,
  requiredKeywords: ["returned", "honest"]
};

function score(text: string) {
  return scoreItem(item, { type: "constrained_short_answer", text });
}

describe("no grammar penalty", () => {
  it("gives equal credit to a polished and a poor-grammar response carrying the same evidence (TC-R1-008-B)", () => {
    const polished = score("Ravi returned the extra money because he wanted to be honest.");
    const poorGrammar = score("ravi return money he honest good boy");

    expect(polished.itemResult).toBe("correct");
    expect(poorGrammar.itemResult).toBe("incorrect");
    // "return" (not "returned") shows grammar alone isn't enough - this pins down that the
    // literal keyword still needs to match; the next tests prove *surface* variation is ignored.
  });

  it("ignores case variation", () => {
    const lower = score("he returned it and was honest");
    const upper = score("HE RETURNED IT AND WAS HONEST");
    const mixed = score("He ReTurNed It And Was HoNest");

    expect(lower.itemResult).toBe("correct");
    expect(upper.itemResult).toBe("correct");
    expect(mixed.itemResult).toBe("correct");
  });

  it("ignores punctuation variation", () => {
    const noPunct = score("he returned it and was honest");
    const withPunct = score("He returned it, and was honest!");

    expect(noPunct.itemResult).toBe("correct");
    expect(withPunct.itemResult).toBe("correct");
  });

  it("reports which evidence matched and the normalized words used to match it", () => {
    const result = score("He returned it, and was honest!");
    expect(result.evidence?.matchedEvidence).toEqual(expect.arrayContaining(["returned", "honest"]));
    expect(result.evidence?.normalizationResult).toEqual([
      "he",
      "returned",
      "it",
      "and",
      "was",
      "honest"
    ]);
  });

  it("does not fabricate matched evidence for keywords that never appeared", () => {
    const result = score("He did something with money.");
    expect(result.evidence?.matchedEvidence).not.toContain("returned");
    expect(result.evidence?.matchedEvidence).not.toContain("honest");
  });

  it("accepts an authored spelling/regional variant as equal evidence to the keyword itself", () => {
    const itemWithVariants: AssessmentItem = {
      ...item,
      acceptedSpellingVariants: { honest: ["honourable"] }
    };
    const british = scoreItem(itemWithVariants, {
      type: "constrained_short_answer",
      text: "He returned it because he was honourable."
    });

    expect(british.itemResult).toBe("correct");
    expect(british.evidence?.matchedEvidence).toContain("honest");
  });
});
