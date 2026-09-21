import { describe, expect, it } from "vitest";
import {
  classifyEvidence,
  deriveScoringOutcome,
  EvidenceClassificationConfig,
  normalizeEvidenceText,
  Proposition
} from "../../lib/evidence-scoring";

// SR-R3-004: Interpretability safety.
// "Uninterpretable response must not silently become comprehension failure."
// "Configured ambiguous/uninterpretable response returns SCORING_UNCERTAIN/UNINTERPRETABLE and
//  reassessment." (TC-R3-004-B: "Ambiguous answer" - ambiguity rule matches -> UNINTERPRETABLE/
//  SCORING_UNCERTAIN; not FAIL.)
const mainIdea: Proposition = {
  propositionId: "p-main-idea",
  canonicalText: "Ravi returned the extra change",
  mandatory: true,
  acceptedExpressions: ["returned the extra change"],
  contradictionExpressions: ["kept the extra change"]
};

const config: EvidenceClassificationConfig = {
  propositions: [mainIdea],
  minimumWords: 5,
  ambiguityMarkers: ["i don't know", "not sure"]
};

function outcomeFor(text: string) {
  const evidenceClass = classifyEvidence(normalizeEvidenceText(text), config);
  return deriveScoringOutcome(evidenceClass);
}

describe("deriveScoringOutcome", () => {
  it("an ambiguous/uninterpretable response returns SCORING_UNCERTAIN, not a failure (TC-R3-004-B)", () => {
    const outcome = outcomeFor("I don't know what happened in the story honestly.");

    expect(outcome.evidenceClass).toBe("uninterpretable");
    expect(outcome.decision).toBe("SCORING_UNCERTAIN");
    expect(outcome.interpretabilityState).toBe("uninterpretable");
  });

  it("flags an uninterpretable response for reassessment rather than silently failing it", () => {
    const outcome = outcomeFor("Not sure what to say about this one.");
    expect(outcome.needsReassessment).toBe(true);
  });

  it("never labels an uninterpretable outcome's decision the same as a genuine failure", () => {
    const uncertain = outcomeFor("I don't know honestly what happened here.");
    const genuineFailure = outcomeFor("Ravi kept the extra change and said nothing.");

    expect(uncertain.decision).not.toBe(genuineFailure.decision);
  });

  it("does not flag a genuinely interpretable response - complete, partial, contradicted, irrelevant or no_evidence", () => {
    const complete = outcomeFor("He returned the extra change to the shopkeeper.");
    const contradicted = outcomeFor("Ravi kept the extra change and said nothing.");
    const irrelevant = outcomeFor("Ravi liked going to the market with his friends every day.");
    const noEvidence = outcomeFor("He went.");

    for (const outcome of [complete, contradicted, irrelevant, noEvidence]) {
      expect(outcome.decision).toBe("SCORED");
      expect(outcome.interpretabilityState).toBe("interpretable");
      expect(outcome.needsReassessment).toBe(false);
    }
  });

  it("is deterministic for identical inputs", () => {
    expect(outcomeFor("I don't know what happened.")).toEqual(outcomeFor("I don't know what happened."));
  });
});
