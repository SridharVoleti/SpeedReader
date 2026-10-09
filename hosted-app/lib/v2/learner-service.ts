// APP-API-001..010 - SpeedReader application service.
//
// The single orchestration layer between transport (HTTP routes, tests) and the verified domain modules. It owns
// no rules of its own: every decision is delegated (progression -> attempt-record/learner-aggregate, sessions ->
// session-envelope, durability/idempotency -> LearnerRepository, feedback -> learner-feedback). Responses for the
// child are checked with assertNoInternalLeak; parent/internal detail is a separate, explicitly authorized call.

import { ASSESSMENT_CONFIG, newAssessment, recordAssessmentAttempt, toAssessmentRecord, type AssessmentAttempt, type AssessmentRecord, type AssessmentState } from "./initial-assessment";
import { newLearnerAggregate, type LearnerAggregate } from "./learner-aggregate";
import { recordNewProgressionAttempt, currentRuleVersions, type AttemptRecord } from "./attempt-record";
import { scoreComprehension, structuredEvidence, type ComprehensionResult } from "./comprehension-score";
import { ASR_POLICY, type AsrPolicy, type TechnicalReason } from "./spoken-evidence";
import { assertNoInternalLeak, buildLearnerFeedback, buildLevelUpFeedback, type LearnerFeedback } from "./learner-feedback";
import { bookTimeImpact, type BookTimeImpact } from "./book-time";
import { bestComprehensionFor, lockScoring, newBpcAttempt, submitAttempt, type BpcContent } from "./best-comprehension";
import { attemptRulesForSession, SESSION_POLICY_V1, type SessionPersistence, type SessionRecord, type SessionRegistry } from "./session-envelope";
import { selectFamiliarPassage, type CompletedPassage } from "./familiar-practice";
import { recordNewsReaderAttempt, type NewsReaderAttempt } from "./news-reader";
import { twoReadCoaching } from "./news-reader-coaching";
import { NEWS_READER_TTS, resolveReferenceDelivery, type Platform, type ReferenceAudio } from "./reference-audio";
import { passageWords, WORLD1_LAST_PASSAGE } from "./stamina";
import { buildParentReport, type ParentReport } from "./parent-report";
import { CURRENT_CALIBRATION } from "./calibration";
import { GREEN_THRESHOLD } from "./comprehension-threshold";
import { RECENCY_POLICY_V1 } from "./evidence-recency";
import { ORAL_CONFIG_V1 } from "./oral-telemetry";
import type { LearnerRepository, MaybePromise, StoredSnapshot } from "./learner-repository";
import { RETENTION_POLICY_V1, recordRetentionCheck, retentionDue, retentionSummary, type RetentionDue, type RetentionPolicy } from "./retention-check";
import { applyReadinessAttempt, newReadinessStream, type ReadinessAttempt, type ReadinessPhase, type ReadinessStream } from "./readiness-lifecycle";

// ---------------------------------------------------------------------------------------------------- ports

/**
 * Server-side assessment clock (#24). `clock` is when the current passage was first served in the current session;
 * `lastEventAt` is the last trusted server event (start or answer). All times are the server's own, never the client's.
 */
export type AssessmentClock = { attemptIndex: number; sessionId: string; servedAt: string };
export type StoredAssessment = { state: AssessmentState; assessmentId: string; keys: string[]; record: AssessmentRecord | null; /** Content actually used for each answered attempt, in order (#25). */ contentLog?: ContentProvenance[]; startedAt?: string; clock?: AssessmentClock | null; lastEventAt?: string };

export interface AssessmentStore {
  load(learnerId: string): MaybePromise<StoredAssessment | null>;
  save(learnerId: string, value: StoredAssessment): MaybePromise<void>;
}

export class MemoryAssessmentStore implements AssessmentStore {
  private readonly map = new Map<string, StoredAssessment>();
  load(learnerId: string) { const v = this.map.get(learnerId); return v ? structuredClone(v) : null; }
  save(learnerId: string, value: StoredAssessment) { this.map.set(learnerId, structuredClone(value)); }
}

export type ServiceDeps = {
  repo: LearnerRepository;
  assessments: AssessmentStore;
  sessions: SessionRegistry;
  /** Optional durable session storage. Without it sessions live only in this process. */
  sessionStore?: SessionPersistence;
  /** Spaced memory-check schedule. Defaults to the pilot policy. */
  retentionPolicy?: RetentionPolicy;
  /** Approved BPC content: a fixed list, or a per-passage lookup backed by the content provider. */
  bpcCatalog: readonly BpcContent[] | ((passageId: string) => BpcContent | null);
  referenceAudio?: readonly ReferenceAudio[];
  readiness?: (learnerId: string) => readonly ReadinessStream[];
  /** Exact identity of the content package behind a passage; an attempt without it is refused, never recorded with a placeholder. */
  provenance: (passageId: string) => ContentProvenance | null;
  now?: () => string;
  newId?: (prefix: string) => string;
};

