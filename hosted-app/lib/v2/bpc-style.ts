// FR-026 - Best Possible Comprehension is story-style [FROZEN]
// BPC is not a sentence-by-sentence repetition, a mechanical paraphrase, or merely the answers to the
// questions. It is a child-friendly, connected explanation that models how a strong reader would tell
// another person what they understood:
//   what happened -> why it happened / how ideas connect -> what mattered -> what can reasonably be understood.
//
// lintBpcStyle is a deterministic structural lint. It can REJECT content that visibly breaks the style
// rules; passing the lint is necessary but not sufficient - semantic quality (AC-P17) still needs the
// independent QA sign-off tracked on the content record (qaApproved).

export type BpcStyleSource = {
  passageText: string;
  /** The correct answers to the passage's comprehension questions. */
  questionAnswers: string[];
};

export type BpcStyleConfig = {
  version: string;
  minSentences: number;
  /** Max share of BPC sentences that may be (near-)copies of passage sentences. */
  maxCopiedShare: number;
  /** Jaccard similarity above which a BPC sentence counts as a copy of a passage sentence. */
  copySimilarity: number;
  minConnectives: number;
};

export const BPC_STYLE_CONFIG: BpcStyleConfig = Object.freeze({
  version: "bpc-style-pilot-1", minSentences: 4, maxCopiedShare: 0.34, copySimilarity: 0.7, minConnectives: 2
});

const WHY = ["because", "so ", "that is why", "since", "which meant", "this made", "so that", "as a result"];
const MEANING = ["this shows", "it shows", "this means", "it means", "what mattered", "the important", "we can tell", "we can understand", "we can see", "we learn", "this tells us"];
const CONNECTIVES = [" then ", " after ", " but ", " when ", " because ", " so ", " finally ", " next ", " first ", " before ", " and then "];

export type StyleFinding =
  | "TOO_SHORT" | "SENTENCE_BY_SENTENCE_COPY" | "ANSWER_KEY_FORM" | "NOT_CONNECTED" | "MISSING_WHY" | "MISSING_MEANING";

function sentences(text: string): string[] {
  return text.split(/(?<=[.!?])\s+|\n+/).map((s) => s.trim()).filter(Boolean);
}

function words(text: string): string[] {
  return (text.toLowerCase().match(/[a-z']+/g) ?? []);
}

function jaccard(a: string[], b: string[]): number {
  const A = new Set(a);
  const B = new Set(b);
  const inter = [...A].filter((x) => B.has(x)).length;
  const union = new Set([...A, ...B]).size;
  return union === 0 ? 0 : inter / union;
}

export function lintBpcStyle(bpcText: string, source: BpcStyleSource, config: BpcStyleConfig = BPC_STYLE_CONFIG): StyleFinding[] {
  const findings: StyleFinding[] = [];
  const bpcSentences = sentences(bpcText);
  const lower = ` ${bpcText.toLowerCase().replace(/\s+/g, " ")} `;

  if (bpcSentences.length < config.minSentences) findings.push("TOO_SHORT");

  const passageSentences = sentences(source.passageText).map(words);
  const copied = bpcSentences.filter((s) => passageSentences.some((p) => jaccard(words(s), p) >= config.copySimilarity)).length;
  if (bpcSentences.length > 0 && copied / bpcSentences.length > config.maxCopiedShare) findings.push("SENTENCE_BY_SENTENCE_COPY");

  const asList = /^\s*([-*•]|\d+[.)])\s+/m.test(bpcText) || /\banswer\s*\d*\s*:/i.test(bpcText);
  const answerWords = source.questionAnswers.map(words);
  const onlyAnswers =
    bpcSentences.length > 0 &&
    bpcSentences.every((s) => answerWords.some((a) => a.length > 0 && jaccard(words(s), a) >= 0.6));
  if (asList || onlyAnswers) findings.push("ANSWER_KEY_FORM");

  const connectives = CONNECTIVES.filter((c) => lower.includes(c)).length;
  if (connectives < config.minConnectives) findings.push("NOT_CONNECTED");
  if (!WHY.some((m) => lower.includes(m))) findings.push("MISSING_WHY");
  if (!MEANING.some((m) => lower.includes(m))) findings.push("MISSING_MEANING");
  return findings;
}
