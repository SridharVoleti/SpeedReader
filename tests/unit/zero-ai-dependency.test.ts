import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { isAiRelatedDependency } from "../../lib/runtime-manifest";
import { chunkWords } from "../../lib/chunking";
import { planReadingTiming, recordActualDuration } from "../../lib/reading-timing";
import { PassageData, scoreComprehension } from "../../lib/scoring";
import { AssessmentItem, deriveAttemptOutcome, scoreItem } from "../../lib/item-types";

// SR-R1-015: Zero paid-AI runtime dependency.
// "Core reading, scoring and progression work without generative AI/LLM inference."
// "Full attempt succeeds with AI endpoints/credentials absent." (TC-R1-015-B: "Offline")
describe("isAiRelatedDependency", () => {
  it("flags known AI/LLM package name patterns", () => {
    expect(isAiRelatedDependency("openai")).toBe(true);
    expect(isAiRelatedDependency("@anthropic-ai/sdk")).toBe(true);
    expect(isAiRelatedDependency("langchain")).toBe(true);
    expect(isAiRelatedDependency("cohere-ai")).toBe(true);
    expect(isAiRelatedDependency("@google/generative-ai")).toBe(true);
  });

  it("does not flag ordinary web-framework packages", () => {
    expect(isAiRelatedDependency("react")).toBe(false);
    expect(isAiRelatedDependency("next")).toBe(false);
    expect(isAiRelatedDependency("jose")).toBe(false);
  });
});

describe("package.json has zero AI/LLM runtime dependencies", () => {
  it("no production dependency is an AI/LLM package", () => {
    const packageJsonPath = resolve(__dirname, "../../package.json");
    const packageJson = JSON.parse(readFileSync(packageJsonPath, "utf-8")) as {
      dependencies: Record<string, string>;
    };

    const aiDependencies = Object.keys(packageJson.dependencies).filter(isAiRelatedDependency);
    expect(aiDependencies).toEqual([]);
  });
});

describe("full attempt flow succeeds with AI env vars absent (TC-R1-015-B)", () => {
  const passage: PassageData = {
    content_id: "fixture_001",
    content_version: "1.0",
    schema_version: "1.0",
    approval_status: "APPROVED",
    level: 1,
    title: "Fixture",
    category: "test",
    difficulty: "beginner",
    estimatedAgeRange: "7-12",
    wordCount: 6,
    content: "Ravi returned the extra coins today.",
    comprehension: {
      minimumResponseWords: 3,
      requiredKeywords: ["returned"],
      concepts: ["Ravi returned the coins"],
      synonyms: {},
      copyLimit: 0.5
    }
  };

  it("completes a reading -> scoring -> progression attempt with no AI credentials in the environment", () => {
    const aiEnvKeys = ["OPENAI_API_KEY", "ANTHROPIC_API_KEY", "AI_API_KEY", "LLM_API_KEY"];
    for (const key of aiEnvKeys) {
      expect(process.env[key]).toBeUndefined();
    }

    // Reading: deterministic chunking + timing.
    const words = passage.content.split(/\s+/);
    const chunks = chunkWords(words, 1);
    expect(chunks.flat()).toEqual(words);
    const plan = planReadingTiming(words.length, 100, 1);
    const timing = recordActualDuration(plan, 0, 3600);
    expect(timing.actual_duration_ms).toBe(3600);

    // Scoring: whole-passage scorer.
    const scored = scoreComprehension(passage, "Ravi returned the extra coins to the shopkeeper.");
    expect(scored.passed).toBe(true);

    // Scoring: structured item-types scorer + progression outcome.
    const item: AssessmentItem = {
      itemId: "sa1",
      itemType: "constrained_short_answer",
      constructId: "main_idea",
      mandatory: false,
      prompt: "What happened?",
      minimumResponseWords: 3,
      requiredKeywords: ["returned"]
    };
    const itemResult = scoreItem(item, {
      type: "constrained_short_answer",
      text: "Ravi returned the extra coins."
    });
    const outcome = deriveAttemptOutcome([item], [itemResult], 70);
    expect(outcome.attemptOutcome).toBe("PASS");
  });
});
