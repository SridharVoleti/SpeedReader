import { describe, expect, it } from "vitest";
import { LENGTH_LADDER, COMPLEXITY_PROFILE, passageSpecFor, validateSpecDifficulty, lengthBandFor } from "../../../lib/sr/passage-progression";

// SR-001 - World 1 difficulty constant; length steps up after every 150 passages (batch).
describe("SR-001 consistent difficulty, length ladder", () => {
  it("every passage in World 1 has the identical complexity profile", () => {
    const profiles = new Set([1, 150, 151, 700, 1500].map((n) => JSON.stringify(passageSpecFor(n).complexity)));
    expect(profiles.size).toBe(1);
    expect(passageSpecFor(1).complexity).toEqual(COMPLEXITY_PROFILE);
  });
  it("length band is constant inside a 150-passage batch and changes at the boundary", () => {
    expect(lengthBandFor(1)).toBe(lengthBandFor(150));
    expect(lengthBandFor(151)).not.toBe(lengthBandFor(150));
    expect(passageSpecFor(151).targetWords).toBeGreaterThan(passageSpecFor(150).targetWords);
  });
  it("ladder is configured separately, has 10 non-decreasing batches covering 1,500", () => {
    expect(LENGTH_LADDER).toHaveLength(10);
    for (let i = 1; i < LENGTH_LADDER.length; i++) expect(LENGTH_LADDER[i]).toBeGreaterThanOrEqual(LENGTH_LADDER[i - 1]);
  });
  it("rejects a spec whose complexity drifts from the profile", () => {
    const bad = { ...passageSpecFor(5), complexity: { ...COMPLEXITY_PROFILE, maxSentenceWords: 99 } };
    expect(validateSpecDifficulty(bad)).not.toEqual([]);
    expect(validateSpecDifficulty(passageSpecFor(5))).toEqual([]);
  });
  it("rejects out-of-range passage numbers", () => {
    expect(() => passageSpecFor(0)).toThrow();
    expect(() => passageSpecFor(1501)).toThrow();
  });
});
