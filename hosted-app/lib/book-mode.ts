// SR-R10-001: Book Challenge.
// "Support long-form challenge with word count, schedule, reading blocks and checkpoints."
// "Challenge resumes/completes; total valid time/words reconcile with block records." A challenge
// is just an append-only list of reading blocks - resuming later is simply adding another block -
// and the summary always reconciles exactly with the sum of valid block records, excluding any
// invalid (e.g. interrupted) block entirely.

export type ReadingBlock = {
  blockId: string;
  startSeconds: number;
  endSeconds: number;
  wordsRead: number;
  valid: boolean;
};

export type BookChallenge = {
  bookId: string;
  totalWords: number;
  blocks: ReadingBlock[];
};

export function addReadingBlock(challenge: BookChallenge, block: ReadingBlock): BookChallenge {
  return { ...challenge, blocks: [...challenge.blocks, block] };
}

export type BookChallengeStatus = "NOT_STARTED" | "IN_PROGRESS" | "COMPLETED";

export type BookChallengeSummary = {
  bookId: string;
  totalWords: number;
  totalValidSeconds: number;
  totalValidWordsRead: number;
  status: BookChallengeStatus;
};

export function summarizeBookChallenge(challenge: BookChallenge): BookChallengeSummary {
  const validBlocks = challenge.blocks.filter((block) => block.valid);
  const totalValidSeconds = validBlocks.reduce((sum, block) => sum + (block.endSeconds - block.startSeconds), 0);
  const totalValidWordsRead = validBlocks.reduce((sum, block) => sum + block.wordsRead, 0);

  const status: BookChallengeStatus =
    challenge.blocks.length === 0 ? "NOT_STARTED" : totalValidWordsRead >= challenge.totalWords ? "COMPLETED" : "IN_PROGRESS";

  return {
    bookId: challenge.bookId,
    totalWords: challenge.totalWords,
    totalValidSeconds,
    totalValidWordsRead,
    status
  };
}

// SR-R10-002: Book ETA.
// "Estimate completion from appropriate sustainable/book rate, not peak short CRR."
// "ETA uses configured book-rate source; peak CRR alone cannot override it." Which WPM value
// feeds the estimate is decided purely by the explicit rateSource - a higher peak CRR is never
// implicitly preferred, however large it is.
export type BookRateSource = "sustainable" | "peak_crr";

export type BookEtaInputs = {
  remainingWords: number;
  peakCrrWpm: number;
  sustainableWpm: number;
  rateSource: BookRateSource;
};

export type BookEtaResult = {
  estimatedMinutes: number;
  rateSource: BookRateSource;
  wpmUsed: number;
};

export function estimateBookEta(inputs: BookEtaInputs): BookEtaResult {
  const wpmUsed = inputs.rateSource === "sustainable" ? inputs.sustainableWpm : inputs.peakCrrWpm;
  const estimatedMinutes = wpmUsed > 0 ? inputs.remainingWords / wpmUsed : Infinity;

  return { estimatedMinutes, rateSource: inputs.rateSource, wpmUsed };
}

// SR-R10-003: Section mental-model checks.
// "Test section/chapter understanding without over-testing every paragraph."
// "Checkpoint links to section-level constructs/evidence and contributes independently of
//  speed." A checkpoint fires only at the configured section-level paragraph interval - never
// per paragraph - and its comprehension score is computed purely from checkpoint evidence; the
// effective reading speed is accepted for reporting only and never enters the computation.
export function shouldTriggerCheckpoint(paragraphIndex: number, checkpointIntervalParagraphs: number): boolean {
  return paragraphIndex > 0 && paragraphIndex % checkpointIntervalParagraphs === 0;
}

export type CheckpointEvidence = {
  checkpointId: string;
  sectionId: string;
  constructsAssessed: string[];
  correct: number;
  total: number;
};

export type CheckpointContribution = {
  checkpointId: string;
  sectionId: string;
  constructsAssessed: string[];
  comprehensionScore: number;
};

export function buildCheckpointContribution(evidence: CheckpointEvidence, effectiveWpm: number): CheckpointContribution {
  void effectiveWpm; // accepted for reporting context only - never feeds the comprehension score
  return {
    checkpointId: evidence.checkpointId,
    sectionId: evidence.sectionId,
    constructsAssessed: evidence.constructsAssessed,
    comprehensionScore: evidence.total > 0 ? evidence.correct / evidence.total : 0
  };
}

// SR-R10-004: Book-level certification.
// "Report actual time, effective rate, comprehension and retention separately."
// "Fast completion cannot be certified as book-level success if configured
//  comprehension/retention gates fail." (TC-R10-004-B) Time/rate are always reported regardless
// of the outcome - a fast completion never buys its way past a failing comprehension or
// (when mandatory) retention gate.
export type BookCompletionReport = {
  actualMinutes: number;
  effectiveWpm: number;
  comprehensionScore: number;
  retentionScore: number | null;
};

export type BookCertificationGates = {
  comprehensionPassThreshold: number;
  retentionPassThreshold: number;
  retentionRequired: boolean;
};

export type BookCertificationResult = BookCompletionReport & {
  certified: boolean;
  reasonCode: string;
};

export function evaluateBookCertification(report: BookCompletionReport, gates: BookCertificationGates): BookCertificationResult {
  const comprehensionPassed = report.comprehensionScore >= gates.comprehensionPassThreshold;
  const retentionPassed = report.retentionScore !== null && report.retentionScore >= gates.retentionPassThreshold;

  let certified = true;
  let reasonCode = "CERTIFIED";

  if (!comprehensionPassed) {
    certified = false;
    reasonCode = "COMPREHENSION_GATE_NOT_MET";
  } else if (gates.retentionRequired && !retentionPassed) {
    certified = false;
    reasonCode = "RETENTION_GATE_NOT_MET";
  }

  return { ...report, certified, reasonCode };
}

// SR-R10-005: 200-page goal measurement.
// "Use actual word count when available; distinguish page estimate from measured word count."
// "Known words use words/time; page-only input is labeled estimated using configurable
//  words/page assumption." (TC-R10-005-B) A page-only input can never masquerade as a measured
// word count - it is always tagged isEstimated with the exact assumption that produced it.
export type WordCountSource = "measured" | "page_estimate";

export type WordCountInput = { source: "measured"; wordCount: number } | { source: "page_estimate"; pageCount: number };

export type WordCountResult = {
  wordCountSource: WordCountSource;
  wordCount: number;
  isEstimated: boolean;
  wordsPerPageAssumption: number | null;
};

export function resolveWordCount(input: WordCountInput, wordsPerPageAssumption = 250): WordCountResult {
  if (input.source === "measured") {
    return { wordCountSource: "measured", wordCount: input.wordCount, isEstimated: false, wordsPerPageAssumption: null };
  }

  return {
    wordCountSource: "page_estimate",
    wordCount: input.pageCount * wordsPerPageAssumption,
    isEstimated: true,
    wordsPerPageAssumption
  };
}
