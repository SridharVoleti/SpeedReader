// SR-003 - A new passage of the same difficulty is ordinary practice; repeating an old one supports
// confidence. Neither blocks progression. Formal readiness uses only explicitly declared equivalent forms.

export type PassageRef = { passageId: string; rsId: string; difficulty: string };

export function classifyPractice(prior: PassageRef, next: PassageRef) {
  const repeat = prior.passageId === next.passageId;
  return {
    role: repeat ? ("CONFIDENCE_REPEAT" as const) : ("ORDINARY_PRACTICE" as const),
    acceptableAsPractice: repeat || (prior.rsId === next.rsId && prior.difficulty === next.difficulty),
    requiresReplacementPassage: false as const,
    blocksProgression: false as const
  };
}

export function formalEquivalenceAllowed(formA: string, formB: string, declaredPairs: readonly (readonly [string, string])[]): boolean {
  return formA === formB || declaredPairs.some(([a, b]) => (a === formA && b === formB) || (a === formB && b === formA));
}
