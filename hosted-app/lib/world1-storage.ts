import type { LevelDimension } from "./world1-advancement";
import type { BaselineSample } from "./world1-session";
import type { World1LearnerState } from "./world1-engine";
import { recommendNextSession } from "./world1-session";
import type { WorldConfig } from "./world1-product";

export type World1Profile = {
  schemaVersion: 1;
  learnerId: string;
  state: World1LearnerState;
  baselineEvidence: Partial<Record<LevelDimension, BaselineSample[]>>;
  lastSessionStartedAtMs?: number | null;
};

export type KeyValueStore = {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
};

function profileKey(learnerId: string): string {
  if (!learnerId.trim()) throw new Error("learnerId required");
  return `speedreader-world1-profile-v1:${learnerId}`;
}

export function newWorld1Profile(learnerId: string, initialWpm: number): World1Profile {
  if (!learnerId.trim() || !Number.isFinite(initialWpm) || initialWpm <= 0) throw new Error("invalid profile initialization");
  return {
    schemaVersion: 1,
    learnerId,
    state: {
      nextPassageSequence: 1,
      speed: { currentWpm: initialWpm, consecutiveValidSuccess: 0, consumedSessionIds: [] },
      stamina: { validatedWords: 100, confirmingAttemptIds: [], pendingWords: null },
      levels: { levels: [], badges: [] },
      processedAttemptIds: [],
      pendingSpeedWpm: null
    },
    baselineEvidence: {},
    lastSessionStartedAtMs: null
  };
}

export function loadWorld1Profile(store: KeyValueStore, learnerId: string): World1Profile | null {
  const raw = store.getItem(profileKey(learnerId));
  if (!raw) return null;
  try {
    const value: unknown = JSON.parse(raw);
    if (!value || typeof value !== "object") return null;
    const profile = value as Partial<World1Profile>;
    if (profile.schemaVersion !== 1 || profile.learnerId !== learnerId || !profile.state || !profile.baselineEvidence) return null;
    if (!Number.isInteger(profile.state.nextPassageSequence) || profile.state.nextPassageSequence < 1 || !Array.isArray(profile.state.processedAttemptIds)) return null;
    return profile as World1Profile;
  } catch {
    return null;
  }
}

export function saveWorld1Profile(store: KeyValueStore, profile: World1Profile): void {
  if (profile.schemaVersion !== 1) throw new Error("unsupported World 1 profile schema");
  store.setItem(profileKey(profile.learnerId), JSON.stringify(profile));
}

export function appendBaselineEvidence(profile: World1Profile, dimension: LevelDimension, sample: BaselineSample): World1Profile {
  const existing = profile.baselineEvidence[dimension] ?? [];
  if (existing.some((item) => item.sessionId === sample.sessionId)) return profile;
  if (!Number.isFinite(sample.value)) return profile;
  return {
    ...profile,
    baselineEvidence: { ...profile.baselineEvidence, [dimension]: [...existing, sample] }
  };
}

export function recordWorld1SessionStart(profile: World1Profile, startedAtMs: number): World1Profile {
  if (!Number.isFinite(startedAtMs) || startedAtMs < 0) throw new RangeError("invalid session start time");
  if (profile.lastSessionStartedAtMs !== null && profile.lastSessionStartedAtMs !== undefined && startedAtMs < profile.lastSessionStartedAtMs) {
    throw new RangeError("session start precedes latest recorded session");
  }
  return { ...profile, lastSessionStartedAtMs: startedAtMs };
}

export function nextWorld1SessionRecommendation(profile: World1Profile, config: WorldConfig): number | null {
  return profile.lastSessionStartedAtMs === null || profile.lastSessionStartedAtMs === undefined
    ? null
    : recommendNextSession(profile.lastSessionStartedAtMs, config);
}
