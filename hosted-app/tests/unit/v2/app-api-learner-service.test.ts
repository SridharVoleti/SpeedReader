import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { LearnerService, MemoryAssessmentStore, resolveSpeechSubmission, type Ctx, type PassageCompletionRequest, type SpeechSubmission } from "../../../lib/v2/learner-service";
import { FileLearnerRepository } from "../../../lib/v2/learner-repository";
import { SESSION_POLICY_V1, SessionRegistry } from "../../../lib/v2/session-envelope";
import { assertNoInternalLeak } from "../../../lib/v2/learner-feedback";
import type { BpcContent } from "../../../lib/v2/best-comprehension";

const T0 = Date.parse("2026-10-05T09:00:00Z");
let clock = T0;
const MIN = 60_000;
let dir: string;
let repo: FileLearnerRepository;
let sessions: SessionRegistry;
let svc: LearnerService;
let n = 0;

const bpc: BpcContent[] = [{ passageId: "P1", text: "Mia flew her red kite because she loved the wind.", qaApproved: true, version: "bpc-1" }, { passageId: "P2", text: "unapproved", qaApproved: false, version: "bpc-1" }];
const ctx: Ctx = { learnerId: "kid", sessionId: "S1", deviceId: "phone" };

function make(policy = SESSION_POLICY_V1) {
  sessions = new SessionRegistry(policy);
  svc = new LearnerService({ repo, assessments: new MemoryAssessmentStore(), sessions, bpcCatalog: bpc, now: () => new Date(clock).toISOString(), newId: (p) => `${p}-${(n += 1)}` });
}
const good = (score: number): SpeechSubmission => ({ rawTranscript: "she flew a kite", confirmedTranscript: "she flew a red kite", asr: { usable: true, speechDetected: true, confidence: 0.9 }, evaluator: { score, version: "ev-1" } });
const noSpeech: SpeechSubmission = { rawTranscript: null, confirmedTranscript: null, asr: { usable: true, speechDetected: false, confidence: null }, evaluator: null };
const completion = (id: string, scoreAll: number, wpm: number, passageId = "P1", speech?: SpeechSubmission): PassageCompletionRequest => ({
  attemptId: id, passageId, displayedWpm: wpm, items: [{ itemId: "q1", score: scoreAll }, { itemId: "q2", score: scoreAll }], speech: speech ?? good(scoreAll)
});
const ok = <T extends { ok: boolean }>(r: T): Extract<T, { ok: true }> => { if (!r.ok) throw new Error(JSON.stringify(r)); return r as Extract<T, { ok: true }>; };

/** Run a full assessment for a learner who can read at `limit` WPM, then finalize. */
function onboard(limit = 90) {
  ok(svc.bootstrap(ctx));
  ok(svc.startAssessment(ctx));
  let status = "IN_PROGRESS";
  let wpm = svc.startAssessment(ctx) as { ok: true; nextWpm: number };
  let i = 0;
  while (status !== "COMPLETE") {
    const r = ok(svc.submitAssessmentAttempt(ctx, { key: `as-${(i += 1)}`, wpm: wpm.nextWpm, comprehensionScore: wpm.nextWpm <= limit ? 0.9 : 0.4, durationSec: 40 }));
    status = r.status;
    wpm = { ok: true, nextWpm: r.nextWpm ?? 0 };
  }
  return ok(svc.finalizeAssessment(ctx));
}

beforeEach(() => { dir = mkdtempSync(join(tmpdir(), "sr-svc-")); repo = new FileLearnerRepository(dir); clock = T0; make(); });
afterEach(() => rmSync(dir, { recursive: true, force: true }));

