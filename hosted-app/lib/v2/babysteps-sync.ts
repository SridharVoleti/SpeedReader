// APP-PLAT-010 / APP-PRIV-003 - what SpeedReader reports back to Babysteps.
// One core Level Up = +1 WPM = one Babystep, so each Level Up is one completed lesson. Only approved structured
// fields are shared: never transcripts, audio, scores or internal states.

export type LevelUpSync = {
  levelKey: string;
  nextLevelKey: string;
  progressSummary: { currentLevel: string; efficiencyStars: number; milestone: string | null; nextDestination: string };
};

export function levelUpSyncPayload(previousWpm: number, newWpm: number): LevelUpSync {
  if (!Number.isInteger(previousWpm) || !Number.isInteger(newWpm) || newWpm !== previousWpm + 1) {
    throw new RangeError("a Level Up is exactly +1 WPM");
  }
  return {
    levelKey: String(previousWpm),
    nextLevelKey: String(newWpm),
    progressSummary: {
      currentLevel: `${newWpm} words a minute`,
      efficiencyStars: 0, // legacy platform field; v3 has no star metric
      milestone: "You Levelled Up!",
      nextDestination: `${newWpm + 1} words a minute`
    }
  };
}
