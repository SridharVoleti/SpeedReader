// SR-R1-015: Zero paid-AI runtime dependency.
// "Core reading, scoring and progression work without generative AI/LLM inference." This is the
// explicit, testable manifest backing that claim: the packages the core learner runtime actually
// needs, and a pattern check that flags any AI/LLM SDK dependency, run against package.json in
// tests/unit/zero-ai-dependency.test.ts so a future dependency can't silently violate D-001.

// The only packages the core reading/scoring/progression runtime depends on. Anything else in
// package.json (e.g. "jose" for the BabySteps launch JWT handshake) is app-shell plumbing, not
// part of this deterministic core, but must still pass isAiRelatedDependency below.
export const CORE_RUNTIME_DEPENDENCIES = ["react", "react-dom", "next"] as const;

const AI_DEPENDENCY_PATTERNS = [
  /openai/i,
  /anthropic/i,
  /langchain/i,
  /cohere/i,
  /huggingface/i,
  /generative-ai/i,
  /gemini/i,
  /\bllm\b/i,
  /vertex-?ai/i,
  /azure-openai/i
];

export function isAiRelatedDependency(packageName: string): boolean {
  return AI_DEPENDENCY_PATTERNS.some((pattern) => pattern.test(packageName));
}