export type ContentProvenance = { packageId: string; packageVersion: number; contentHash: string; manifest?: { manifestId: string; manifestVersion: number; hash: string } };

export type Ctx = { learnerId: string; sessionId: string; deviceId: string };

export type ServiceError = { ok: false; status: number; error: string };
const fail = (status: number, error: string): ServiceError => ({ ok: false, status, error });
type Ok<T> = { ok: true } & T;

// ---------------------------------------------------------------------------------------------------- types

export type Activity =
  | { activity: "INITIAL_ASSESSMENT" }
  | { activity: "NEW_PROGRESSION"; sequence: number; words: number; wpm: number; readinessDue?: ReadinessDue }
  | { activity: "FAMILIAR_PRACTICE"; passageId: string; sequence: number; wpm: number }
  | { activity: "READINESS"; streamId: string; role: string }
  | { activity: "NONE"; reason: string };

/** A due readiness form surfaced beside, never instead of, canonical reading (V3: readiness is diagnostic/parallel). */
export type ReadinessDue = { streamId: string; role: string };

export const CLIENT_CAPABILITIES = Object.freeze({
  required: ["audio-playback"],
  optional: ["microphone", "speech-recognition", "speech-synthesis", "voices"],
  note: "Missing optional speech capability degrades gracefully and never changes earned WPM."
});

export type SpeechSubmission = {
  rawTranscript: string | null;
  confirmedTranscript: string | null;
  asr: { usable: boolean; speechDetected: boolean; confidence: number | null };
  /** Output of the upstream semantic evaluator over the learner-confirmed transcript. */
  evaluator: { score: number; version: string } | null;
};

export type ResolvedSpeech =
  | { status: "SCORED"; score: number; rawTranscript: string | null; confirmedTranscript: string | null; evaluatorVersion: string; ruleVersion: string }
  | { status: "UNRESOLVED_TECHNICAL"; reason: TechnicalReason; rawTranscript: string | null; confirmedTranscript: string | null; ruleVersion: string };

/** APP-API-005: raw + corrected transcript, confidence/technical state, evaluator output and rule version. */
export function resolveSpeechSubmission(input: SpeechSubmission, policy: AsrPolicy = ASR_POLICY): ResolvedSpeech | { error: string } {
  const { rawTranscript, confirmedTranscript, asr, evaluator } = input;
  if (confirmedTranscript !== null && rawTranscript === null) return { error: "a confirmed transcript requires the raw transcript to be retained" };
  const base = { rawTranscript, confirmedTranscript, ruleVersion: policy.version };
  const unresolved = (reason: TechnicalReason): ResolvedSpeech => ({ status: "UNRESOLVED_TECHNICAL", reason, ...base });
  if (!asr.usable) return unresolved("ASR_UNUSABLE");
  const spokenText = confirmedTranscript ?? rawTranscript ?? "";
  if (!asr.speechDetected || spokenText.trim() === "") return unresolved("NO_SPEECH_DETECTED");
  if (asr.confidence === null) return unresolved("ASR_CONFIDENCE_MISSING");
  // a learner-confirmed transcript is the learner's own words; confidence only gates unconfirmed ASR text
  if (confirmedTranscript === null && asr.confidence < policy.minConfidence) return unresolved("ASR_LOW_CONFIDENCE");
  if (!evaluator) return { error: "evaluator output is required for usable speech evidence" };
  if (!(evaluator.score >= 0 && evaluator.score <= 1)) return { error: "evaluator score must be 0..1" };
  return { status: "SCORED", score: evaluator.score, evaluatorVersion: evaluator.version, ...base };
}

export type PassageCompletionRequest = {
  attemptId: string;
  idempotencyKey?: string;
  passageId: string;
  /** Item-level structured results from the approved question set. */
  items: { itemId: string; score: number }[];
  speech: SpeechSubmission;
  displayedWpm: number;
  startedAt?: string;
  completedAt?: string;
  registry?: { registryPassageId: string; rsId: string; p: number } | null;
  client?: import("./client-class").ClientClass | null;
};

export type ChildFeedback = LearnerFeedback & { newWpm?: number; bookTime?: BookTimeImpact; retry?: boolean };

// ---------------------------------------------------------------------------------------------------- service

export class LearnerService {
  private readonly now: () => string;
  private readonly newId: (prefix: string) => string;
  private counter = 0;

  constructor(private readonly deps: ServiceDeps) {
    this.now = deps.now ?? (() => new Date().toISOString());
    this.newId = deps.newId ?? ((p) => `${p}-${Date.now().toString(36)}-${(this.counter += 1)}`);
  }

  /** Load this learner's persisted sessions into the registry (no-op without a durable store). Returns the read version. */
  private async hydrate(learnerId: string): Promise<number> {
    if (!this.deps.sessionStore) return 0;
    const v = await this.deps.sessionStore.loadVersioned(learnerId);
    this.deps.sessions.hydrate(learnerId, v.records);
    return v.version;
  }

