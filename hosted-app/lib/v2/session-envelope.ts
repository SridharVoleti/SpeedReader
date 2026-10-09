// APP-PLAT-006..009 - Platform session envelope as consumed by SpeedReader.
// Babysteps owns entitlement; SpeedReader respects the envelope the platform grants and never
// hard-codes a contradictory daily entitlement into the passage engine (passage progression and
// platform-session cadence are separate concepts). All numbers are configuration, not scattered constants.

export type SessionPolicy = {
  version: string;
  sessionMinutes: number;
  maxSessionsPerWeek: number;
  /** Every Nth platform learning session is a review session. */
  reviewEvery: number;
  resumeWindowMinutes: number;
};

export const SESSION_POLICY_V1: SessionPolicy = Object.freeze({
  version: "platform-session-2026-10-1",
  sessionMinutes: 45,
  maxSessionsPerWeek: 2,
  reviewEvery: 6,
  resumeWindowMinutes: 15
});

const MIN = 60_000;

export type SessionKind = "LEARNING" | "REVIEW";

/** APP-PLAT-007: platform session ordinal (1-based, per learner per app) -> kind. */
export function sessionKind(ordinal: number, policy: SessionPolicy = SESSION_POLICY_V1): SessionKind {
  if (!Number.isInteger(ordinal) || ordinal < 1) throw new RangeError("session ordinal must be an integer >= 1");
  return ordinal % policy.reviewEvery === 0 ? "REVIEW" : "LEARNING";
}

/** APP-PLAT-008: what an attempt made in a session of this kind is allowed to be. */
export function attemptRulesForSession(kind: SessionKind, approvedRevalidationFormScheduled = false) {
  if (kind === "REVIEW" && !approvedRevalidationFormScheduled) {
    return { attemptType: "FAMILIAR_PRACTICE" as const, advancesCanonicalPointer: false, createsLevelUpEvidence: false, rewritesOriginalEvidence: false };
  }
  if (kind === "REVIEW") {
    // an explicitly approved assessment/revalidation form: still never advances the canonical pointer
    return { attemptType: "REVALIDATION" as const, advancesCanonicalPointer: false, createsLevelUpEvidence: false, rewritesOriginalEvidence: false };
  }
  return { attemptType: "NEW_PROGRESSION" as const, advancesCanonicalPointer: true, createsLevelUpEvidence: true, rewritesOriginalEvidence: false };
}

export type SessionRecord = {
  sessionId: string;
  learnerId: string;
  deviceId: string;
  ordinal: number;
  kind: SessionKind;
  startedAt: string;
  endsAt: string;
  state: "ACTIVE" | "CLOSED_NORMAL" | "CLOSED_ACCIDENTAL";
  closedAt?: string;
  /** Safe activity position + event keys already committed (so resume can never duplicate evidence/awards). */
  checkpoint: { activity: string; position: number; committedEventKeys: readonly string[] };
};

export type StartResult =
  | { ok: true; session: SessionRecord }
  | { ok: false; reason: "WEEKLY_LIMIT_REACHED" | "ACTIVE_ON_ANOTHER_DEVICE" | "INVALID_REQUEST"; activeSession?: SessionRecord };

export type ResumeResult =
  | { ok: true; session: SessionRecord; resumeFrom: SessionRecord["checkpoint"] }
  | { ok: false; reason: "NO_SESSION" | "NOT_ACCIDENTALLY_CLOSED" | "RESUME_WINDOW_EXPIRED" | "SESSION_EXPIRED" | "WRONG_DEVICE" | "ACTIVE_ON_ANOTHER_DEVICE" };

/** Monday-based week key in UTC (the platform owns the authoritative week; this is the consumed form). */
export function weekKey(iso: string): string {
  const d = new Date(Date.parse(iso));
  if (Number.isNaN(d.getTime())) throw new RangeError(`invalid timestamp ${iso}`);
  const day = (d.getUTCDay() + 6) % 7; // Monday=0
  const monday = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate() - day));
  return monday.toISOString().slice(0, 10);
}

export class SessionRegistry {
  private readonly sessions: SessionRecord[] = [];
  constructor(private readonly policy: SessionPolicy = SESSION_POLICY_V1) {}

  /** Replace this learner's records with the persisted ones (durable, multi-instance safe). */
  hydrate(learnerId: string, records: readonly SessionRecord[]): void {
    for (let i = this.sessions.length - 1; i >= 0; i -= 1) if (this.sessions[i].learnerId === learnerId) this.sessions.splice(i, 1);
    this.sessions.push(...records.map((r) => ({ ...r, checkpoint: { ...r.checkpoint, committedEventKeys: [...r.checkpoint.committedEventKeys] } })));
  }

  list(learnerId: string): readonly SessionRecord[] {
    return this.sessions.filter((s) => s.learnerId === learnerId);
  }

  /** The learner's currently live session, expiring it by wall-clock first. */
  active(learnerId: string, now: string): SessionRecord | null {
    const nowMs = Date.parse(now);
    const live = this.sessions.find((s) => s.learnerId === learnerId && s.state === "ACTIVE");
    if (!live) return null;
    if (nowMs >= Date.parse(live.endsAt)) {
      this.replace(live, { ...live, state: "CLOSED_NORMAL", closedAt: live.endsAt });
      return null;
    }
    return live;
  }

