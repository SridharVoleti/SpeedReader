// FR-016 - Earned WPM is never removed [FROZEN]
// Normal World 1 progression has no WPM decrement mechanism: once earned, a WPM level is not taken
// away because of later comprehension difficulty. Difficulty produces extra practice/support, not
// loss of earned progress. The decrement rules below are SUPERSEDED and must not be implemented.

export const SUPERSEDED_DECREMENT_RULES: Readonly<Record<string, string>> = Object.freeze({
  "DECREMENT-AFTER-TEN": "-1 WPM after ten passages without a Level Up",
  "DECREMENT-AFTER-ZERO-OF-FIVE": "-1 WPM after 0/5 GREEN",
  "STEP_DOWN": "Automatic STEP_DOWN outcome"
});

/** Progression outcomes the core engine may emit. There is deliberately no downward member. */
export const CORE_PROGRESSION_OUTCOMES = ["NONE", "LEVEL_UP", "HOLD_AFTER_FIVE"] as const;

/** Guard to call around any WPM transition: throws if earned WPM would drop. */
export function assertNoDecrement(previousWpm: number, nextWpm: number): void {
  if (nextWpm < previousWpm) {
    throw new Error(`WPM decrement ${previousWpm} -> ${nextWpm} is forbidden: earned WPM is never removed (FR-016)`);
  }
}