  /**
   * Run a session-state mutation as read -> decide -> compare-and-swap. If another instance wrote in between, the
   * decision is discarded and re-made against the fresh state (so a second concurrent start sees the first and is
   * refused). A pure refusal writes nothing. Issue #21.
   */
  private async mutateSessions<T>(learnerId: string, fn: () => T): Promise<T> {
    const store = this.deps.sessionStore;
    if (!store) return fn();
    for (let attempt = 0; attempt < 8; attempt += 1) {
      const version = await this.hydrate(learnerId);
      const before = JSON.stringify(this.deps.sessions.list(learnerId));
      const out = fn();
      const after = this.deps.sessions.list(learnerId);
      if (JSON.stringify(after) === before) return out;
      if (await store.saveIfVersion(learnerId, after, version)) return out;
    }
    throw new Error("session state is contended: retry");
  }

  private async session(ctx: Ctx): Promise<SessionRecord | ServiceError> {
    await this.hydrate(ctx.learnerId);
    const s = this.deps.sessions.active(ctx.learnerId, this.now());
    if (!s || s.sessionId !== ctx.sessionId) return fail(409, "no active session: bootstrap again");
    if (s.deviceId !== ctx.deviceId) return fail(409, "session is active on another device");
    return s;
  }

  private async checkpoint(ctx: Ctx, activity: string, position: number, key: string): Promise<void> {
    await this.mutateSessions(ctx.learnerId, () => this.deps.sessions.checkpoint(ctx.learnerId, ctx.sessionId, this.now(), { activity, position, committedEventKeys: [key] }));
  }

  // ---- APP-API-001 bootstrap / APP-API-009 resume ----------------------------------------------------

  async bootstrap(ctx: Ctx): Promise<Ok<{ session: Pick<SessionRecord, "sessionId" | "kind" | "endsAt" | "ordinal">; resumed: boolean; state: "ASSESSMENT_REQUIRED" | "READY"; next: Activity; config: Record<string, string>; capabilities: typeof CLIENT_CAPABILITIES; resumeFrom: SessionRecord["checkpoint"] | null }> | ServiceError> {
    const now = this.now();
    const decided = await this.mutateSessions(ctx.learnerId, () => {
      let resumed = false;
      let resumeFrom: SessionRecord["checkpoint"] | null = null;
      let session = this.deps.sessions.active(ctx.learnerId, now);
      if (session && (session.sessionId !== ctx.sessionId || session.deviceId !== ctx.deviceId)) return fail(409, "this learner already has an active session on another device");
      if (!session) {
        const r = this.deps.sessions.resume({ learnerId: ctx.learnerId, sessionId: ctx.sessionId, deviceId: ctx.deviceId, now });
        if (r.ok) { session = r.session; resumed = true; resumeFrom = r.resumeFrom; }
        else {
          const started = this.deps.sessions.start({ learnerId: ctx.learnerId, deviceId: ctx.deviceId, sessionId: ctx.sessionId, now });
          if (!started.ok) return fail(started.reason === "WEEKLY_LIMIT_REACHED" ? 429 : 409, started.reason);
          session = started.session;
        }
      }
      return { session, resumed, resumeFrom };
    });
    if ("ok" in decided) return decided;
    const { session, resumed, resumeFrom } = decided;
    return await this.bootstrapResult(ctx, session, resumed, resumeFrom);
  }

  private async bootstrapResult(ctx: Ctx, session: SessionRecord, resumed: boolean, resumeFrom: SessionRecord["checkpoint"] | null) {
    const next = await this.nextActivity(ctx);
    return {
      ok: true as const,
      session: { sessionId: session.sessionId, kind: session.kind, endsAt: session.endsAt, ordinal: session.ordinal },
      resumed,
      resumeFrom,
      state: (await this.deps.repo.load(ctx.learnerId) ? "READY" : "ASSESSMENT_REQUIRED") as "ASSESSMENT_REQUIRED" | "READY",
      next: "ok" in next ? ({ activity: "NONE", reason: next.error } as Activity) : next,
      config: {
        calibration: CURRENT_CALIBRATION.version,
        recency: RECENCY_POLICY_V1.version,
        session: SESSION_POLICY_V1.version,
        oralTelemetry: ORAL_CONFIG_V1.version,
        asr: ASR_POLICY.version,
        assessment: ASSESSMENT_CONFIG.algorithmVersion,
        greenThresholdFrozen: String(GREEN_THRESHOLD === 0.75)
      },
      capabilities: CLIENT_CAPABILITIES
    };
  }

  async resume(ctx: Ctx): Promise<Awaited<ReturnType<LearnerService["bootstrap"]>>> {
    const r = await this.mutateSessions(ctx.learnerId, () => this.deps.sessions.resume({ learnerId: ctx.learnerId, sessionId: ctx.sessionId, deviceId: ctx.deviceId, now: this.now() }));
    if (!r.ok) return fail(409, r.reason);
    return this.bootstrapResult(ctx, r.session, true, r.resumeFrom);
  }

  // ---- APP-API-002 initial assessment ------------------------------------------------------------------

