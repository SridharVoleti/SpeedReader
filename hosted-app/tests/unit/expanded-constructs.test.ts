import { describe, expect, it } from "vitest";
import { ConstructId } from "../../lib/item-types";
import {
  matchProposition,
  normalizeEvidenceText,
  Proposition,
  summarizePropositionConstructs
} from "../../lib/evidence-scoring";

// SR-R3-005: Expanded construct ontology.
// "Support main idea, detail, sequence/structure, relationship/cause-effect, inference,
//  integration and meaning-in-context."
// "Each construct has executable evidence definition and construct-level reporting."
function proposition(constructId: ConstructId, overrides: Partial<Proposition> = {}): Proposition {
  return {
    propositionId: `p-${constructId}`,
    canonicalText: `Evidence for ${constructId}`,
    mandatory: false,
    constructId,
    acceptedExpressions: [constructId.replace(/_/g, " ")],
    contradictionExpressions: [],
    ...overrides
  };
}

describe("expanded construct ontology", () => {
  it("every construct in the R3 ontology has an executable evidence definition (matchProposition works for each)", () => {
    const constructs: ConstructId[] = [
      "main_idea",
      "detail",
      "sequence_structure",
      "relationship_cause_effect",
      "inference",
      "integration",
      "meaning_in_context"
    ];

    for (const constructId of constructs) {
      const prop = proposition(constructId);
      const words = normalizeEvidenceText(prop.acceptedExpressions[0]);
      const result = matchProposition(prop, words);
      expect(result.matched).toBe(true);
      expect(result.constructId).toBe(constructId);
    }
  });

  it("still supports R1's pre-R3 sequence_relationship construct for backward compatibility", () => {
    const prop = proposition("sequence_relationship");
    expect(prop.constructId).toBe("sequence_relationship");
  });
});

describe("summarizePropositionConstructs", () => {
  it("reports matched/total per construct across a set of proposition results", () => {
    const mainIdea = proposition("main_idea");
    const inference = proposition("inference");
    const detail = proposition("detail");

    const results = [
      matchProposition(mainIdea, normalizeEvidenceText("main idea")), // matched
      matchProposition(inference, normalizeEvidenceText("nothing relevant here")), // not matched
      matchProposition(detail, normalizeEvidenceText("detail")) // matched
    ];

    const summary = summarizePropositionConstructs(results);

    expect(summary).toEqual(
      expect.arrayContaining([
        { constructId: "main_idea", matched: 1, total: 1 },
        { constructId: "inference", matched: 0, total: 1 },
        { constructId: "detail", matched: 1, total: 1 }
      ])
    );
  });

  it("combines multiple propositions tagged with the same construct", () => {
    const integrationA = proposition("integration", { propositionId: "p-int-a" });
    const integrationB = proposition("integration", { propositionId: "p-int-b" });

    const results = [
      matchProposition(integrationA, normalizeEvidenceText("integration")),
      matchProposition(integrationB, normalizeEvidenceText("something else"))
    ];

    expect(summarizePropositionConstructs(results)).toEqual([{ constructId: "integration", matched: 1, total: 2 }]);
  });

  it("returns an empty summary for no results", () => {
    expect(summarizePropositionConstructs([])).toEqual([]);
  });
});
