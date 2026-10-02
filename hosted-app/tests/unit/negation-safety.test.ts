import { describe, expect, it } from "vitest";
import { AssessmentItem, scoreItem } from "../../lib/item-types";

// SR-R1-009: Negation safety.
// "Distinguish positive proposition from explicit negation."
// "Expected keywords inside a negated/contradictory claim cannot earn full credit."
// (TC-R1-009-B: "Keyword-stuffed negation" - submit expected keywords while denying the
//  proposition -> no full credit; contradiction/negation detected.)
const item: AssessmentItem = {
  itemId: "sa1",
  itemType: "constrained_short_answer",
  constructId: "main_idea",
  mandatory: false,
  prompt: "Was Ravi honest?",
  minimumResponseWords: 3,
  requiredKeywords: ["honest"]
};

function score(text: string) {
  return scoreItem(item, { type: "constrained_short_answer", text });
}

describe("negation safety", () => {
  it("does not give full credit when the expected keyword appears only inside a negated claim (TC-R1-009-B)", () => {
    const result = score("He was not honest and kept the money for himself.");

    expect(result.itemResult).toBe("incorrect");
    expect(result.evidence?.matchedEvidence).not.toContain("honest");
    expect(result.evidence?.negationDetected).toBe(true);
  });

  it("still gives credit for a genuine, non-negated occurrence of the keyword", () => {
    const result = score("He was honest and returned the money.");

    expect(result.itemResult).toBe("correct");
    expect(result.evidence?.matchedEvidence).toContain("honest");
    expect(result.evidence?.negationDetected).toBe(false);
  });

  it("gives credit when a genuine occurrence exists alongside an unrelated negation elsewhere", () => {
    const result = score("He never gave up, and in the end he was honest.");

    expect(result.itemResult).toBe("correct");
    expect(result.evidence?.matchedEvidence).toContain("honest");
  });

  it("gives credit when the keyword appears both negated and genuinely in the same response", () => {
    const result = score("At first he was not honest, but later he was honest.");

    expect(result.itemResult).toBe("correct");
    expect(result.evidence?.matchedEvidence).toContain("honest");
  });

  it("recognizes common negation contractions", () => {
    const result = score("He wasn't honest at all during the whole story.");

    expect(result.itemResult).toBe("incorrect");
    expect(result.evidence?.negationDetected).toBe(true);
  });

  it("reports a per-keyword proposition result distinguishing matched, negated and absent", () => {
    const negated = score("He was not honest.");
    const matched = score("He was honest.");
    const absent = score("He went home.");

    expect(negated.evidence?.propositionResults).toEqual([{ keyword: "honest", result: "negated" }]);
    expect(matched.evidence?.propositionResults).toEqual([{ keyword: "honest", result: "matched" }]);
    expect(absent.evidence?.propositionResults).toEqual([{ keyword: "honest", result: "absent" }]);
  });
});