  async startAssessment(ctx: Ctx): Promise<Ok<{ assessmentId: string; nextWpm: number; status: AssessmentState["status"] }> | ServiceError> {
    const s = await this.session(ctx); if ("ok" in s) return s;
    if (await this.deps.repo.load(ctx.learnerId)) return fail(409, "assessment already completed");
    let stored = await this.deps.assessments.load(ctx.learnerId);
    if (!stored) {
      const startedAt = this.now();
      stored = { state: newAssessment(), assessmentId: this.newId("ASSESS"), keys: [], record: null, startedAt, lastEventAt: startedAt, clock: null };
      await this.deps.assessments.save(ctx.learnerId, stored);
    }
    return { ok: true, assessmentId: stored.assessmentId, nextWpm: stored.state.currentWpm, status: stored.state.status };
  }

  /** Where the in-progress assessment stands: the next speed to read at and how many attempts are done. */
  async assessmentPending(ctx: Ctx): Promise<Ok<{ nextWpm: number; attemptsDone: number }> | ServiceError> {
    const s = await this.session(ctx); if ("ok" in s) return s;
    if (await this.deps.repo.load(ctx.learnerId)) return fail(409, "assessment already completed");
    const stored = await this.deps.assessments.load(ctx.learnerId);
    if (!stored) return fail(409, "assessment not started");
    if (stored.state.status === "COMPLETE") return fail(409, "assessment is complete: finalize it");
    return { ok: true, nextWpm: stored.state.currentWpm, attemptsDone: stored.state.attempts.length };
  }

  /**
   * Serve the next assessment passage and start its server-side clock. A reload in the same session keeps the original
   * start (time is not reset by refreshing); a passage served again in a different session restarts it, so time away
   * from the app is never charged to the ten-minute budget.
   */
  async serveAssessmentPassage(ctx: Ctx): Promise<Ok<{ nextWpm: number; attemptsDone: number }> | ServiceError> {
    const pending = await this.assessmentPending(ctx);
    if (!pending.ok) return pending;
    const stored = (await this.deps.assessments.load(ctx.learnerId))!;
    const c = stored.clock;
    if (!c || c.attemptIndex !== pending.attemptsDone || c.sessionId !== ctx.sessionId) {
      stored.clock = { attemptIndex: pending.attemptsDone, sessionId: ctx.sessionId, servedAt: this.now() };
      await this.deps.assessments.save(ctx.learnerId, stored);
    }
    return pending;
  }

  async submitAssessmentAttempt(ctx: Ctx, req: { key: string; wpm: number; comprehensionScore: number; content?: ContentProvenance }): Promise<Ok<{ nextWpm: number | null; status: AssessmentState["status"]; replayed: boolean }> | ServiceError> {
    const s = await this.session(ctx); if ("ok" in s) return s;
    const stored = await this.deps.assessments.load(ctx.learnerId);
    if (!stored) return fail(409, "assessment not started");
    if (!req.key) return fail(400, "key is required");
    if (stored.keys.includes(req.key)) return { ok: true, nextWpm: stored.state.status === "COMPLETE" ? null : stored.state.currentWpm, status: stored.state.status, replayed: true };
    if (stored.state.status === "COMPLETE") return fail(409, "assessment is complete");
    // elapsed time is measured here from trusted server timestamps; the request carries no duration
    const nowIso = this.now();
    const fromIso = stored.clock && stored.clock.attemptIndex === stored.state.attempts.length && stored.clock.sessionId === ctx.sessionId
      ? stored.clock.servedAt
      : (stored.lastEventAt ?? stored.startedAt ?? nowIso);
    const durationSec = Math.max(0, (Date.parse(nowIso) - Date.parse(fromIso)) / 1000);
    const attempt: AssessmentAttempt = { wpm: req.wpm, comprehensionScore: req.comprehensionScore, durationSec };
    try {
      stored.state = recordAssessmentAttempt(stored.state, attempt);
    } catch (e) {
      return fail(400, e instanceof Error ? e.message : "invalid attempt");
    }
    stored.keys.push(req.key);
    if (req.content) stored.contentLog = [...(stored.contentLog ?? []), req.content];
    stored.clock = null;
    stored.lastEventAt = nowIso;
    await this.deps.assessments.save(ctx.learnerId, stored);
    await this.checkpoint(ctx, "INITIAL_ASSESSMENT", stored.state.attempts.length, `assess:${req.key}`);
    return { ok: true, nextWpm: stored.state.status === "COMPLETE" ? null : stored.state.currentWpm, status: stored.state.status, replayed: false };
  }

