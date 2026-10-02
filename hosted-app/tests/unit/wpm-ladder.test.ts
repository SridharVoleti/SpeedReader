import { describe, expect, it } from "vitest";
import {
  buildLevelsFromLadder,
  currentRate,
  isUnlocked,
  levels,
  nextRate,
  Progress,
  recordResult,
  WorldInfo
} from "../../lib/progression";
import progressionData from "../../data/progression.json";

// SR-R1-011: Configurable WPM ladder.
// "Use a file/config-based WPM ladder rather than hard-coded values."
// "Changing configuration changes eligible speeds without code change; locked rates cannot be
//  skipped normally."
describe("buildLevelsFromLadder", () => {
  it("derives levels purely from the worlds/speedSteps/passThreshold configuration", () => {
    const worlds: WorldInfo[] = [
      { world: 1, wordsPerChunk: 1, name: "World 1" },
      { world: 2, wordsPerChunk: 2, name: "World 2" }
    ];
    const derived = buildLevelsFromLadder(worlds, [50, 75, 100], 60);

    expect(derived).toEqual([
      { id: 1, world: 1, step: 1, wordsPerChunk: 1, wpm: 50, passThreshold: 60 },
      { id: 2, world: 1, step: 2, wordsPerChunk: 1, wpm: 75, passThreshold: 60 },
      { id: 3, world: 1, step: 3, wordsPerChunk: 1, wpm: 100, passThreshold: 60 },
      { id: 4, world: 2, step: 1, wordsPerChunk: 2, wpm: 50, passThreshold: 60 },
      { id: 5, world: 2, step: 2, wordsPerChunk: 2, wpm: 75, passThreshold: 60 },
      { id: 6, world: 2, step: 3, wordsPerChunk: 2, wpm: 100, passThreshold: 60 }
    ]);
  });

  it("changing the speed step values alone changes eligible speeds - no code change needed", () => {
    const worlds: WorldInfo[] = [{ world: 1, wordsPerChunk: 1, name: "World 1" }];
    const original = buildLevelsFromLadder(worlds, [100, 200], 70);
    const reconfigured = buildLevelsFromLadder(worlds, [30, 60, 90], 70);

    expect(original.map((l) => l.wpm)).toEqual([100, 200]);
    expect(reconfigured.map((l) => l.wpm)).toEqual([30, 60, 90]);
  });

  it("the app's real level ladder is exactly what the config file derives - no baked duplicate", () => {
    const derived = buildLevelsFromLadder(
      progressionData.worlds,
      progressionData.speedSteps,
      progressionData.passThreshold
    );
    expect(levels).toEqual(derived);
  });

  it("exposes a speed_ladder_id identifying which configuration produced the ladder", () => {
    expect(typeof progressionData.speedLadderId).toBe("string");
    expect((progressionData.speedLadderId as string).length).toBeGreaterThan(0);
  });
});

describe("currentRate / nextRate", () => {
  it("reports the first ladder rate as current, and the following rate as next, before any progress", () => {
    const progress: Progress = {};
    expect(currentRate(progress)).toBe(levels[0].wpm);
    expect(nextRate(progress)).toBe(levels[1].wpm);
  });

  it("advances current/next rate as levels are passed", () => {
    let progress: Progress = {};
    progress = recordResult(progress, levels[0], 100);

    expect(currentRate(progress)).toBe(levels[1].wpm);
    expect(nextRate(progress)).toBe(levels[2].wpm);
  });

  it("reports no current/next rate once every level is passed", () => {
    let progress: Progress = {};
    for (const level of levels) {
      progress = recordResult(progress, level, 100);
    }
    expect(currentRate(progress)).toBeNull();
    expect(nextRate(progress)).toBeNull();
  });
});

describe("locked rates cannot be skipped", () => {
  it("a level stays locked until its immediate predecessor is passed", () => {
    const progress: Progress = {};
    expect(isUnlocked(progress, levels[0])).toBe(true);
    expect(isUnlocked(progress, levels[1])).toBe(false);
    expect(isUnlocked(progress, levels[5])).toBe(false);
  });

  it("passing level N unlocks only level N+1, not further ahead", () => {
    const progress = recordResult({}, levels[0], 100);
    expect(isUnlocked(progress, levels[1])).toBe(true);
    expect(isUnlocked(progress, levels[2])).toBe(false);
  });
});