describe("APP-API-001 bootstrap and APP-PLAT-006 single device", () => {
  it("returns session, state, next activity, config/version ids and client capability requirements", () => {
    const b = ok(svc.bootstrap(ctx));
    expect(b.state).toBe("ASSESSMENT_REQUIRED");
    expect(b.next).toEqual({ activity: "INITIAL_ASSESSMENT" });
    expect(b.session).toMatchObject({ sessionId: "S1", kind: "LEARNING", ordinal: 1 });
    expect(Object.keys(b.config)).toEqual(expect.arrayContaining(["calibration", "recency", "session", "asr", "assessment"]));
    expect(b.capabilities.required).toContain("audioPlayback");
    expect(b.capabilities.optional).toContain("speechRecognition");
  });
  it("is idempotent for the same session/device and refuses a second device", () => {
    ok(svc.bootstrap(ctx));
    expect(ok(svc.bootstrap(ctx)).session.ordinal).toBe(1);
    expect(svc.bootstrap({ ...ctx, deviceId: "laptop", sessionId: "S2" })).toMatchObject({ ok: false, status: 409 });
  });
  it("enforces the weekly envelope", () => {
    ok(svc.bootstrap(ctx));
    sessions.close("kid", "S1", new Date(clock + MIN).toISOString(), "NORMAL");
    clock += 24 * 60 * MIN;
    ok(svc.bootstrap({ ...ctx, sessionId: "S2" }));
    sessions.close("kid", "S2", new Date(clock + MIN).toISOString(), "NORMAL");
    clock += 24 * 60 * MIN;
    expect(svc.bootstrap({ ...ctx, sessionId: "S3" })).toMatchObject({ ok: false, status: 429 });
  });
  it("calls without an active session are refused", () => {
    expect(svc.startAssessment(ctx)).toMatchObject({ ok: false, status: 409 });
    expect(svc.completePassage(ctx, completion("x", 0.9, 90))).toMatchObject({ ok: false, status: 409 });
  });
});

describe("APP-API-002 initial assessment (idempotent) and APP-ASSESS-006", () => {
  it("start, submit and finalize idempotently, creating the learner at the baseline WPM", () => {
    ok(svc.bootstrap(ctx));
    const a = ok(svc.startAssessment(ctx));
    expect(ok(svc.startAssessment(ctx)).assessmentId).toBe(a.assessmentId);
    const first = ok(svc.submitAssessmentAttempt(ctx, { key: "k1", wpm: a.nextWpm, comprehensionScore: 0.9, durationSec: 40 }));
    const replay = ok(svc.submitAssessmentAttempt(ctx, { key: "k1", wpm: a.nextWpm, comprehensionScore: 0.9, durationSec: 40 }));
    expect(first.replayed).toBe(false);
    expect(replay).toMatchObject({ replayed: true, nextWpm: first.nextWpm });
    expect(svc.finalizeAssessment(ctx)).toMatchObject({ ok: false, status: 409 }); // not complete yet
  });
  it("a finished assessment finalizes once and replays; the learner then starts at the stored WPM", () => {
    const f = onboard(90);
    expect(f.startingWpm).toBe(90);
    expect(ok(svc.finalizeAssessment(ctx))).toMatchObject({ replayed: true, startingWpm: 90, assessmentId: f.assessmentId });
    expect(repo.load("kid")!.learner).toMatchObject({ baselineWpm: 90, canonicalPointer: 1 });
    expect(svc.startAssessment(ctx)).toMatchObject({ ok: false, status: 409 });
    expect(svc.nextActivity(ctx)).toEqual({ activity: "NEW_PROGRESSION", sequence: 1, words: 100, wpm: 90 });
  });
  it("rejects an out-of-sequence assessment speed without corrupting the assessment", () => {
    ok(svc.bootstrap(ctx));
    ok(svc.startAssessment(ctx));
    expect(svc.submitAssessmentAttempt(ctx, { key: "bad", wpm: 140, comprehensionScore: 0.9, durationSec: 40 })).toMatchObject({ ok: false, status: 400 });
    expect(ok(svc.submitAssessmentAttempt(ctx, { key: "good", wpm: 60, comprehensionScore: 0.9, durationSec: 40 })).replayed).toBe(false);
  });
});

