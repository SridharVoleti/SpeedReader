// SR-001 - World 1 passage difficulty is constant; only length steps up, once per 150-passage batch.
// The length ladder is configuration, deliberately separate from the complexity profile.

import { WORLD1_PASSAGE_COUNT } from "../v2/catalog";

export const BATCH_SIZE = 150;

/** Approved complexity profile shared by every World 1 passage. */
export type Complexity = { maxSentenceWords: number; vocabularyBand: string; maxClausesPerSentence: number };
export const COMPLEXITY_PROFILE: Readonly<Complexity> = Object.freeze({ maxSentenceWords: 14, vocabularyBand: "A", maxClausesPerSentence: 2 });

/** Target words per passage for each 150-passage batch (10 batches = 1,500 passages). */
export const LENGTH_LADDER: readonly number[] = Object.freeze([80, 100, 120, 140, 160, 180, 200, 220, 240, 260]);

export type PassageSpec = { sequence: number; lengthBand: number; targetWords: number; complexity: Complexity };

export function lengthBandFor(sequence: number): number {
  if (!Number.isInteger(sequence) || sequence < 1 || sequence > WORLD1_PASSAGE_COUNT) throw new RangeError(`passage ${sequence} outside 1..${WORLD1_PASSAGE_COUNT}`);
  return Math.floor((sequence - 1) / BATCH_SIZE);
}

export function passageSpecFor(sequence: number): PassageSpec {
  const lengthBand = lengthBandFor(sequence);
  return { sequence, lengthBand, targetWords: LENGTH_LADDER[lengthBand], complexity: COMPLEXITY_PROFILE };
}

export function validateSpecDifficulty(spec: PassageSpec): string[] {
  return (Object.keys(COMPLEXITY_PROFILE) as (keyof Complexity)[])
    .filter((k) => spec.complexity[k] !== COMPLEXITY_PROFILE[k])
    .map((k) => `complexity.${k} drifts from approved profile`);
}
