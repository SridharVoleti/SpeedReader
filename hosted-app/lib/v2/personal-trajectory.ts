// FR-009 - Personal trajectory [FROZEN]
// Progress is evaluated against the learner's own valid history. Progression, difficulty, rewards
// and improvement must never be derived from other learners, age-group averages, leaderboards or a
// universal expected rate of improvement.

export type HistoryPoint = { attemptId: string; wpm: number; valid: boolean };

export type PersonalImprovement = {
  startWpm: number | null;
  currentWpm: number | null;
  gainWpm: number | null;
  validPoints: number;
};

export function personalImprovement(history: readonly HistoryPoint[]): PersonalImprovement {
  const valid = history.filter((p) => p.valid);
  if (valid.length === 0) return { startWpm: null, currentWpm: null, gainWpm: null, validPoints: 0 };
  const startWpm = valid[0].wpm;
  const currentWpm = valid[valid.length - 1].wpm;
  return { startWpm, currentWpm, gainWpm: currentWpm - startWpm, validPoints: valid.length };
}

/** Field names that would introduce a comparison with anyone other than the learner themself. */
export const COMPARATIVE_FIELDS: readonly string[] = Object.freeze([
  "peerRank", "peerAverage", "ageGroupAverage", "ageBandAverage", "leaderboardPosition",
  "otherLearnerId", "expectedImprovementRate", "universalExpectedRate", "percentile"
]);

/** Guard for any progression/difficulty/reward input: throws if it carries a comparative field. */
export function assertPersonalOnly(input: unknown, path = "input"): void {
  if (input === null || typeof input !== "object") return;
  for (const [key, value] of Object.entries(input as Record<string, unknown>)) {
    if (COMPARATIVE_FIELDS.includes(key)) {
      throw new Error(`comparative field "${key}" at ${path} is forbidden: progress is personal (FR-009)`);
    }
    assertPersonalOnly(value, `${path}.${key}`);
  }
}
