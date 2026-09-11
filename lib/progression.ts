import progressionData from "../data/progression.json";

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
};

export type Progress = Record<string, LevelResult>;

export const worlds: WorldInfo[] = progressionData.worlds;
export const levels: ProgressionLevel[] = progressionData.levels;

const STORAGE_KEY = "speedreader-progress-v1";

export function loadProgress(): Progress {
  if (typeof window === "undefined") return {};
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as Progress) : {};
  } catch {
    return {};
  }
}

export function saveProgress(progress: Progress): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(progress));
}

export function starsForScore(score: number): number {
  if (score >= 90) return 3;
  if (score >= 80) return 2;
  if (score >= 70) return 1;
  return 0;
}

export function recordResult(progress: Progress, level: ProgressionLevel, score: number): Progress {
  const key = String(level.id);
  const previous = progress[key];
  const bestScore = Math.max(previous?.bestScore ?? 0, score);
  const next: Progress = {
    ...progress,
    [key]: {
      bestScore,
      stars: starsForScore(bestScore),
      passed: bestScore >= level.passThreshold,
      completedAt: new Date().toISOString()
    }
  };
  saveProgress(next);
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

export function passedCount(progress: Progress): number {
  return levels.filter((level) => isPassed(progress, level.id)).length;
}

export function totalStars(progress: Progress): number {
  return levels.reduce((sum, level) => sum + (progress[String(level.id)]?.stars ?? 0), 0);
}
