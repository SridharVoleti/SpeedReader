import { describe, expect, it } from "vitest";
import { PassageData, SCORER_VERSION, scoreComprehension } from "../../lib/scoring";

// SR-R1-004: Deterministic item scoring.
// "Same content/scorer version + response always yields same result; no network AI/LLM call."
const passage: PassageData = {
  content_id: "fixture_001",
  content_version: "1.0",
  schema_version: "1.0",
  approval_status: "APPROVED",
  level: 1,
  title: "Fixture Passage",
  category: "test",
  difficulty: "beginner",
  estimatedAgeRange: "7-12",
  wordCount: 8,
  content: "Ravi went to a small shop nearby.",
  comprehension: {
    minimumResponseWords: 5,
    requiredKeywords: ["ravi", "shop"],
    concepts: ["Ravi went to a shop"],
    synonyms: { shop: ["store"] },
    copyLimit: 0.5
  }
};

describe("scoreComprehension determinism", () => {
  it("tags every result with the current scorer version", () => {
    const result = scoreComprehension(passage, "Ravi walked to a nearby store to buy things.");
    expect(result.scorerVersion).toBe(SCORER_VERSION);
  });

  it("produces an identical result across 100 runs for the same content/scorer version + response (TC-R1-004-B)", () => {
    const response = "Ravi walked to a nearby store to buy things for his home.";
    const first = scoreComprehension(passage, response);

    for (let i = 0; i < 100; i += 1) {
      expect(scoreComprehension(passage, response)).toEqual(first);
    }
  });

  it("is deterministic across a range of different responses", () => {
    const responses = [
      "It was nice and good.",
      passage.content,
      "Ravi walked to a nearby store to buy things for his home and family.",
      ""
    ];
    for (const response of responses) {
      const first = scoreComprehension(passage, response);
      for (let i = 0; i < 10; i += 1) {
        expect(scoreComprehension(passage, response)).toEqual(first);
      }
    }
  });

  it("returns synchronously, never a Promise - no network/AI call is possible", () => {
    const result = scoreComprehension(passage, "Ravi walked to a nearby store.");
    expect(result).not.toBeInstanceOf(Promise);
    expect(typeof (result as unknown as { then?: unknown }).then).not.toBe("function");
  });
});
