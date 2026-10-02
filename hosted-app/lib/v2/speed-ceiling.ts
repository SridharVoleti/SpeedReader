// FR-010 - World 1 speed ceiling [FROZEN]
// Maximum training/display speed is 150 WPM. It is a ceiling, not a compulsory completion target:
// a learner may complete World 1 below 150 WPM if all other completion/readiness requirements hold.

export const WORLD1_MAX_WPM = 150;

/** True when a core passage may be scheduled/displayed at this speed. */
export function isSchedulableWpm(wpm: number): boolean {
  return Number.isFinite(wpm) && wpm > 0 && wpm <= WORLD1_MAX_WPM;
}

/** Clamp any computed training speed to the ceiling. */
export function clampToCeiling(wpm: number): number {
  return Math.min(wpm, WORLD1_MAX_WPM);
}

export function atCeiling(wpm: number): boolean {
  return wpm >= WORLD1_MAX_WPM;
}

/** Whether the speed rule alone contributes a completion requirement: never. */
export function ceilingIsCompletionRequirement(): boolean {
  return false;
}

/** At the ceiling WPM stops rising but every other development dimension continues. */
export function developmentContinuesAtCeiling(wpm: number): { wpmCanIncrease: boolean; otherDevelopmentContinues: true } {
  return { wpmCanIncrease: !atCeiling(wpm), otherDevelopmentContinues: true };
}
