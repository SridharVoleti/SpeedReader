import { describe, expect, it } from "vitest";
import { worldStrategies, WORLD_STRATEGIES, worldFullySpecified } from "../../../lib/v2/world-strategies";

// FR-002 - World 2+ direction [FROZEN BROAD ARCHITECTURE]
describe("FR-002 World 2+ strategy direction", () => {
  it("maps World 2-5 to their frozen strategy directions", () => {
    expect(worldStrategies(2)).toEqual(["skimming", "scanning", "keywords", "locating-information-quickly"]);
    expect(worldStrategies(3)).toEqual(["phrase-chunk-reading", "reduced-word-by-word-fixation", "important-vs-supporting-information"]);
    expect(worldStrategies(4)).toEqual(["strategic-variable-speed", "previewing", "selective-rereading", "structure-and-arguments"]);
    expect(worldStrategies(5)).toEqual(["skimming", "scanning", "chunking", "selective-deep-reading-by-purpose"]);
  });

  it("introduces no additional strategies in World 1", () => {
    expect(worldStrategies(1)).toEqual([]);
  });

  it("records World 2-5 competency maps as future specs that do not block World 1", () => {
    expect(worldFullySpecified(1)).toBe(true);
    for (const id of [2, 3, 4, 5]) expect(worldFullySpecified(id)).toBe(false);
    expect(Object.keys(WORLD_STRATEGIES)).toEqual(["1", "2", "3", "4", "5"]);
  });
});
