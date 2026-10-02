// FR-023 / CODEX-07 - Spoken comprehension expression evaluator [FROZEN]
// The learner explains the passage in their own words, "telling the story to someone". The evaluator
// rewards, where the passage supports it: relevance, key events/ideas, supporting details,
// connections between ideas, cause/effect or motivation, coherent sequencing, and clarity/completeness.
//
// It is deterministic and works only from authored idea definitions (each with accepted wordings, so
// age-appropriate wording and dialect are first-class). It never scores vocabulary sophistication,
// accent, or ordinary grammar variation: only whether the authored ideas are present, in sensible order
// and connected. It returns component evidence, evidence coverage, an uncertainty/technical state, and
// short positive coaching signals.

import { stem } from "./stem";

export type IdeaRole = "KEY_EVENT" | "DETAIL" | "CAUSE_EFFECT" | "MOTIVATION";

export type AuthoredIdea = {
  ideaId: string;
  role: IdeaRole;
  /** Accepted wordings; each wording is a set of word stems that must all appear (any order) in one sentence. */
  wordings: string[][];
};

export type SpokenPassageMeta = {
  passageId: string;
  /** Ideas in the order they occur in the passage. */
  ideas: AuthoredIdea[];
};

export type SpokenExpressionConfig = {
  version: string;
  /** Component weights; must sum to 1. */
  weights: { relevance: number; keyIdeas: number; details: number; connections: number; sequencing: number; clarity: number };
  /** Minimum sentences/words for a response to count as a retelling (clarity/completeness). */
  minWordsForCompleteness: number;
};

export const SPOKEN_EXPRESSION_CONFIG: SpokenExpressionConfig = Object.freeze({
  version: "spoken-expression-pilot-1",
  weights: Object.freeze({ relevance: 0.15, keyIdeas: 0.3, details: 0.15, connections: 0.15, sequencing: 0.1, clarity: 0.15 }),
  minWordsForCompleteness: 12
});

export type SpokenComponents = {
  relevance: number;
  keyIdeas: number;
  details: number;
  connections: number;
  sequencing: number;
  clarity: number;
};

export type SpokenEvaluation = {
  uncertainty: "CLEAR";
  configVersion: string;
  score: number;
  components: SpokenComponents;
  /** Share of authored ideas found in the response (0..1). */
  evidenceCoverage: number;
  matchedIdeaIds: string[];
  /** Short, positive coaching signals - never negative state labels. */
  coaching: string[];
};

const CONNECTIVES = ["because", "so", "then", "after", "before", "when", "but", "and then", "finally", "first", "next", "since", "that is why", "so that"];

function sentencesOf(text: string): string[] {
  return text.split(/[.!?\n]+/).map((s) => s.trim()).filter(Boolean);
}

function stemsOf(sentence: string): Set<string> {
  return new Set(sentence.split(/\s+/).map(stem).filter(Boolean));
}

function ideaPresent(idea: AuthoredIdea, sentenceStems: Set<string>[]): number {
  // Index of the first sentence completing one accepted wording, or -1. A wording may be satisfied
  // across a sentence and the one before it, so a pronoun ("She felt sad.") still carries the idea.
  return sentenceStems.findIndex((stems, idx) => {
    const window = idx > 0 ? new Set([...sentenceStems[idx - 1], ...stems]) : stems;
    return idea.wordings.some((w) => w.every((k) => window.has(stem(k))));
  });
}

function ratio(found: number, total: number): number {
  return total === 0 ? 1 : found / total;
}

export function evaluateSpokenExpression(
  transcript: string,
  meta: SpokenPassageMeta,
  config: SpokenExpressionConfig = SPOKEN_EXPRESSION_CONFIG
): SpokenEvaluation {
  const sentences = sentencesOf(transcript);
  const sentenceStems = sentences.map(stemsOf);
  const wordCount = transcript.split(/\s+/).filter(Boolean).length;

  const positions = new Map<string, number>();
  for (const idea of meta.ideas) {
    const at = ideaPresent(idea, sentenceStems);
    if (at >= 0) positions.set(idea.ideaId, at);
  }
  const matched = meta.ideas.filter((i) => positions.has(i.ideaId));

  const byRole = (roles: IdeaRole[]) => meta.ideas.filter((i) => roles.includes(i.role));
  const foundIn = (roles: IdeaRole[]) => byRole(roles).filter((i) => positions.has(i.ideaId)).length;

  const keyIdeas = ratio(foundIn(["KEY_EVENT", "CAUSE_EFFECT", "MOTIVATION"]), byRole(["KEY_EVENT", "CAUSE_EFFECT", "MOTIVATION"]).length);
  const details = ratio(foundIn(["DETAIL"]), byRole(["DETAIL"]).length);
  // Relevance: share of sentences that touch at least one authored idea keyword.
  const ideaStems = new Set(meta.ideas.flatMap((i) => i.wordings.flat().map(stem)));
  const relevance = sentences.length === 0 ? 0 : sentenceStems.filter((stems) => [...stems].some((t) => ideaStems.has(t))).length / sentences.length;

  // Connections: sentences that carry a connective AND an authored idea, or link two ideas.
  const lowerSentences = sentences.map((s) => ` ${s.toLowerCase()} `);
  const connectedSentences = lowerSentences.filter((s, idx) => CONNECTIVES.some((c) => s.includes(` ${c} `)) && matched.some((i) => positions.get(i.ideaId) === idx)).length;
  const connections = Math.min(1, connectedSentences / Math.max(1, Math.min(3, meta.ideas.length - 1)));

  // Sequencing: share of adjacent matched ideas that appear in passage order.
  const order = matched.map((i) => positions.get(i.ideaId)!);
  const pairs = Math.max(0, order.length - 1);
  const inOrder = order.slice(1).filter((p, idx) => p >= order[idx]).length;
  const sequencing = pairs === 0 ? (matched.length > 0 ? 1 : 0) : inOrder / pairs;

  // Clarity/completeness: enough said, and the key ideas covered. Word choice is never scored.
  const clarity = Math.min(1, wordCount / config.minWordsForCompleteness) * (0.5 + 0.5 * keyIdeas);

  const components: SpokenComponents = { relevance, keyIdeas, details, connections, sequencing, clarity };
  const w = config.weights;
  const score = Math.max(0, Math.min(1,
    w.relevance * relevance + w.keyIdeas * keyIdeas + w.details * details +
    w.connections * connections + w.sequencing * sequencing + w.clarity * clarity));

  const coaching: string[] = [];
  if (keyIdeas >= 0.75) coaching.push("You told the main parts of the story clearly.");
  if (connections >= 0.5) coaching.push("Nice job joining ideas with words like because and then.");
  if (details < 0.5 && keyIdeas >= 0.5) coaching.push("Next time, try adding one small detail you noticed.");
  if (keyIdeas < 0.5) coaching.push("Try telling what happened first, then what happened next.");

  return {
    uncertainty: "CLEAR",
    configVersion: config.version,
    score,
    components,
    evidenceCoverage: ratio(matched.length, meta.ideas.length),
    matchedIdeaIds: matched.map((i) => i.ideaId),
    coaching
  };
}