  async finalizeAssessment(ctx: Ctx): Promise<Ok<{ assessmentId: string; startingWpm: number; replayed: boolean }> | ServiceError> {
    const s = await this.session(ctx); if ("ok" in s) return s;
    const stored = await this.deps.assessments.load(ctx.learnerId);
    if (!stored) return fail(409, "assessment not started");
    if (stored.record) return { ok: true, assessmentId: stored.record.assessmentId, startingWpm: stored.record.startingWpm, replayed: true };
    if (stored.state.status !== "COMPLETE") return fail(409, "assessment is not complete");
    const record = { ...toAssessmentRecord(stored.state, { assessmentId: stored.assessmentId, learnerId: ctx.learnerId }, this.now()), ...(stored.contentLog?.length ? { content: stored.contentLog } : {}) };
    if (!await this.deps.repo.load(ctx.learnerId)) await this.deps.repo.create(newLearnerAggregate(ctx.learnerId, record.startingWpm));
    stored.record = record;
    await this.deps.assessments.save(ctx.learnerId, stored);
    return { ok: true, assessmentId: record.assessmentId, startingWpm: record.startingWpm, replayed: false };
  }

  // ---- APP-API-003 next activity -----------------------------------------------------------------------

  private completedPassages(learner: LearnerAggregate): CompletedPassage[] {
    const seen = new Map<string, CompletedPassage>();
    learner.ledger.filter((r) => r.attemptType === "NEW_PROGRESSION" && r.classification !== null).forEach((r, i) => {
      seen.set(r.passageId, { sequence: i + 1, passageId: r.passageId, originalScore: r.comprehensionScore ?? 0, completedAt: r.completedAt });
    });
    return [...seen.values()];
  }

  /** Deterministic scheduler. Domain evidence rules are preserved by never choosing outside the allowed set. */
  async nextActivity(ctx: Ctx): Promise<Activity | ServiceError> {
    await this.hydrate(ctx.learnerId);
    const snap = await this.deps.repo.load(ctx.learnerId);
    if (!snap) return { activity: "INITIAL_ASSESSMENT" };
    const learner = snap.learner;
    const session = this.deps.sessions.active(ctx.learnerId, this.now());
    const kind = session?.kind ?? "LEARNING";

    // approved readiness / revalidation forms take precedence when due (APP-PLAT-008)
    const due = (this.deps.readiness?.(ctx.learnerId) ?? (learner.readinessStreams as readonly ReadinessStream[] | undefined) ?? []).find((st) => ["PRIMARY_DUE", "CONFIRMATION_DUE", "NEW_CYCLE_PRIMARY_DUE", "NEW_CYCLE_CONFIRMATION_DUE", "REVALIDATION_DUE"].includes(st.phase) || st.pendingReplacement);
    if (due && kind === "REVIEW") return { activity: "READINESS", streamId: due.streamId, role: due.pendingReplacement ? "TECHNICAL_REPLACEMENT" : due.phase };

    const completed = this.completedPassages(learner);
    const practice = selectFamiliarPassage(completed, learner.core.wpm);
    if (kind === "REVIEW") {
      return practice
        ? { activity: "FAMILIAR_PRACTICE", passageId: practice.passageId, sequence: practice.sequence, wpm: learner.core.wpm }
        : { activity: "NONE", reason: "NO_COMPLETED_MATERIAL_FOR_REVIEW" };
    }
    // while holding at the same WPM, one familiar passage between new passages (invisible support)
    if (learner.core.practiceEligible && practice && !learner.practiceServedSinceLastNew) {
      return { activity: "FAMILIAR_PRACTICE", passageId: practice.passageId, sequence: practice.sequence, wpm: learner.core.wpm };
    }
    // in an ordinary learning session readiness is a parallel activity: it is reported, never substituted for canonical reading
    const readinessDue: ReadinessDue | undefined = due ? { streamId: due.streamId, role: due.pendingReplacement ? "TECHNICAL_REPLACEMENT" : due.phase } : undefined;
    if (learner.canonicalPointer > WORLD1_LAST_PASSAGE) return { activity: "NONE", reason: "WORLD1_SEQUENCE_COMPLETE" };
    return { activity: "NEW_PROGRESSION", sequence: learner.canonicalPointer, words: passageWords(learner.canonicalPointer), wpm: learner.core.wpm, ...(readinessDue ? { readinessDue } : {}) };
  }

  // ---- APP-API-004 passage completion ------------------------------------------------------------------

