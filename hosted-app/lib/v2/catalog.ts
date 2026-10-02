// FR-003 - 1,500 canonical passages [FROZEN]
// World 1 contains exactly 1,500 canonical sequential passages; the first 150 keep the approved
// 15 RS x 10 P architecture (coordinates come from the frozen Knowledge Map framework).

import { bandACoordinate, type BandACoordinate } from "../world1-framework";

export const WORLD1_PASSAGE_COUNT = 1500;

export function validateWorld1Catalog(passages: readonly { sequence: number }[]): string[] {
  const errors: string[] = [];
  if (passages.length !== WORLD1_PASSAGE_COUNT) {
    errors.push(`expected exactly ${WORLD1_PASSAGE_COUNT} passages, got ${passages.length}`);
  }
  const seen = new Set<number>();
  for (const p of passages) {
    if (seen.has(p.sequence)) errors.push(`duplicate sequence ${p.sequence}`);
    seen.add(p.sequence);
  }
  for (let s = 1; s <= WORLD1_PASSAGE_COUNT; s += 1) {
    if (!seen.has(s)) errors.push(`missing sequence ${s}`);
  }
  const firstMismatch = passages.findIndex((p, i) => p.sequence !== i + 1);
  if (firstMismatch >= 0 && errors.every((e) => !e.startsWith("duplicate") && !e.startsWith("missing"))) {
    errors.push(`out of order at index ${firstMismatch}`);
  }
  return errors;
}

export function first150Architecture(): BandACoordinate[] {
  return Array.from({ length: 150 }, (_, i) => bandACoordinate(i + 1));
}
