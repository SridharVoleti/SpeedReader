// FR-028 - Permanent cross-World feature [FROZEN]
// Comprehension expression and Best Possible Comprehension are permanent SpeedReader features in every
// World. Only their sophistication grows with content difficulty.

import { WORLDS, worldById } from "./worlds";

export type ExpressionFocus = {
  worldId: 1 | 2 | 3 | 4 | 5;
  /** 1 (World 1) .. 5 (World 5): increases with content difficulty. */
  sophistication: 1 | 2 | 3 | 4 | 5;
  expectation: string[];
};

export const EXPRESSION_FOCUS_BY_WORLD: readonly ExpressionFocus[] = Object.freeze([
  { worldId: 1, sophistication: 1, expectation: ["connected-retelling-of-events-and-ideas", "reasons", "feelings", "consequences", "key-meaning"] },
  { worldId: 2, sophistication: 2, expectation: ["clear-explanation", "important-information-vs-supporting-detail"] },
  { worldId: 3, sophistication: 3, expectation: ["connected-ideas", "relationships", "inference", "coherent-organisation"] },
  { worldId: 4, sophistication: 4, expectation: ["arguments", "viewpoints", "evidence", "implications", "deeper-meaning"] },
  { worldId: 5, sophistication: 5, expectation: ["synthesis-of-complex-material", "clear-structured-explanation", "in-the-learners-own-words"] }
]);

export function expressionFocusFor(worldId: number): ExpressionFocus {
  worldById(worldId);
  return EXPRESSION_FOCUS_BY_WORLD.find((f) => f.worldId === worldId)!;
}

/** Both features are active in every World; there is no World where they are switched off. */
export function permanentFeaturesFor(worldId: number): { comprehensionExpression: true; bestPossibleComprehension: true } {
  worldById(worldId);
  return { comprehensionExpression: true, bestPossibleComprehension: true };
}

export function everyWorldHasFocus(): boolean {
  return WORLDS.every((w) => EXPRESSION_FOCUS_BY_WORLD.some((f) => f.worldId === w.id));
}
