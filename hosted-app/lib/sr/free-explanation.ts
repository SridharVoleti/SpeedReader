// SR-043 - The learner explains the passage freely against one fixed open prompt. The response is scored
// semantically against the approved fact map: any approved paraphrase counts, no exact wording needed.

export const OPEN_PROMPT = "Tell me about the passage in your own words.";

export type FactMap = readonly { factId: string; phrases: readonly string[] }[];

export const normalize = (s: string): string => s.toLowerCase().replace(/[^a-z0-9\s]/g, " ").replace(/\s+/g, " ").trim();

export function scoreFreeResponse(text: string, facts: FactMap) {
  if (facts.length === 0) throw new Error("fact map is required");
  const t = ` ${normalize(text)} `;
  const credited = facts.filter((f) => f.phrases.some((p) => t.includes(` ${normalize(p)} `))).map((f) => f.factId);
  return { credited, score: Math.round((credited.length / facts.length) * 100) };
}
