"use client";

// SR-R10-001: Book Challenge.
// A reachable demo proving a book challenge resumes/completes across multiple reading blocks,
// with total valid time/words always reconciling exactly with the block records (an invalid
// block contributes nothing).

import { useState } from "react";
import { addReadingBlock, BookChallenge, ReadingBlock, summarizeBookChallenge } from "../../lib/book-mode";
import styles from "../page.module.css";

const INITIAL_BOOK: BookChallenge = { bookId: "book-1", totalWords: 1000, blocks: [] };

const BLOCKS_TO_ADD: ReadingBlock[] = [
  { blockId: "b1", startSeconds: 0, endSeconds: 300, wordsRead: 400, valid: true },
  { blockId: "b2", startSeconds: 500, endSeconds: 800, wordsRead: 400, valid: true },
  { blockId: "b3", startSeconds: 900, endSeconds: 1000, wordsRead: 200, valid: true }
];

export default function BookModeDemoPage() {
  const [challenge, setChallenge] = useState<BookChallenge>(INITIAL_BOOK);
  const summary = summarizeBookChallenge(challenge);

  function addNextBlock() {
    const nextBlock = BLOCKS_TO_ADD[challenge.blocks.length];
    if (!nextBlock) return;
    setChallenge((previous) => addReadingBlock(previous, nextBlock));
  }

  return (
    <main className={styles.shell} data-testid="book-mode-demo">
      <h1>Book Challenge</h1>
      <p className={styles.lede}>
        A book challenge resumes across reading blocks recorded over time - total valid time and
        words always reconcile exactly with the sum of the valid block records.
      </p>

      <section className={styles.stageCard} data-testid="book-challenge">
        <p data-testid="challenge-status">Status: {summary.status}</p>
        <p data-testid="blocks-recorded">Blocks recorded: {challenge.blocks.length}</p>
        <p data-testid="total-valid-words">Total valid words: {summary.totalValidWordsRead} / {summary.totalWords}</p>
        <p data-testid="total-valid-seconds">Total valid seconds: {summary.totalValidSeconds}</p>
        <div className={styles.actions}>
          <button
            type="button"
            className={styles.primaryButton}
            data-testid="add-reading-block"
            disabled={challenge.blocks.length >= BLOCKS_TO_ADD.length}
            onClick={addNextBlock}
          >
            Record next reading block (resume)
          </button>
        </div>
      </section>
    </main>
  );
}
