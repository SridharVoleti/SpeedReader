import { describe, expect, it } from "vitest";
import {
  EvidenceClassificationConfig,
  GoldCase,
  Proposition,
  validateContentForApproval
} from "../../lib/evidence-scoring";

// SR-R3-006: Scorer gold corpus.
// "Each text item ships QA cases: valid variants, partials, contradictions, keyword-stuffed
//  wrong and ambiguous answers."
// "Content cannot become APPROVED unless all required gold cases match expected scorer
//  outcomes." (TC-R3-006-B: "Gold mismatch" - one expected result deliberately mismatches the
//  scorer -> APPROVED blocked; failing case reported.)
const mainIdea: Proposition = {
  propositionId: "p-main-idea",
  canonicalText: "Ravi returned the extra change",
  mandatory: true,
  constructId: "main_idea",
  acceptedExpressions: ["returned the extra change"],
  contradictionExpressions: ["kept the extra change"]
};

const detail: Proposition = {
  propositionId: "p-detail",
  canonicalText: "The shopkeeper made a mistake",
  mandatory: false,
  constructId: "detail",
  acceptedExpressions: ["shopkeeper made a mistake"],
  contradictionExpressions: []
};

const config: EvidenceClassificationConfig = {
  propositions: [mainIdea, detail],
  minimumWords: 5,
  ambiguityMarkers: ["i don't know"]
};

const completeGoldCases: GoldCase[] = [
  {
    goldCaseId: "gc-valid",
    responseText: "He returned the extra change because the shopkeeper made a mistake.",
    expectedEvidenceClass: "complete"
  },
  {
    goldCaseId: "gc-partial",
    responseText: "He returned the extra change but nothing else.",
    expectedEvidenceClass: "partial"
  },
  { goldCaseId: "gc-contradiction", responseText: "He kept the extra change and said nothing.", expectedEvidenceClass: "contradicted" },
  { goldCaseId: "gc-keyword-stuffed", responseText: "extra change extra change shopkeeper change", expectedEvidenceClass: "irrelevant" },
  { goldCaseId: "gc-ambiguous", responseText: "I don't know what happened here.", expectedEvidenceClass: "uninterpretable" }
];

describe("validateContentForApproval", () => {
  it("approves content when every gold case matches its expected scorer outcome, with full category coverage", () => {
    const result = validateContentForApproval(completeGoldCases, config);
    expect(result.approved).toBe(true);
  });

  it("blocks approval and reports the specific failing case when one expected result mismatches the scorer (TC-R3-006-B)", () => {
    const mismatchedCases: GoldCase[] = completeGoldCases.map((goldCase) =>
      goldCase.goldCaseId === "gc-contradiction" ? { ...goldCase, expectedEvidenceClass: "complete" } : goldCase
    );

    const result = validateContentForApproval(mismatchedCases, config);

    expect(result.approved).toBe(false);
    if (!result.approved) {
      expect(result.failingCases).toHaveLength(1);
      expect(result.failingCases[0].goldCaseId).toBe("gc-contradiction");
      expect(result.failingCases[0].expectedEvidenceClass).toBe("complete");
      expect(result.failingCases[0].actualEvidenceClass).toBe("contradicted");
    }
  });

  it("blocks approval when a required gold case category is missing entirely", () => {
    const missingAmbiguous = completeGoldCases.filter((goldCase) => goldCase.goldCaseId !== "gc-ambiguous");
    const result = validateContentForApproval(missingAmbiguous, config);

    expect(result.approved).toBe(false);
    if (!result.approved) expect(result.missingClasses).toContain("uninterpretable");
  });

  it("is deterministic for identical inputs", () => {
    expect(validateContentForApproval(completeGoldCases, config)).toEqual(
      validateContentForApproval(completeGoldCases, config)
    );
  });
});
