// TypeScript port of backend/speed_reading/scoring.py.
// Keep the point weights and thresholds in sync with the Python module.

export type ComprehensionConfig = {
  minimumResponseWords: number;
  requiredKeywords: string[];
  concepts: string[];
  synonyms: Record<string, string[]>;
  copyLimit: number;
};

export type PassageData = {
  // SR-R1-003: approved-file-only content - every passage must declare these to be loadable.
  content_id: string;
  content_version: string;
  schema_version: string;
  approval_status: "WIP" | "APPROVED" | "RETIRED";
  level: number;
  title: string;
  category: string;
  difficulty: string;
  estimatedAgeRange: string;
  wordCount: number;
  content: string;
  comprehension: ComprehensionConfig;
};

export type ScoreResult = {
  score: number;
  passed: boolean;
  lengthPoints: number;
  keywordPoints: number;
  conceptPoints: number;
  originalityPoints: number;
  coherencePoints: number;
  feedback: string[];
};

const WORD_RE = /[a-zA-Z']+/g;

export function normalizeWords(text: string): string[] {
  return (text.match(WORD_RE) ?? []).map((word) => word.toLowerCase().replace(/^'+|'+$/g, ""));
}

export function scoreComprehension(
  passage: PassageData,
  response: string,
  passThreshold = 70
): ScoreResult {
  const responseWords = normalizeWords(response);
  const passageWords = normalizeWords(passage.content);
  const responseText = responseWords.join(" ");

  const lengthPoints = scoreLength(responseWords.length, passage.comprehension.minimumResponseWords);
  const keywordPoints = scoreKeywords(
    responseText,
    passage.comprehension.requiredKeywords,
    passage.comprehension.synonyms
  );
  const conceptPoints = scoreConcepts(responseText, passage.comprehension.concepts);
  const originalityPoints = scoreOriginality(
    responseWords,
    passageWords,
    passage.comprehension.copyLimit
  );
  const coherencePoints = scoreCoherence(responseWords);

  const total = lengthPoints + keywordPoints + conceptPoints + originalityPoints + coherencePoints;
  return {
    score: total,
    passed: total >= passThreshold,
    lengthPoints,
    keywordPoints,
    conceptPoints,
    originalityPoints,
    coherencePoints,
    feedback: buildFeedback(
      total,
      lengthPoints,
      keywordPoints,
      conceptPoints,
      originalityPoints,
      coherencePoints
    )
  };
}

function scoreLength(wordCount: number, minimum: number): number {
  if (wordCount >= minimum) return 15;
  return minimum ? Math.round(15 * (wordCount / minimum)) : 0;
}

function scoreKeywords(
  responseText: string,
  requiredKeywords: string[],
  synonyms: Record<string, string[]>
): number {
  if (!requiredKeywords.length) return 0;
  let matches = 0;
  for (const keyword of requiredKeywords) {
    const acceptedTerms = [keyword.toLowerCase(), ...(synonyms[keyword] ?? []).map((t) => t.toLowerCase())];
    if (acceptedTerms.some((term) => containsTerm(responseText, term))) {
      matches += 1;
    }
  }
  return Math.round(30 * (matches / requiredKeywords.length));
}

function scoreConcepts(responseText: string, concepts: string[]): number {
  if (!concepts.length) return 0;
  let matched = 0;
  for (const concept of concepts) {
    const conceptWords = new Set(normalizeWords(concept));
    if (!conceptWords.size) continue;
    let overlap = 0;
    for (const word of conceptWords) {
      if (containsTerm(responseText, word)) overlap += 1;
    }
    if (overlap / conceptWords.size >= 0.45) matched += 1;
  }
  return Math.round(35 * (matched / concepts.length));
}

function scoreOriginality(
  responseWords: string[],
  passageWords: string[],
  copyLimit: number
): number {
  if (!responseWords.length) return 0;
  const similarity = sequenceSimilarity(responseWords.join(" "), passageWords.join(" "));
  if (similarity <= copyLimit) return 10;
  if (similarity >= 0.9) return 0;
  return Math.round(10 * ((0.9 - similarity) / (0.9 - copyLimit)));
}

function scoreCoherence(responseWords: string[]): number {
  if (responseWords.length < 5) return 0;
  const uniqueRatio = new Set(responseWords).size / responseWords.length;
  if (uniqueRatio < 0.35) return 3;
  return 10;
}

function containsTerm(text: string, term: string): boolean {
  const escaped = term.toLowerCase().replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(`\\b${escaped}\\b`).test(text);
}

// Ratcliff-Obershelp similarity, matching Python's difflib.SequenceMatcher.ratio().
function sequenceSimilarity(a: string, b: string): number {
  if (!a.length && !b.length) return 1;
  return (2 * matchingCharacters(a, b, 0, a.length, 0, b.length)) / (a.length + b.length);
}

function matchingCharacters(
  a: string,
  b: string,
  aLow: number,
  aHigh: number,
  bLow: number,
  bHigh: number
): number {
  let bestI = aLow;
  let bestJ = bLow;
  let bestSize = 0;
  let runLengths = new Map<number, number>();
  for (let i = aLow; i < aHigh; i++) {
    const newRunLengths = new Map<number, number>();
    for (let j = bLow; j < bHigh; j++) {
      if (a[i] !== b[j]) continue;
      const k = (runLengths.get(j - 1) ?? 0) + 1;
      newRunLengths.set(j, k);
      if (k > bestSize) {
        bestI = i - k + 1;
        bestJ = j - k + 1;
        bestSize = k;
      }
    }
    runLengths = newRunLengths;
  }
  if (!bestSize) return 0;
  return (
    bestSize +
    matchingCharacters(a, b, aLow, bestI, bLow, bestJ) +
    matchingCharacters(a, b, bestI + bestSize, aHigh, bestJ + bestSize, bHigh)
  );
}

function buildFeedback(
  total: number,
  lengthPoints: number,
  keywordPoints: number,
  conceptPoints: number,
  originalityPoints: number,
  coherencePoints: number
): string[] {
  const notes: string[] = [];
  if (total >= 70) {
    notes.push("Good recall. You captured enough of the passage to move ahead.");
  } else {
    notes.push("Try again and include the main idea plus two important details.");
  }
  if (lengthPoints < 15) notes.push("Write a little more so your answer has enough detail.");
  if (keywordPoints < 20) notes.push("Mention more important names, objects, or actions from the passage.");
  if (conceptPoints < 24) notes.push("Focus on what happened and what the passage teaches.");
  if (originalityPoints < 7) notes.push("Use your own words instead of copying the passage.");
  if (coherencePoints < 10) notes.push("Write complete, clear sentences.");
  return notes;
}
