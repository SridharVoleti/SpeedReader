import progressionData from "../data/progression.json";
import { ReadingTimingRecord } from "./reading-timing";

export type ProgressionLevel = {
  id: number;
  world: number;
  step: number;
  wordsPerChunk: number;
  wpm: number;
  passThreshold: number;
};

export type WorldInfo = {
  world: number;
  wordsPerChunk: number;
  name: string;
};

export type LevelResult = {
  bestScore: number;
  stars: number;
  passed: boolean;
  completedAt: string;
  // SR-R1-001: raw evidence for the most recent attempt's reading phase - planned timing is
  // deterministic from target_wpm/word_count/chunks; actual_duration_ms is the real elapsed time.
  lastReadingTiming?: ReadingTimingRecord;
};

export type Progress = Record<string, LevelResult>;

export const worlds: WorldInfo[] = progressionData.worlds;

// SR-R1-011: Configurable WPM ladder.
// "Use a file/config-based WPM ladder rather than hard-coded values." The level ladder is
// derived from worlds/speedSteps/passThreshold at load time - never a separately hard-coded or
// duplicated list - so changing the config changes eligible speeds without a code change.
export function buildLevelsFromLadder(
  ladderWorlds: WorldInfo[],
  speedSteps: number[],
  passThreshold: number
): ProgressionLevel[] {
  const built: ProgressionLevel[] = [];
  for (const world of ladderWorlds) {
    speedSteps.forEach((wpm, index) => {
      built.push({
        id: built.length + 1,
        world: world.world,
        step: index + 1,
        wordsPerChunk: world.wordsPerChunk,
        wpm,
        passThreshold
      });
    });
  }
  return built;
}

export const levels: ProgressionLevel[] = buildLevelsFromLadder(
  progressionData.worlds,
  progressionData.speedSteps,
  progressionData.passThreshold
);

const STORAGE_KEY = "speedreader-progress-v1";

// When Speed Reading is opened from inside BabySteps, progress is namespaced by learnerId so
// siblings sharing a device (or the browser's own anonymous progress) never collide.
function storageKey(learnerId?: string): string {
  return learnerId ? `${STORAGE_KEY}:${learnerId}` : STORAGE_KEY;
}

export function loadProgress(learnerId?: string): Progress {
  if (typeof window === "undefined") return {};
  try {
    const raw = window.localStorage.getItem(storageKey(learnerId));
    return raw ? (JSON.parse(raw) as Progress) : {};
  } catch {
    return {};
  }
}

export function saveProgress(progress: Progress, learnerId?: string): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(storageKey(learnerId), JSON.stringify(progress));
}

export function starsForScore(score: number): number {
  if (score >= 90) return 3;
  if (score >= 80) return 2;
  if (score >= 70) return 1;
  return 0;
}

export function recordResult(
  progress: Progress,
  level: ProgressionLevel,
  score: number,
  learnerId?: string,
  readingTiming?: ReadingTimingRecord,
  attemptOutcome?: "PASS" | "HOLD" | "INVALID"
): Progress {
  // SR-R1-012: Outcome separation - technical/content invalidity must never lower (or otherwise
  // change) learner state the way a genuine comprehension failure (HOLD) does.
  if (attemptOutcome === "INVALID") {
    return progress;
  }

  const key = String(level.id);
  const previous = progress[key];
  const bestScore = Math.max(previous?.bestScore ?? 0, score);
  const next: Progress = {
    ...progress,
    [key]: {
      bestScore,
      stars: starsForScore(bestScore),
      passed: bestScore >= level.passThreshold,
      completedAt: new Date().toISOString(),
      lastReadingTiming: readingTiming ?? previous?.lastReadingTiming
    }
  };
  saveProgress(next, learnerId);
  return next;
}

export function isPassed(progress: Progress, levelId: number): boolean {
  return progress[String(levelId)]?.passed ?? false;
}

export function isUnlocked(progress: Progress, level: ProgressionLevel): boolean {
  return level.id === 1 || isPassed(progress, level.id - 1);
}

export function nextPlayableLevel(progress: Progress): ProgressionLevel | null {
  for (const level of levels) {
    if (isUnlocked(progress, level) && !isPassed(progress, level.id)) {
      return level;
    }
  }
  return null;
}

// SR-R1-011: current_rate/next_rate - the WPM the learner is eligible to train at right now,
// and the rate one step ahead on the ladder, derived from the same configured ladder.
export function currentRate(progress: Progress): number | null {
  return nextPlayableLevel(progress)?.wpm ?? null;
}

export function nextRate(progress: Progress): number | null {
  const current = nextPlayableLevel(progress);
  if (!current) return null;
  return levels.find((level) => level.id === current.id + 1)?.wpm ?? null;
}

export function passedCount(progress: Progress): number {
  return levels.filter((level) => isPassed(progress, level.id)).length;
}

export function totalStars(progress: Progress): number {
  return levels.reduce((sum, level) => sum + (progress[String(level.id)]?.stars ?? 0), 0);
}