  async completePassage(ctx: Ctx, req: PassageCompletionRequest): Promise<Ok<{ feedback: ChildFeedback; replayed: boolean }> | ServiceError> {
    const s = await this.session(ctx); if ("ok" in s) return s;
    if (attemptRulesForSession(s.kind).attemptType !== "NEW_PROGRESSION") return fail(409, "a review session cannot record new-progression evidence");
    const snap = await this.deps.repo.load(ctx.learnerId);
    if (!snap) return fail(409, "initial assessment required");
    if (!req.attemptId || !req.passageId) return fail(400, "attemptId and passageId are required");
    if (!(req.displayedWpm > 0)) return fail(400, "displayedWpm must be positive");
    const key = req.idempotencyKey ?? req.attemptId;

    // replay of a committed event: same child feedback, nothing re-applied (APP-READ-003, APP-API-009)
    const existing = snap.learner.ledger.find((r) => r.attemptId === req.attemptId || r.idempotencyKey === key);
    if (existing) return { ok: true, feedback: this.feedbackFor(existing, snap.learner.baselineWpm), replayed: true };

    // the attempt must be on the learner's current canonical passage at the engine's own WPM (engine-owned state)
    if (req.displayedWpm !== snap.learner.core.wpm) return fail(409, "displayed WPM does not match the engine-owned WPM");

    const speech = resolveSpeechSubmission(req.speech);
    if ("error" in speech) return fail(400, speech.error);
    let comprehension: ComprehensionResult;
    try {
      const structured = structuredEvidence(req.items);
      comprehension = scoreComprehension(structured, speech.status === "SCORED" ? { score: speech.score } : null);
    } catch (e) {
      return fail(400, e instanceof Error ? e.message : "invalid evidence");
    }

    const prov = this.deps.provenance(req.passageId);
    if (!prov) return fail(503, "content provenance unavailable");
    const ruleVersions = { ...currentRuleVersions(), content: `${prov.packageId}@${prov.packageVersion}#${prov.contentHash}` };

    const now = this.now();
    let out: ReturnType<typeof recordNewProgressionAttempt>;
    try {
      out = recordNewProgressionAttempt(snap.learner, {
      attemptId: req.attemptId,
      idempotencyKey: key,
      sessionId: ctx.sessionId,
      passageId: req.passageId,
      displayedWpm: req.displayedWpm,
      passageWords: passageWords(snap.learner.canonicalPointer),
      recordedAt: now,
      startedAt: req.startedAt ?? now,
      completedAt: req.completedAt ?? now,
      registry: req.registry ?? null,
      client: req.client ?? null,
      comprehension,
      ruleVersions,
      contentPackage: prov,
      spokenReason: speech.status === "UNRESOLVED_TECHNICAL" ? speech.reason : null,
      rawTranscript: speech.rawTranscript,
      confirmedTranscript: speech.confirmedTranscript
      });
    } catch (e) {
      // an invalid record is rejected as a request problem, never a crash and never stored (APP-DATA-002 validation)
      return fail(422, e instanceof Error ? e.message : "invalid attempt");
    }
    const committed = await this.deps.repo.commit(ctx.learnerId, out.learner, { expectedVersion: snap.version, idempotencyKey: key });
    if (!committed.ok) return fail(committed.reason === "VERSION_CONFLICT" ? 409 : 500, committed.reason);
    await this.checkpoint(ctx, "PASSAGE_COMPLETE", out.learner.canonicalPointer, key);
    return { ok: true, feedback: this.feedbackFor(out.record, snap.learner.baselineWpm), replayed: committed.replayed };
  }

  private feedbackFor(record: AttemptRecord, baselineWpm: number): ChildFeedback {
    let feedback: ChildFeedback;
    if (record.classification === null) {
      // technically unresolved: neutral, retry offered, nothing scored (APP-NFR-008)
      feedback = { ...buildLearnerFeedback({ attemptId: record.attemptId, score: null, classification: null }), retry: true };
    } else if (record.levelUpAfter.event === "LEVEL_UP") {
      feedback = { ...buildLevelUpFeedback(record.levelUpAfter.wpm), bookTime: bookTimeImpact(record.levelUpBefore.wpm, record.levelUpAfter.wpm, baselineWpm) };
    } else {
      feedback = buildLearnerFeedback({ attemptId: record.attemptId, score: record.comprehensionScore, classification: record.classification });
    }
    assertNoInternalLeak(feedback);
    return feedback;
  }

  // ---- readiness lifecycle writer (APP-READY-*, APP-DB-008) ---------------------------------------------------

  /**
   * Apply one controlled-form readiness attempt to its stream and commit it atomically with the learner state. Lifecycle
   * rules (roles, no form reuse, replacement) are the domain's; a rejected attempt changes nothing. Readiness never
   * touches WPM, the canonical pointer or the reading ledger.
   */
  async recordReadinessAttempt(ctx: Ctx, streamId: string, attempt: ReadinessAttempt): Promise<Ok<{ phase: ReadinessPhase; replayed: boolean }> | ServiceError> {
    const s = await this.session(ctx); if ("ok" in s) return s;
    const snap = await this.deps.repo.load(ctx.learnerId);
    if (!snap) return fail(409, "initial assessment required");
    if (!streamId) return fail(400, "streamId is required");
    const streams = (snap.learner.readinessStreams ?? []) as readonly ReadinessStream[];
    const existing = streams.find((x) => x.streamId === streamId) ?? newReadinessStream(ctx.learnerId, streamId);
    if (existing.history.some((h) => h.attemptId === attempt.attemptId)) return { ok: true, phase: existing.phase, replayed: true };
    const r = applyReadinessAttempt(existing, attempt);
    if (!r.ok) return fail(409, r.error);
    const next: LearnerAggregate = { ...snap.learner, readinessStreams: [...streams.filter((x) => x.streamId !== streamId), r.stream] };
    const committed = await this.deps.repo.commit(ctx.learnerId, next, { expectedVersion: snap.version, idempotencyKey: `readiness:${attempt.attemptId}` });
    if (!committed.ok) return fail(committed.reason === "VERSION_CONFLICT" ? 409 : 500, committed.reason);
    await this.checkpoint(ctx, "READINESS_ATTEMPT", r.stream.history.length, `readiness:${attempt.attemptId}`);
    return { ok: true, phase: r.stream.phase, replayed: committed.replayed };
  }