describe("APP-API-004 passage completion", () => {
  beforeEach(() => { onboard(90); });

  it("stores the attempt, scores, decides progression and returns child-safe feedback; the 5th GREEN is a celebrated Level Up", () => {
    for (let i = 1; i <= 4; i += 1) {
      const r = ok(svc.completePassage(ctx, completion(`a${i}`, 0.9, 90)));
      expect(r.feedback.celebration).toBe("SMALL");
      assertNoInternalLeak(r.feedback);
    }
    const up = ok(svc.completePassage(ctx, completion("a5", 0.9, 90)));
    expect(up.feedback).toMatchObject({ message: "You Levelled Up!", celebration: "LARGE", newWpm: 91 });
    expect(up.feedback.bookTime).toBeTruthy();
    const learner = repo.load("kid")!.learner;
    expect(learner).toMatchObject({ canonicalPointer: 6 });
    expect(learner.core.wpm).toBe(91);
    expect(learner.ledger).toHaveLength(5);
    expect(learner.ledger[4]).toMatchObject({ sessionId: "S1", idempotencyKey: "a5", pointerBefore: 5, pointerAfter: 6, confirmedTranscript: "she flew a red kite", rawTranscript: "she flew a kite" });
  });

  it("a replayed completion returns the same feedback and awards nothing twice", () => {
    for (let i = 1; i <= 5; i += 1) ok(svc.completePassage(ctx, completion(`a${i}`, 0.9, 90)));
    const before = repo.load("kid")!;
    const again = ok(svc.completePassage(ctx, completion("a5", 0.9, 90)));
    expect(again.replayed).toBe(true);
    expect(again.feedback.message).toBe("You Levelled Up!");
    const after = repo.load("kid")!;
    expect(after.version).toBe(before.version);
    expect(after.learner.core.wpm).toBe(91);
  });

  it("NOT_GREEN is neutral and encouraging, never blocks the next passage, and never lowers WPM", () => {
    const r = ok(svc.completePassage(ctx, completion("a1", 0.4, 90)));
    expect(r.feedback.celebration).toBe("NONE");
    expect(JSON.stringify(r.feedback)).not.toMatch(/NOT_GREEN|GREEN|fail|wrong|score|%/i);
    expect(svc.nextActivity(ctx)).toMatchObject({ activity: "NEW_PROGRESSION", sequence: 2, wpm: 90 });
  });

  it("technically unresolved speech is a retry, not a failure: no score, pointer and WPM untouched (APP-NFR-008)", () => {
    const r = ok(svc.completePassage(ctx, completion("t1", 0.9, 90, "P1", noSpeech)));
    expect(r.feedback.retry).toBe(true);
    const l = repo.load("kid")!.learner;
    expect(l).toMatchObject({ canonicalPointer: 1 });
    expect(l.core.wpm).toBe(90);
    expect(l.ledger[0]).toMatchObject({ comprehensionScore: null, classification: null, spokenStatus: "UNRESOLVED_TECHNICAL", technicalState: "ASR_UNCERTAIN" });
    // a fresh attempt on the same passage later counts normally
    ok(svc.completePassage(ctx, completion("t2", 0.9, 90)));
    expect(repo.load("kid")!.learner.canonicalPointer).toBe(2);
  });

  it("refuses a client-supplied WPM that is not the engine-owned WPM, and malformed evidence", () => {
    expect(svc.completePassage(ctx, completion("a1", 0.9, 120))).toMatchObject({ ok: false, status: 409 });
    expect(svc.completePassage(ctx, { ...completion("a1", 0.9, 90), items: [{ itemId: "q", score: 1.5 }] })).toMatchObject({ ok: false, status: 400 });
    expect(svc.completePassage(ctx, { ...completion("a1", 0.9, 90), items: [] })).toMatchObject({ ok: false, status: 400 });
    expect(svc.completePassage(ctx, { ...completion("", 0.9, 90) })).toMatchObject({ ok: false, status: 400 });
    expect(repo.load("kid")!.learner.ledger).toHaveLength(0);
  });

  it("a review session cannot record new-progression evidence (APP-PLAT-008)", () => {
    onboardReview();
  });
});

