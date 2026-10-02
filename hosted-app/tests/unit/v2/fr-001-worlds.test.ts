import { describe, expect, it } from "vitest";
import { WORLDS, DIFFICULTY_GROWTH_DIMENSIONS, startingWorld, worldById } from "../../../lib/v2/worlds";

// FR-001 - Five content-difficulty Worlds [FROZEN]
describe("FR-001 five content-difficulty Worlds", () => {
  it("defines exactly five Worlds, ordered, with the frozen difficulty labels", () => {
    expect(WORLDS.map((w) => [w.id, w.difficulty])).toEqual([
      [1, "VERY SIMPLE"],
      [2, "SIMPLE"],
      [3, "MEDIUM"],
      [4, "HARD"],
      [5, "VERY HARD"]
    ]);
  });

  it("starts every learner in World 1 regardless of age", () => {
    for (const age of [5, 7, 10, 14, 18, 45, undefined]) {
      expect(startingWorld({ age }).id).toBe(1);
    }
  });

  it("has no age-group libraries: Worlds carry no age band", () => {
    for (const w of WORLDS) expect(Object.keys(w)).not.toContain("ageBand");
  });

  it("grows World 1 difficulty through reading dimensions, not vocabulary complexity", () => {
    expect(DIFFICULTY_GROWTH_DIMENSIONS).toEqual([
      "reading-speed", "passage-length-stamina", "comprehension", "expression", "fluency", "independence"
    ]);
    expect(DIFFICULTY_GROWTH_DIMENSIONS).not.toContain("vocabulary-complexity");
    expect(worldById(1).vocabularyPolicy).toBe("ACCESSIBLE_NATURAL");
  });

  it("looks up Worlds by id and rejects unknown ids", () => {
    expect(worldById(3).difficulty).toBe("MEDIUM");
    expect(() => worldById(6)).toThrow();
    expect(() => worldById(0)).toThrow();
  });
});
