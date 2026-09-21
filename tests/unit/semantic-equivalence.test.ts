import { describe, expect, it } from "vitest";
import {
  EquivalenceGroup,
  expressionsFromGroups,
  matchPropositionWithGroups,
  normalizeEvidenceText
} from "../../lib/evidence-scoring";

// SR-R3-002: File-based semantic equivalence.
// "Explicitly equivalent wording receives equivalent credit."
// "Gold paraphrases/short child responses map to same proposition result/credit."
const honestyGroup: EquivalenceGroup = {
  equivalenceGroupId: "eq-honesty",
  expressions: [
    "returned the extra change he had been given by mistake",
    "gave back the money",
    "gave it back"
  ]
};

const proposition = {
  propositionId: "p-honesty",
  canonicalText: "Ravi returned the extra change",
  mandatory: true,
  equivalenceGroups: [honestyGroup],
  contradictionExpressions: ["kept the extra change"]
};

describe("expressionsFromGroups", () => {
  it("flattens every equivalence group's expressions into one list", () => {
    expect(expressionsFromGroups([honestyGroup])).toEqual(honestyGroup.expressions);
  });
});

describe("matchPropositionWithGroups", () => {
  it("a polished gold paraphrase matches and identifies its equivalence group", () => {
    const words = normalizeEvidenceText(
      "He politely returned the extra change he had been given by mistake."
    );
    const result = matchPropositionWithGroups(proposition, words);

    expect(result.matched).toBe(true);
    expect(result.matchedGroupId).toBe("eq-honesty");
  });

  it("a short child-level response in the same equivalence group produces the identical result", () => {
    const goldWords = normalizeEvidenceText("He returned the extra change he had been given by mistake.");
    const childWords = normalizeEvidenceText("he gave it back");

    const goldResult = matchPropositionWithGroups(proposition, goldWords);
    const childResult = matchPropositionWithGroups(proposition, childWords);

    expect(childResult.matched).toBe(true);
    expect(childResult.matchedGroupId).toBe(goldResult.matchedGroupId);
    expect(childResult.matched).toBe(goldResult.matched);
  });

  it("gives no credit for wording outside every authored equivalence group, however plausible", () => {
    const words = normalizeEvidenceText("He was a nice boy who liked to help people.");
    const result = matchPropositionWithGroups(proposition, words);

    expect(result.matched).toBe(false);
    expect(result.matchedGroupId).toBeNull();
  });

  it("still flags a contradiction when the proposition is explicitly denied", () => {
    const words = normalizeEvidenceText("He kept the extra change and said nothing.");
    const result = matchPropositionWithGroups(proposition, words);

    expect(result.matched).toBe(false);
    expect(result.contradicted).toBe(true);
  });

  it("is deterministic for identical inputs", () => {
    const words = normalizeEvidenceText("he gave it back");
    expect(matchPropositionWithGroups(proposition, words)).toEqual(
      matchPropositionWithGroups(proposition, words)
    );
  });
});
