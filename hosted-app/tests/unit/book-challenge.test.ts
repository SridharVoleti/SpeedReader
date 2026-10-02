import { describe, expect, it } from "vitest";
import { addReadingBlock, BookChallenge, ReadingBlock, summarizeBookChallenge } from "../../lib/book-mode";

// SR-R10-001: Book Challenge.
// "Support long-form challenge with word count, schedule, reading blocks and checkpoints."
// "Challenge resumes/completes; total valid time/words reconcile with block records."
const BOOK: BookChallenge = { bookId: "book-1", totalWords: 1000, blocks: [] };

describe("summarizeBookChallenge", () => {
  it("reports NOT_STARTED with zero totals for a challenge with no blocks yet", () => {
    const summary = summarizeBookChallenge(BOOK);

    expect(summary.status).toBe("NOT_STARTED");
    expect(summary.totalValidSeconds).toBe(0);
    expect(summary.totalValidWordsRead).toBe(0);
  });

  it("reconciles total valid time/words with the sum of valid block records, excluding invalid blocks", () => {
    const block1: ReadingBlock = { blockId: "b1", startSeconds: 0, endSeconds: 300, wordsRead: 400, valid: true };
    const block2: ReadingBlock = { blockId: "b2", startSeconds: 300, endSeconds: 400, wordsRead: 100, valid: false };
    const challenge = addReadingBlock(addReadingBlock(BOOK, block1), block2);

    const summary = summarizeBookChallenge(challenge);

    expect(summary.totalValidSeconds).toBe(300);
    expect(summary.totalValidWordsRead).toBe(400);
    expect(summary.status).toBe("IN_PROGRESS");
  });

  it("supports resuming across multiple blocks and reaching COMPLETED once valid words meet the total", () => {
    let challenge = BOOK;
    challenge = addReadingBlock(challenge, { blockId: "b1", startSeconds: 0, endSeconds: 300, wordsRead: 400, valid: true });
    challenge = addReadingBlock(challenge, { blockId: "b2", startSeconds: 500, endSeconds: 800, wordsRead: 400, valid: true }); // resumed later
    let summary = summarizeBookChallenge(challenge);
    expect(summary.status).toBe("IN_PROGRESS");
    expect(summary.totalValidWordsRead).toBe(800);

    challenge = addReadingBlock(challenge, { blockId: "b3", startSeconds: 900, endSeconds: 1000, wordsRead: 200, valid: true });
    summary = summarizeBookChallenge(challenge);

    expect(summary.status).toBe("COMPLETED");
    expect(summary.totalValidWordsRead).toBe(1000);
    expect(summary.totalValidSeconds).toBe(700);
  });

  it("is deterministic for identical inputs", () => {
    const challenge = addReadingBlock(BOOK, { blockId: "b1", startSeconds: 0, endSeconds: 300, wordsRead: 400, valid: true });
    expect(summarizeBookChallenge(challenge)).toEqual(summarizeBookChallenge(challenge));
  });
});
