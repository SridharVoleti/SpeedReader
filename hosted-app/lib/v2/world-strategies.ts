// FR-002 - World 2+ direction [FROZEN BROAD ARCHITECTURE]
// Later Worlds add reading strategies. Their exact competency maps are future specifications
// and must not block World 1, so only the broad direction is encoded here.

import { worldById } from "./worlds";

export const WORLD_STRATEGIES: Readonly<Record<number, readonly string[]>> = Object.freeze({
  1: [],
  2: ["skimming", "scanning", "keywords", "locating-information-quickly"],
  3: ["phrase-chunk-reading", "reduced-word-by-word-fixation", "important-vs-supporting-information"],
  4: ["strategic-variable-speed", "previewing", "selective-rereading", "structure-and-arguments"],
  5: ["skimming", "scanning", "chunking", "selective-deep-reading-by-purpose"]
});

export function worldStrategies(worldId: number): readonly string[] {
  worldById(worldId);
  return WORLD_STRATEGIES[worldId];
}

/** Only World 1 has a full competency-map specification; World 2-5 maps are future work. */
export function worldFullySpecified(worldId: number): boolean {
  worldById(worldId);
  return worldId === 1;
}