function onboardReview() {
  rmSync(dir, { recursive: true, force: true });
  dir = mkdtempSync(join(tmpdir(), "sr-svc-"));
  repo = new FileLearnerRepository(dir);
  make({ ...SESSION_POLICY_V1, reviewEvery: 1 });
  onboard(90);
  expect(ok(svc.bootstrap(ctx)).session.kind).toBe("REVIEW");
  expect(svc.completePassage(ctx, completion("r1", 0.9, 90))).toMatchObject({ ok: false, status: 409, error: expect.stringMatching(/review session/) });
  expect(svc.nextActivity(ctx)).toEqual({ activity: "NONE", reason: "NO_COMPLETED_MATERIAL_FOR_REVIEW" });
}

describe("APP-API-003 scheduler and familiar practice", () => {
  beforeEach(() => { onboard(90); });
  const stall = () => { for (let i = 1; i <= 5; i += 1) ok(svc.completePassage(ctx, completion(`s${i}`, 0.4, 90, `P${i}`))); };

  it("while holding, one familiar passage at the CURRENT WPM is served between new passages, then new progression resumes", () => {
    stall();
    const next = svc.nextActivity(ctx);
    expect(next).toMatchObject({ activity: "FAMILIAR_PRACTICE", wpm: 90, passageId: "P5" });
    const before = repo.load("kid")!.learner;
    const done = ok(svc.completePractice(ctx, { attemptId: "pr1", passageId: "P5", displayedWpm: 90 }));
    expect(done.feedback.celebration).toBe("NONE");
    const after = repo.load("kid")!.learner;
    expect(after.canonicalPointer).toBe(before.canonicalPointer);
    expect(after.core).toEqual(before.core);
    expect(after.ledger).toEqual(before.ledger);
    expect(after.practiceLog).toHaveLength(1);
    expect(after.practiceLog![0].attemptType).toBe("FAMILIAR_PRACTICE");
    expect(svc.nextActivity(ctx)).toMatchObject({ activity: "NEW_PROGRESSION", sequence: 6 });
  });
  it("practice is idempotent, only for completed passages, and only at the earned WPM", () => {
    stall();
    ok(svc.completePractice(ctx, { attemptId: "pr1", passageId: "P5", displayedWpm: 90 }));
    expect(ok(svc.completePractice(ctx, { attemptId: "pr1", passageId: "P5", displayedWpm: 90 })).replayed).toBe(true);
    expect(repo.load("kid")!.learner.practiceLog).toHaveLength(1);
    expect(svc.completePractice(ctx, { attemptId: "pr2", passageId: "P99", displayedWpm: 90 })).toMatchObject({ ok: false, status: 400 });
    expect(svc.completePractice(ctx, { attemptId: "pr3", passageId: "P5", displayedWpm: 60 })).toMatchObject({ ok: false, status: 409 });
  });
  it("is deterministic: same state, same activity", () => {
    stall();
    expect(svc.nextActivity(ctx)).toEqual(svc.nextActivity(ctx));
  });
});

