// FR-027 - Best Possible Comprehension fidelity [FROZEN]
// BPC may clarify and connect supported meaning but must never invent events, motives, facts, causal
// relationships, lessons, judgments or conclusions that the passage does not support.
//
// checkBpcFidelity is a deterministic gate: every content word in the BPC must be grounded in the
// passage (by stem), be neutral explanatory glue, or have been explicitly allowed by a QA reviewer for
// that passage (`qaAllowedExtras`). Anything else is reported as an unsupported term, which blocks
// approval. Passing is necessary, not sufficient: AC-P17 still requires independent semantic QA.

import { stem } from "./stem";

export type FidelitySource = {
  passageText: string;
  /** Extra words a human QA reviewer has explicitly accepted as supported for this passage. */
  qaAllowedExtras?: string[];
};

export type FidelityResult = {
  supported: boolean;
  unsupportedTerms: string[];
  /** Invention-prone cue words (motive/lesson/judgment) among the unsupported terms. */
  inventionCues: string[];
};

/** Neutral glue: function words, connectives and explanation framing that carry no new story content. */
const GLUE = new Set([
  "a", "an", "the", "and", "or", "but", "so", "then", "when", "while", "because", "since", "after", "before", "as", "if",
  "of", "to", "in", "on", "at", "by", "for", "with", "from", "up", "down", "out", "over", "into", "that", "this", "these", "those",
  "it", "its", "he", "she", "they", "them", "her", "his", "their", "him", "i", "we", "you", "your", "our",
  "is", "was", "were", "are", "be", "been", "had", "has", "have", "do", "did", "does", "not", "no", "got", "get",
  "together", "next", "first", "finally", "also", "too", "very", "more", "better", "shows", "show", "means", "mean",
  "away", "things", "thing", "story", "end", "what", "who", "how", "why", "where", "which", "there", "here", "one", "about"
]);

/** Words that tend to smuggle in unsupported motives, lessons or judgments. */
const INVENTION_CUES = new Set([
  "loved", "love", "wanted", "want", "hoped", "hope", "planned", "decided", "lesson", "should", "must", "always", "never",
  "kind", "brave", "selfish", "proud", "lazy", "clever", "silly", "wonderful", "best", "worst", "learned", "learn"
]);

function tokens(text: string): string[] {
  return text.split(/\s+/).map((w) => w.replace(/[^A-Za-z']/g, "")).filter(Boolean);
}

export function checkBpcFidelity(bpcText: string, source: FidelitySource): FidelityResult {
  const grounded = new Set(tokens(source.passageText).map(stem));
  for (const extra of source.qaAllowedExtras ?? []) grounded.add(stem(extra));
  const glue = new Set([...GLUE].map(stem));

  const unsupported: string[] = [];
  for (const raw of tokens(bpcText)) {
    const lower = raw.toLowerCase();
    const s = stem(raw);
    if (glue.has(s) || grounded.has(s)) continue;
    if (!unsupported.includes(lower)) unsupported.push(lower);
  }
  const inventionCues = unsupported.filter((t) => INVENTION_CUES.has(t));
  return { supported: unsupported.length === 0, unsupportedTerms: unsupported, inventionCues };
}