  // ---- familiar practice (APP-PRAC) -------------------------------------------------------------------

  async completePractice(ctx: Ctx, req: { attemptId: string; passageId: string; displayedWpm: number }): Promise<Ok<{ feedback: LearnerFeedback; replayed: boolean }> | ServiceError> {
    const s = await this.session(ctx); if ("ok" in s) return s;
    const snap = await this.deps.repo.load(ctx.learnerId);
    if (!snap) return fail(409, "initial assessment required");
    const learner = snap.learner;
    if ((learner.practiceLog ?? []).some((p) => p.attemptId === req.attemptId)) return { ok: true, feedback: buildLearnerFeedback({ attemptId: req.attemptId, score: null, classification: null }), replayed: true };
    if (!this.completedPassages(learner).some((c) => c.passageId === req.passageId)) return fail(400, "familiar practice may only use a passage the learner has already completed");
    if (req.displayedWpm !== learner.core.wpm) return fail(409, "practice is served at the current earned WPM");
    const next: LearnerAggregate = {
      ...learner,
      practiceServedSinceLastNew: true,
      practiceLog: [...(learner.practiceLog ?? []), { attemptId: req.attemptId, passageId: req.passageId, wpm: req.displayedWpm, attemptType: "FAMILIAR_PRACTICE", sessionId: ctx.sessionId, recordedAt: this.now() }]
    };
    const committed = await this.deps.repo.commit(ctx.learnerId, next, { expectedVersion: snap.version, idempotencyKey: `practice:${req.attemptId}` });
    if (!committed.ok) return fail(committed.reason === "VERSION_CONFLICT" ? 409 : 500, committed.reason);
    await this.checkpoint(ctx, "PRACTICE_COMPLETE", next.practiceLog!.length, `practice:${req.attemptId}`);
    const feedback = { message: "Nice reading! Here is another story to enjoy.", celebration: "NONE" as const, showBestPossibleComprehension: false };
    assertNoInternalLeak(feedback);
    return { ok: true, feedback, replayed: committed.replayed };
  }

  // ---- APP-API-006 BPC ---------------------------------------------------------------------------------

  async bpc(ctx: Ctx, attemptId: string): Promise<Ok<{ text: string; version: string }> | ServiceError> {
    const snap = await this.deps.repo.load(ctx.learnerId);
    if (!snap) return fail(409, "initial assessment required");
    const record = snap.learner.ledger.find((r) => r.attemptId === attemptId);
    // no committed, scored-or-technically-resolved record means scoring is not locked: nothing is released
    let attempt = newBpcAttempt(attemptId, record?.passageId ?? "");
    if (record) attempt = lockScoring(submitAttempt(attempt), { score: record.comprehensionScore, classification: record.classification });
    const catalog = typeof this.deps.bpcCatalog === "function"
      ? ([this.deps.bpcCatalog(attempt.passageId)].filter(Boolean) as BpcContent[])
      : this.deps.bpcCatalog;
    const r = bestComprehensionFor(attempt, catalog);
    if (!r.available) return fail(r.reason === "NOT_SUBMITTED" ? 403 : r.reason === "SCORING_NOT_LOCKED" ? 403 : 404, r.reason);
    return { ok: true, text: r.content.text, version: r.content.version };
  }

  // ---- APP-API-007 News Reader -------------------------------------------------------------------------

  async newsReaderStart(ctx: Ctx, passageId: string, platform: Platform = "web"): Promise<Ok<{ passageId: string; delivery: ReturnType<typeof resolveReferenceDelivery> }> | ServiceError> {
    const s = await this.session(ctx); if ("ok" in s) return s;
    const snap = await this.deps.repo.load(ctx.learnerId);
    if (!snap) return fail(409, "initial assessment required");
    return { ok: true, passageId, delivery: resolveReferenceDelivery(this.deps.referenceAudio ?? [], passageId, platform) };
  }

  async newsReaderSubmit(ctx: Ctx, attempt: NewsReaderAttempt): Promise<Ok<{ coaching: ReturnType<typeof twoReadCoaching> }> | ServiceError> {
    const s = await this.session(ctx); if ("ok" in s) return s;
    const snap = await this.deps.repo.load(ctx.learnerId);
    if (!snap) return fail(409, "initial assessment required");
    let state;
    try { state = recordNewsReaderAttempt(snap.learner.newsReader, attempt); } catch (e) { return fail(400, e instanceof Error ? e.message : "invalid attempt"); }
    if (state !== snap.learner.newsReader) {
      // only the News Reader namespace changes: core WPM, pointer and ledger are carried over untouched
      const committed = await this.deps.repo.commit(ctx.learnerId, { ...snap.learner, newsReader: state }, { expectedVersion: snap.version, idempotencyKey: `nr:${attempt.attemptId}` });
      if (!committed.ok) return fail(committed.reason === "VERSION_CONFLICT" ? 409 : 500, committed.reason);
      await this.checkpoint(ctx, "NEWS_READER", state.attempts.length, `nr:${attempt.attemptId}`);
    }
    return { ok: true, coaching: twoReadCoaching(state, attempt.passageId) };
  }

