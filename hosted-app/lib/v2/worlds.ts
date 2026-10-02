// FR-001 - Five content-difficulty Worlds [FROZEN]
// Worlds are content-difficulty tiers, not age-group libraries. Every learner starts in World 1.

export type WorldDifficulty = "VERY SIMPLE" | "SIMPLE" | "MEDIUM" | "HARD" | "VERY HARD";

export type World = {
  id: 1 | 2 | 3 | 4 | 5;
  difficulty: WorldDifficulty;
  /** World 1 language stays accessible and natural; difficulty must not come from vocabulary. */
  vocabularyPolicy: "ACCESSIBLE_NATURAL" | "SPECIFIED_LATER";
};

export const WORLDS: readonly World[] = Object.freeze([
  { id: 1, difficulty: "VERY SIMPLE", vocabularyPolicy: "ACCESSIBLE_NATURAL" },
  { id: 2, difficulty: "SIMPLE", vocabularyPolicy: "SPECIFIED_LATER" },
  { id: 3, difficulty: "MEDIUM", vocabularyPolicy: "SPECIFIED_LATER" },
  { id: 4, difficulty: "HARD", vocabularyPolicy: "SPECIFIED_LATER" },
  { id: 5, difficulty: "VERY HARD", vocabularyPolicy: "SPECIFIED_LATER" }
]);

/** What World 1 difficulty grows through (FR-001). Vocabulary complexity is deliberately absent. */
export const DIFFICULTY_GROWTH_DIMENSIONS = [
  "reading-speed", "passage-length-stamina", "comprehension", "expression", "fluency", "independence"
] as const;

export function worldById(id: number): World {
  const world = WORLDS.find((w) => w.id === id);
  if (!world) throw new Error(`Unknown World ${id}`);
  return world;
}

/** All learners begin in World 1 regardless of age. */
export function startingWorld(_learner: { age?: number }): World {
  return WORLDS[0];
}
