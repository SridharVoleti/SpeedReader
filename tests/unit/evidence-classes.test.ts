import { describe, expect, it } from "vitest";
import { classifyEvidence, EvidenceClassificationConfig, normalizeEvidenceText, Proposition } from "../../lib/evidence-scoring";

// SR-R3-003: Partial evidence classes.
// "Distinguish complete, partial/minimal, contradicted, irrelevant, no-evidence and
//  uninterpretable where configured."
// "Gold case for each configured class returns exact expected class and score/state."
// (TC-R3-003-B: one gold case per class.)
const mainIdea: Proposition = {
  propositionId: "p-main-idea",
  canonicalText: "Ravi returned the extra change",
  mandatory: true,
  acceptedExpressions: ["returned the extra change", "gave back the money"],
  contradictionExpressions: ["kept the extra change", "never returned it"]
};

const detail: Proposition = {
  propositionId: "p-detail",
  canonicalText: "The shopkeeper made a mistake",
  mandatory: false,
  acceptedExpressions: ["shopkeeper made a mistake", "shopkeeper gave too much change"],
  contradictionExpressions: []
};

const config: EvidenceClassificationConfig = {
  propositions: [mainIdea, detail],
  minimumWords: 5,
  ambiguityMarkers: ["i don't know", "not sure", "maybe something happened"]
};

function classify(text: string) {
  return classifyEvidence(normalizeEvidenceText(text), config);
}

describe("classifyEvidence gold corpus (one case per class)", () => {
  it("complete: every proposition (mandatory and optional) matched", () => {
    expect(classify("He returned the extra change because the shopkeeper made a mistake.")).toBe("complete");
  });

  it("partial: the mandatory proposition matched but the optional one did not", () => {
    expect(classify("Ravi returned the extra change to the shop.")).toBe("partial");
  });

  it("contradicted: the mandatory proposition is explicitly denied", () => {
    expect(classify("Ravi kept the extra change and said nothing.")).toBe("contradicted");
  });

  it("irrelevant: enough words, on-topic-looking, but no proposition matched or contradicted", () => {
    expect(classify("Ravi liked going to the market with his friends every day.")).toBe("irrelevant");
  });

  it("no_evidence: the response is empty or below the minimum word count", () => {
    expect(classify("")).toBe("no_evidence");
    expect(classify("He went.")).toBe("no_evidence");
  });

  it("uninterpretable: an authored ambiguity marker is present, where configured", () => {
    expect(classify("I don't know what happened in the story honestly.")).toBe("uninterpretable");
  });
});

describe("classifyEvidence determinism and precedence", () => {
  it("is deterministic for identical inputs", () => {
    const words = normalizeEvidenceText("He returned the extra change.");
    expect(classifyEvidence(words, config)).toBe(classifyEvidence(words, config));
  });

  it("contradiction takes precedence over an ambiguity marker present in the same response", () => {
    const text = "I don't know but he definitely kept the extra change.";
    expect(classify(text)).toBe("contradicted");
  });

  it("ambiguity takes precedence over a plain no-match (irrelevant) response of sufficient length", () => {
    const text = "Maybe something happened but I am not totally certain what.";
    expect(classify(text)).toBe("uninterpretable");
  });
});