  // ---- APP-API-008 progress ----------------------------------------------------------------------------

  /** Child-safe progress: the earned WPM and canonical progress, nothing internal. */
  async progress(ctx: Ctx): Promise<Ok<{ currentWpm: number; startingWpm: number; storiesRead: number; storiesRemembered: number; storiesChecked: number; retentionDue: boolean }> | ServiceError> {
    const snap = await this.deps.repo.load(ctx.learnerId);
    if (!snap) return fail(409, "initial assessment required");
    const policy = this.deps.retentionPolicy ?? RETENTION_POLICY_V1;
    const view = {
      currentWpm: snap.learner.core.wpm, startingWpm: snap.learner.baselineWpm, storiesRead: snap.learner.canonicalPointer - 1,
      storiesRemembered: retentionSummary(snap.learner).storiesRemembered,
      storiesChecked: retentionSummary(snap.learner).storiesChecked,
      retentionDue: retentionDue(snap.learner, this.now(), policy) !== null
    };
    assertNoInternalLeak(view);
    return { ok: true, ...view };
  }

  // ---- spaced memory checks (retention): their own evidence namespace, never progression ----------------

  async retentionNext(ctx: Ctx): Promise<Ok<{ due: RetentionDue | null }> | ServiceError> {
    const s = await this.session(ctx); if ("ok" in s) return s;
    const snap = await this.deps.repo.load(ctx.learnerId);
    if (!snap) return fail(409, "initial assessment required");
    return { ok: true, due: retentionDue(snap.learner, this.now(), this.deps.retentionPolicy ?? RETENTION_POLICY_V1) };
  }

  async completeRetention(ctx: Ctx, req: { attemptId: string; passageId: string; correct: number; total: number }): Promise<Ok<{ feedback: { message: string; remembered: boolean }; replayed: boolean }> | ServiceError> {
    const s = await this.session(ctx); if ("ok" in s) return s;
    const snap = await this.deps.repo.load(ctx.learnerId);
    if (!snap) return fail(409, "initial assessment required");
    const policy = this.deps.retentionPolicy ?? RETENTION_POLICY_V1;
    const r = recordRetentionCheck(snap.learner, { ...req, sessionId: ctx.sessionId, at: this.now() }, policy);
    if (!r.ok) return fail(/not due/.test(r.error) ? 409 : 400, r.error);
    if (!r.replayed) {
      const committed = await this.deps.repo.commit(ctx.learnerId, r.learner, { expectedVersion: snap.version, idempotencyKey: `retention:${req.attemptId}` });
      if (!committed.ok) return fail(committed.reason === "VERSION_CONFLICT" ? 409 : 500, committed.reason);
      await this.checkpoint(ctx, "RETENTION_CHECK", (r.learner.retentionLog ?? []).length, `retention:${req.attemptId}`);
    }
    const message = r.record.remembered
      ? "You remember this story really well - great memory!"
      : "Some of this story has faded, and that is completely normal. Here is a quick refresher so it sticks.";
    const feedback = { message, remembered: r.record.remembered };
    assertNoInternalLeak({ message });
    return { ok: true, feedback, replayed: r.replayed };
  }

  /** Parent/internal detail: only when the caller has been separately authorized by the transport layer. */
  async parentProgress(learnerId: string, authorized: boolean): Promise<Ok<{ report: ParentReport }> | ServiceError> {
    if (!authorized) return fail(403, "parent detail requires separate authorization");
    const snap = await this.deps.repo.load(learnerId);
    if (!snap) return fail(404, "unknown learner");
    return { ok: true, report: buildParentReport({ learner: snap.learner, readiness: this.deps.readiness?.(learnerId) ?? (snap.learner.readinessStreams as readonly ReadinessStream[] | undefined) }) };
  }

  // ---- APP-API-010 calibration / ops -------------------------------------------------------------------

  /** Aggregate-only operational metrics for authorized internal callers; never child-facing. */
  async opsSummary(snapshots: readonly StoredSnapshot[], authorized: boolean): Promise<Ok<{ learners: number; attempts: number; levelUps: number; unresolvedTechnical: number }> | ServiceError> {
    if (!authorized) return fail(403, "internal authorization required");
    let attempts = 0; let levelUps = 0; let unresolved = 0;
    for (const s of snapshots) {
      for (const r of s.learner.ledger) {
        attempts += 1;
        if (r.levelUpAfter.event === "LEVEL_UP") levelUps += 1;
        if (r.technicalState !== "CLEAR") unresolved += 1;
      }
    }
    return { ok: true, learners: snapshots.length, attempts, levelUps, unresolvedTechnical: unresolved };
  }
}