describe("APP-API-005 speech evidence", () => {
  it("keeps raw and confirmed transcripts, applies the ASR policy and reports the rule version", () => {
    const r = resolveSpeechSubmission(good(0.8));
    expect(r).toMatchObject({ status: "SCORED", score: 0.8, rawTranscript: "she flew a kite", confirmedTranscript: "she flew a red kite", evaluatorVersion: "ev-1", ruleVersion: expect.stringMatching(/asr-policy/) });
  });
  it.each([
    [{ ...good(0.8), asr: { usable: false, speechDetected: true, confidence: 0.9 } }, "ASR_UNUSABLE"],
    [{ ...good(0.8), asr: { usable: true, speechDetected: false, confidence: 0.9 } }, "NO_SPEECH_DETECTED"],
    [{ ...good(0.8), asr: { usable: true, speechDetected: true, confidence: null } }, "ASR_CONFIDENCE_MISSING"],
    [{ ...good(0.8), confirmedTranscript: null, asr: { usable: true, speechDetected: true, confidence: 0.2 } }, "ASR_LOW_CONFIDENCE"]
  ] as const)("is technical, never a low score: %#", (input, reason) => {
    expect(resolveSpeechSubmission(input as SpeechSubmission)).toMatchObject({ status: "UNRESOLVED_TECHNICAL", reason });
  });
  it("a learner-confirmed transcript is the learner's own words, so low raw ASR confidence does not discard it", () => {
    expect(resolveSpeechSubmission({ ...good(0.8), asr: { usable: true, speechDetected: true, confidence: 0.2 } })).toMatchObject({ status: "SCORED" });
  });
  it("rejects a confirmed transcript without the raw one, a missing evaluator, and an out-of-range score", () => {
    expect(resolveSpeechSubmission({ ...good(0.8), rawTranscript: null })).toHaveProperty("error");
    expect(resolveSpeechSubmission({ ...good(0.8), evaluator: null })).toHaveProperty("error");
    expect(resolveSpeechSubmission({ ...good(1.4), evaluator: { score: 1.4, version: "x" } })).toHaveProperty("error");
  });
});

describe("APP-API-006 BPC retrieval", () => {
  beforeEach(() => { onboard(90); });
  it("is unavailable before the attempt is committed/locked, then available for GREEN and NOT_GREEN alike", () => {
    expect(svc.bpc(ctx, "a1")).toMatchObject({ ok: false, status: 403, error: "NOT_SUBMITTED" });
    ok(svc.completePassage(ctx, completion("a1", 0.4, 90, "P1")));
    expect(ok(svc.bpc(ctx, "a1")).text).toMatch(/red kite/);
    ok(svc.completePassage(ctx, completion("a2", 0.9, 90, "P1")));
    expect(ok(svc.bpc(ctx, "a2")).version).toBe("bpc-1");
  });
  it("unapproved or missing BPC content is a content error, not a learner failure", () => {
    ok(svc.completePassage(ctx, completion("a1", 0.9, 90, "P2")));
    expect(svc.bpc(ctx, "a1")).toMatchObject({ ok: false, status: 404, error: "CONTENT_NOT_APPROVED" });
    ok(svc.completePassage(ctx, completion("a2", 0.9, 90, "P7")));
    expect(svc.bpc(ctx, "a2")).toMatchObject({ ok: false, status: 404, error: "CONTENT_MISSING" });
  });
  it("technically unresolved attempts still get BPC", () => {
    ok(svc.completePassage(ctx, completion("t1", 0.9, 90, "P1", noSpeech)));
    expect(svc.bpc(ctx, "t1").ok).toBe(true);
  });
});

describe("APP-API-007 News Reader", () => {
  beforeEach(() => { onboard(90); });
  const read = (id: string, n: 1 | 2, clarity: number) => ({ attemptId: id, passageId: "P1", readNumber: n, metrics: { clarity }, technicalState: "OK" as const, recordedAt: "2026-10-05T09:10:00Z" });
  it("has its own start (reference delivery policy), submit and coaching path, and never touches core state", () => {
    const start = ok(svc.newsReaderStart(ctx, "P1"));
    expect(start.delivery).toMatchObject({ mode: "TTS", wpm: 145, voiceGender: "female" });
    ok(svc.completePassage(ctx, completion("a1", 0.9, 90)));
    const before = repo.load("kid")!.learner;
    ok(svc.newsReaderSubmit(ctx, read("n1", 1, 0.5)));
    const second = ok(svc.newsReaderSubmit(ctx, read("n2", 2, 0.8)));
    expect(second.coaching).toMatchObject({ status: "COMPLETE", improved: true });
    const after = repo.load("kid")!.learner;
    expect(after.core).toEqual(before.core);
    expect(after.canonicalPointer).toBe(before.canonicalPointer);
    expect(after.ledger).toEqual(before.ledger);
    expect(after.newsReader.attempts).toHaveLength(2);
  });
  it("is idempotent and a missing microphone is recorded without penalty", () => {
    ok(svc.newsReaderSubmit(ctx, read("n1", 1, 0.5)));
    ok(svc.newsReaderSubmit(ctx, read("n1", 1, 0.5)));
    expect(repo.load("kid")!.learner.newsReader.attempts).toHaveLength(1);
    const mic = ok(svc.newsReaderSubmit(ctx, { ...read("n2", 2, 0), metrics: {}, technicalState: "MIC_UNAVAILABLE" }));
    expect(mic.coaching).toMatchObject({ status: "UNSCORED" });
    expect(repo.load("kid")!.learner.core.wpm).toBe(90);
  });
  it("rejects out-of-range oral metrics", () => {
    expect(svc.newsReaderSubmit(ctx, read("n1", 1, 1.5))).toMatchObject({ ok: false, status: 400 });
  });
});

