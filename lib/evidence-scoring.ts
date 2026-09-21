// SR-R3-001: Evidence proposition schema.
// "Comprehension Engine v2": scoring moves from a flat keyword list to authored propositions -
// each with a canonical statement, a mandatory/optional flag, a set of accepted expression
// variants that all count as the same evidence, and expressions that indicate the proposition is
// being explicitly contradicted rather than merely absent.

export type Proposition = {
  propositionId: string;
  canonicalText: string;
  mandatory: boolean;
  acceptedExpressions: string[];
  contradictionExpressions: string[];
};

export type EvidenceSchema = {
  propositions: Proposition[];
};

export type SchemaValidationResult = { valid: true } | { valid: false; errors: string[] };

export function validateEvidenceSchema(schema: EvidenceSchema): SchemaValidationResult {
  const errors: string[] = [];
  const seenIds = new Set<string>();

  for (const proposition of schema.propositions) {
    if (!proposition.propositionId.trim()) {
      errors.push("a proposition has a blank propositionId");
    } else if (seenIds.has(proposition.propositionId)) {
      errors.push(`duplicate proposition_id "${proposition.propositionId}"`);
    }
    seenIds.add(proposition.propositionId);

    if (proposition.acceptedExpressions.length === 0) {
      errors.push(`proposition "${proposition.propositionId}" has no accepted expression variants`);
    }
  }

  return errors.length > 0 ? { valid: false, errors } : { valid: true };
}

const WORD_RE = /[a-zA-Z']+/g;

export function normalizeEvidenceText(text: string): string[] {
  return (text.match(WORD_RE) ?? []).map((word) => word.toLowerCase());
}

// A phrase matches when its normalized words appear as a contiguous subsequence of the response's
// normalized words - deterministic, no fuzzy/partial credit at this layer.
function containsPhrase(words: string[], phrase: string): boolean {
  const phraseWords = normalizeEvidenceText(phrase);
  if (phraseWords.length === 0) return false;
  for (let start = 0; start <= words.length - phraseWords.length; start += 1) {
    if (phraseWords.every((word, offset) => words[start + offset] === word)) return true;
  }
  return false;
}

export type PropositionMatchResult = {
  propositionId: string;
  matched: boolean;
  contradicted: boolean;
};

export function matchProposition(proposition: Proposition, normalizedWords: string[]): PropositionMatchResult {
  return {
    propositionId: proposition.propositionId,
    matched: proposition.acceptedExpressions.some((expression) => containsPhrase(normalizedWords, expression)),
    contradicted: proposition.contradictionExpressions.some((expression) =>
      containsPhrase(normalizedWords, expression)
    )
  };
}

// SR-R3-002: File-based semantic equivalence.
// "Explicitly equivalent wording receives equivalent credit." An equivalence group is an
// authored (file-defined, never fuzzy-guessed) set of phrasings - a polished gold paraphrase and
// a short child-level response alike - that all count as exactly the same evidence.
export type EquivalenceGroup = {
  equivalenceGroupId: string;
  expressions: string[];
};

export function expressionsFromGroups(groups: EquivalenceGroup[]): string[] {
  return groups.flatMap((group) => group.expressions);
}

export type GroupedProposition = {
  propositionId: string;
  canonicalText: string;
  mandatory: boolean;
  equivalenceGroups: EquivalenceGroup[];
  contradictionExpressions: string[];
};

export type GroupedMatchResult = PropositionMatchResult & { matchedGroupId: string | null };

export function matchPropositionWithGroups(
  proposition: GroupedProposition,
  normalizedWords: string[]
): GroupedMatchResult {
  for (const group of proposition.equivalenceGroups) {
    if (group.expressions.some((expression) => containsPhrase(normalizedWords, expression))) {
      return {
        propositionId: proposition.propositionId,
        matched: true,
        contradicted: false,
        matchedGroupId: group.equivalenceGroupId
      };
    }
  }
  const contradicted = proposition.contradictionExpressions.some((expression) =>
    containsPhrase(normalizedWords, expression)
  );
  return { propositionId: proposition.propositionId, matched: false, contradicted, matchedGroupId: null };
}

// SR-R3-003: Partial evidence classes.
// "Distinguish complete, partial/minimal, contradicted, irrelevant, no-evidence and
//  uninterpretable where configured." Classification is deterministic and precedence-ordered:
// contradiction of a mandatory proposition always wins, then an authored ambiguity marker
// ("where configured" - never guessed), then length, then match completeness.
export type EvidenceClass =
  | "complete"
  | "partial"
  | "contradicted"
  | "irrelevant"
  | "no_evidence"
  | "uninterpretable";

export type EvidenceClassificationConfig = {
  propositions: Proposition[];
  minimumWords: number;
  ambiguityMarkers: string[];
};

export function classifyEvidence(normalizedWords: string[], config: EvidenceClassificationConfig): EvidenceClass {
  const matches = config.propositions.map((proposition) => matchProposition(proposition, normalizedWords));

  const mandatoryContradicted = config.propositions.some(
    (proposition, index) => proposition.mandatory && matches[index].contradicted
  );
  if (mandatoryContradicted) return "contradicted";

  const isAmbiguous = config.ambiguityMarkers.some((marker) => containsPhrase(normalizedWords, marker));
  if (isAmbiguous) return "uninterpretable";

  if (normalizedWords.length < config.minimumWords) return "no_evidence";

  const matchedCount = matches.filter((match) => match.matched).length;
  if (matchedCount === 0) return "irrelevant";
  if (matchedCount === config.propositions.length) return "complete";
  return "partial";
}