  /** APP-PLAT-006/007: start a new session. One live session per learner; at most N per week. */
  start(req: { learnerId: string; deviceId: string; sessionId: string; now: string; activity?: string }): StartResult {
    if (!req.learnerId || !req.deviceId || !req.sessionId || Number.isNaN(Date.parse(req.now))) return { ok: false, reason: "INVALID_REQUEST" };
    const live = this.active(req.learnerId, req.now);
    if (live) return { ok: false, reason: "ACTIVE_ON_ANOTHER_DEVICE", activeSession: live };
    const mine = this.list(req.learnerId);
    const wk = weekKey(req.now);
    if (mine.filter((s) => weekKey(s.startedAt) === wk).length >= this.policy.maxSessionsPerWeek) return { ok: false, reason: "WEEKLY_LIMIT_REACHED" };
    const ordinal = mine.length + 1;
    const session: SessionRecord = {
      sessionId: req.sessionId, learnerId: req.learnerId, deviceId: req.deviceId, ordinal, kind: sessionKind(ordinal, this.policy),
      startedAt: req.now, endsAt: new Date(Date.parse(req.now) + this.policy.sessionMinutes * MIN).toISOString(), state: "ACTIVE",
      checkpoint: { activity: req.activity ?? "START", position: 0, committedEventKeys: [] }
    };
    this.sessions.push(session);
    return { ok: true, session };
  }

  /** Record a safe position and the event keys committed so far. Only the live session may checkpoint. */
  checkpoint(learnerId: string, sessionId: string, now: string, cp: { activity: string; position: number; committedEventKeys: readonly string[] }): boolean {
    const live = this.active(learnerId, now);
    if (!live || live.sessionId !== sessionId) return false;
    this.replace(live, { ...live, checkpoint: { activity: cp.activity, position: cp.position, committedEventKeys: [...new Set([...live.checkpoint.committedEventKeys, ...cp.committedEventKeys])] } });
    return true;
  }

  close(learnerId: string, sessionId: string, now: string, how: "NORMAL" | "ACCIDENTAL"): boolean {
    const live = this.active(learnerId, now);
    if (!live || live.sessionId !== sessionId) return false;
    this.replace(live, { ...live, state: how === "NORMAL" ? "CLOSED_NORMAL" : "CLOSED_ACCIDENTAL", closedAt: now });
    return true;
  }

  /**
   * APP-PLAT-009: resume an accidentally closed session within the window, on the same device context,
   * without extending the original session end and without losing the committed-event record.
   */
  resume(req: { learnerId: string; sessionId: string; deviceId: string; now: string }): ResumeResult {
    const s = this.sessions.find((x) => x.learnerId === req.learnerId && x.sessionId === req.sessionId);
    if (!s) return { ok: false, reason: "NO_SESSION" };
    if (s.state !== "CLOSED_ACCIDENTAL") return { ok: false, reason: "NOT_ACCIDENTALLY_CLOSED" };
    if (s.deviceId !== req.deviceId) return { ok: false, reason: "WRONG_DEVICE" };
    const nowMs = Date.parse(req.now);
    if (nowMs >= Date.parse(s.endsAt)) return { ok: false, reason: "SESSION_EXPIRED" };
    if (nowMs - Date.parse(s.closedAt!) > this.policy.resumeWindowMinutes * MIN) return { ok: false, reason: "RESUME_WINDOW_EXPIRED" };
    const other = this.active(req.learnerId, req.now);
    if (other) return { ok: false, reason: "ACTIVE_ON_ANOTHER_DEVICE" };
    const resumed: SessionRecord = { ...s, state: "ACTIVE", closedAt: undefined };
    this.replace(s, resumed);
    return { ok: true, session: resumed, resumeFrom: resumed.checkpoint };
  }

  private replace(old: SessionRecord, next: SessionRecord): void {
    this.sessions[this.sessions.indexOf(old)] = next;
  }
}

/** Idempotent replay guard for resumed sessions: an event key already committed is never re-applied. */
export function shouldApplyEvent(session: Pick<SessionRecord, "checkpoint">, eventKey: string): boolean {
  return !session.checkpoint.committedEventKeys.includes(eventKey);
}

/** One learner's session records with the version they were read at (compare-and-swap token; 0 = never written). */
export type VersionedSessions = { records: SessionRecord[]; version: number };

/**
 * Durable storage for one learner's session records (APP-PLAT-006..009 across restarts and server instances).
 * Writes are compare-and-swap: saveIfVersion succeeds only if nothing else wrote since `loadVersioned`, so two
 * serverless instances can never both start a session from the same stale read (issue #21).
 */
export interface SessionPersistence {
  load(learnerId: string): SessionRecord[] | Promise<SessionRecord[]>;
  /** Unconditional replace. Not for arbitration: use saveIfVersion. */
  save(learnerId: string, records: readonly SessionRecord[]): void | Promise<void>;
  loadVersioned(learnerId: string): VersionedSessions | Promise<VersionedSessions>;
  saveIfVersion(learnerId: string, records: readonly SessionRecord[], expectedVersion: number): boolean | Promise<boolean>;
}

export class MemorySessionPersistence implements SessionPersistence {
  private readonly map = new Map<string, VersionedSessions>();
  load(learnerId: string) { return structuredClone(this.map.get(learnerId)?.records ?? []); }
  save(learnerId: string, records: readonly SessionRecord[]) {
    this.map.set(learnerId, { records: structuredClone([...records]), version: (this.map.get(learnerId)?.version ?? 0) + 1 });
  }
  loadVersioned(learnerId: string): VersionedSessions {
    const e = this.map.get(learnerId);
    return { records: structuredClone(e?.records ?? []), version: e?.version ?? 0 };
  }
  saveIfVersion(learnerId: string, records: readonly SessionRecord[], expectedVersion: number): boolean {
    if ((this.map.get(learnerId)?.version ?? 0) !== expectedVersion) return false;
    this.save(learnerId, records);
    return true;
  }
}
