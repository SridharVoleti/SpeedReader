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
