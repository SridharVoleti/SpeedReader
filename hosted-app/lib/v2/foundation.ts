// FR-004 - First 150 passages [FROZEN]
// P1-P150 are exactly 100 words each, displayed one word at a time, and keep the approved
// 15 RS x 10 P Knowledge Map coordinates.

import { chunkWords } from "../chunking";
import { bandACoordinate, type BandACoordinate } from "../world1-framework";

export const FOUNDATION_LAST_PASSAGE = 150;
export const FOUNDATION_WORDS = 100;

export type FoundationSpec = { words: 100; display: "ONE_WORD_AT_A_TIME"; coordinate: BandACoordinate };

export function isFoundationPassage(sequence: number): boolean {
  return Number.isInteger(sequence) && sequence >= 1 && sequence <= FOUNDATION_LAST_PASSAGE;
}

export function foundationSpec(sequence: number): FoundationSpec {
  if (!isFoundationPassage(sequence)) throw new RangeError("Foundation passages are 1..150");
  return { words: FOUNDATION_WORDS, display: "ONE_WORD_AT_A_TIME", coordinate: bandACoordinate(sequence) };
}

function wordsOf(text: string): string[] {
  return text.trim().split(/\s+/).filter(Boolean);
}

export function validateFoundationPassageText(text: string): string[] {
  const count = wordsOf(text).length;
  return count === FOUNDATION_WORDS ? [] : [`passage must be exactly ${FOUNDATION_WORDS} words, got ${count}`];
}

/** One word per presentation step. */
export function presentationChunks(text: string): string[][] {
  return chunkWords(wordsOf(text), 1);
}
