import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { passageSpecFor, validateSpecDifficulty, lengthBandFor, setActiveProfile } from "../../../lib/sr/passage-progression";
import { FIXTURE_PROFILE } from "./helpers/profile";

const COMPLEXITY_PROFILE = FIXTURE_PROFILE.complexity;
const LENGTH_LADDER = FIXTURE_PROFILE.lengthSchedule.map((s) => s.targetWords);

// SR-001 - World 1 difficulty constant; length steps per the approved schedule (fixture values, not canonical).
describe("SR-001 consistent difficulty, length ladder", () => {
  beforeAll(() => setActiveProfile(FIXTURE_PROFILE));
  afterAll(() => setActiveProfile(null));
  it("every passage in World 1 has the identical complexity profile", () => {
    const profiles = new Set([1, 150, 151, 700, 1500].map((n) => JSON.stringify(passageSpecFor(n).complexity)));
    expect(profiles.size).toBe(1);
    expect(passageSpecFor(1).complexity).toEqual(COMPLEXITY_PROFILE);
  });
  it("length band is constant inside a batch and changes at the boundary", () => {
    expect(lengthBandFor(1)).toBe(lengthBandFor(150));
    expect(lengthBandFor(151)).not.toBe(lengthBandFor(150));
    expect(passageSpecFor(151).targetWords).toBeGreaterThan(passageSpecFor(150).targetWords);
  });
  it("ladder has non-decreasing steps covering 1,500", () => {
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