describe("APP-API-008 progress and APP-API-010 ops", () => {
  beforeEach(() => { onboard(90); for (let i = 1; i <= 5; i += 1) ok(svc.completePassage(ctx, completion(`a${i}`, 0.9, 90))); });
  it("child progress is child-safe; parent detail needs separate authorization", () => {
    const p = ok(svc.progress(ctx));
    expect(p).toMatchObject({ currentWpm: 91, startingWpm: 90, storiesRead: 5 });
    assertNoInternalLeak({ currentWpm: p.currentWpm, startingWpm: p.startingWpm, storiesRead: p.storiesRead });
    expect(svc.parentProgress("kid", false)).toMatchObject({ ok: false, status: 403 });
    const parent = ok(svc.parentProgress("kid", true));
    expect(parent.report.personal).toMatchObject({ startingWpm: 90, currentWpm: 91, levelUps: 1 });
    expect(svc.parentProgress("nobody", true)).toMatchObject({ ok: false, status: 404 });
  });
  it("ops metrics are aggregate-only and need internal authorization", () => {
    const snaps = [repo.load("kid")!];
    expect(svc.opsSummary(snaps, false)).toMatchObject({ ok: false, status: 403 });
    expect(ok(svc.opsSummary(snaps, true))).toEqual({ ok: true, learners: 1, attempts: 5, levelUps: 1, unresolvedTechnical: 0 });
    expect(JSON.stringify(svc.opsSummary(snaps, true))).not.toMatch(/kid|GREEN|transcript/);
  });
});

describe("APP-API-009 resume", () => {
  beforeEach(() => { onboard(90); });
  it("resumes an accidentally closed session within 15 minutes without duplicating committed events", () => {
    ok(svc.completePassage(ctx, completion("a1", 0.9, 90)));
    sessions.close("kid", "S1", new Date(clock + MIN).toISOString(), "ACCIDENTAL");
    clock += 10 * MIN;
    const r = ok(svc.resume(ctx));
    expect(r.resumed).toBe(true);
    expect(r.resumeFrom).toMatchObject({ activity: "PASSAGE_COMPLETE" });
    expect(r.resumeFrom!.committedEventKeys).toContain("a1");
    const again = ok(svc.completePassage(ctx, completion("a1", 0.9, 90)));
    expect(again.replayed).toBe(true);
    expect(repo.load("kid")!.learner.ledger).toHaveLength(1);
  });
  it("is refused after the window", () => {
    sessions.close("kid", "S1", new Date(clock + MIN).toISOString(), "ACCIDENTAL");
    clock += 17 * MIN;
    expect(svc.resume(ctx)).toMatchObject({ ok: false, status: 409, error: "RESUME_WINDOW_EXPIRED" });
  });
  it("calls after the 45-minute session ends are refused", () => {
    clock += 46 * MIN;
    expect(svc.completePassage(ctx, completion("late", 0.9, 90))).toMatchObject({ ok: false, status: 409 });
  });
});
