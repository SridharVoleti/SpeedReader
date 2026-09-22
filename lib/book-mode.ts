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
