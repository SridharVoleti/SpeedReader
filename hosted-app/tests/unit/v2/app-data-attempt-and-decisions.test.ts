import { describe, expect, it } from "vitest";
import { ATTEMPT_TYPES, countsAsProgressionEvidence } from "../../../lib/v2/attempt-types";
import { recordNewProgressionAttempt, validateAttemptRecord, type AttemptRecord } from "../../../lib/v2/attempt-record";
import { newLearnerAggregate, type LearnerAggregate } from "../../../lib/v2/learner-aggregate";
import { scoreComprehension, structuredEvidence } from "../../../lib/v2/comprehension-score";
import { deriveDecisionLedger, verifyDecisionLedger } from "../../../lib/v2/decision-ledger";

const scored = (s: number) => scoreComprehension(structuredEvidence([{ itemId: "q1", score: s }]), { score: s });
const play = (scores: number[], start = 90) => {
  let l: LearnerAggregate = newLearnerAggregate("kid", start);
  scores.forEach((s, i) => { l = recordNewProgressionAttempt(l, { attemptId: `a${i + 1}`, passageId: `P${i + 1}`, displayedWpm: l.core.wpm, passageWords: 100, recordedAt: `2026-10-03T10:${String(i).padStart(2, "0")}:00Z`, comprehension: scored(s) }).learner; });
  return l;
};
const one = () => recordNewProgressionAttempt(newLearnerAggregate("kid", 90), { attemptId: "a1", passageId: "P1", displayedWpm: 90, passageWords: 100, recordedAt: "2026-10-03T10:00:00Z", comprehension: scored(0.9) }).record;

describe("APP-DATA-001 explicit attempt type", () => {
  it("supports the full approved ontology and only NEW_PROGRESSION counts as progression evidence", () => {
    expect([...ATTEMPT_TYPES]).toEqual(["NEW_PROGRESSION", "FAMILIAR_PRACTICE", "INITIAL_ASSESSMENT", "ASSESSMENT", "REASSESSMENT", "REVALIDATION", "NEWS_READER"]);
    expect(ATTEMPT_TYPES.filter(countsAsProgressionEvidence)).toEqual(["NEW_PROGRESSION"]);
  });
  it("rejects a null/unknown type", () => {
    expect(validateAttemptRecord({ ...one(), attemptType: null as never }).join()).toMatch(/attemptType must be one of/);
    expect(validateAttemptRecord({ ...one(), attemptType: "MYSTERY" as never }).join()).toMatch(/attemptType must be one of/);
  });
});

describe("APP-DATA-002 required attempt fields", () => {
  const base = one();
  it("a recorded attempt carries every required field", () => {
    expect(base).toMatchObject({
      attemptId: "a1", idempotencyKey: "a1", learnerId: "kid", sessionId: expect.any(String), passageId: "P1", attemptType: "NEW_PROGRESSION",
      displayedWpm: 90, passageWords: 100, pointerBefore: 1, pointerAfter: 2, spokenStatus: "SCORED", technicalState: "CLEAR",
      rawTranscript: null, confirmedTranscript: null, newsReaderMetrics: null, readinessOutcome: null, formFamilyId: null, registry: null
    });
    expect(base.startedAt && base.completedAt && base.recordedAt).toBeTruthy();
    expect(base.levelUpBefore).toEqual({ wpm: 90 });
    expect(base.assistance).toEqual({ bpcExposedBeforeEvidence: false, modelAnswerExposedBeforeEvidence: false, technicalRetryUsed: false });
    for (const k of ["calibration", "spokenExpression", "asrPolicy", "tokenizer", "content", "readiness"] as const) expect(base.ruleVersions[k]).toBeTruthy();
    expect(validateAttemptRecord(base)).toEqual([]);
  });
  it("accepts supplied session, idempotency key, timestamps, registry coordinate and both transcripts", () => {
    const r = recordNewProgressionAttempt(newLearnerAggregate("kid", 90), {
      attemptId: "a9", idempotencyKey: "evt-9", sessionId: "sess-1", passageId: "P9", displayedWpm: 90, passageWords: 100, recordedAt: "2026-10-03T10:05:00Z",
      startedAt: "2026-10-03T10:00:00Z", completedAt: "2026-10-03T10:05:00Z", registry: { registryPassageId: "REG-9", rsId: "RS03", p: 9 },
      rawTranscript: "the kid hat", confirmedTranscript: "the red kite", comprehension: scored(0.9)
    }).record;
    expect(r).toMatchObject({ idempotencyKey: "evt-9", sessionId: "sess-1", registry: { rsId: "RS03", p: 9 }, rawTranscript: "the kid hat", confirmedTranscript: "the red kite", startedAt: "2026-10-03T10:00:00Z" });
  });
  it.each(["idempotencyKey", "sessionId", "startedAt", "completedAt"] as const)("rejects a missing %s", (k) => {
    expect(validateAttemptRecord({ ...base, [k]: "" }).join()).toMatch(new RegExp(`${k}`));
  });
  it("validates timestamps order, pointer movement, transcript separation and applicability", () => {
    expect(validateAttemptRecord({ ...base, startedAt: "2026-10-04T00:00:00Z" }).join()).toMatch(/startedAt must not be after/);
    expect(validateAttemptRecord({ ...base, pointerAfter: 3 }).join()).toMatch(/stay or advance by one/);
    expect(validateAttemptRecord({ ...base, pointerAfter: 0 }).join()).toMatch(/stay or advance by one/);
    expect(validateAttemptRecord({ ...base, attemptType: "FAMILIAR_PRACTICE" }).join()).toMatch(/only a scored NEW_PROGRESSION attempt may advance/);
    expect(validateAttemptRecord({ ...base, confirmedTranscript: "x", rawTranscript: null }).join()).toMatch(/raw transcript to be retained/);
    expect(validateAttemptRecord({ ...base, newsReaderMetrics: { accuracy: 0.9 } }).join()).toMatch(/NEWS_READER attempts only/);
    expect(validateAttemptRecord({ ...base, readinessOutcome: "PASS" }).join()).toMatch(/ASSESSMENT\/REASSESSMENT\/REVALIDATION/);
    expect(validateAttemptRecord({ ...base, readinessOutcome: "PASS", attemptType: "REVALIDATION", pointerAfter: 1, classification: null, comprehensionScore: null }).join()).not.toMatch(/readiness outcome/);
  });
  it("evidence gathered after BPC exposure cannot be independent progression evidence (APP-DATA-004)", () => {
    expect(validateAttemptRecord({ ...base, assistance: { ...base.assistance, bpcExposedBeforeEvidence: true } }).join()).toMatch(/after BPC exposure/);
  });
  it("a technically unscored attempt keeps the pointer in place and flags the retry", () => {
    const l = recordNewProgressionAttempt(newLearnerAggregate("kid", 90), { attemptId: "t1", passageId: "P1", displayedWpm: 90, passageWords: 100, recordedAt: "2026-10-03T10:00:00Z", spokenReason: "ASR_LOW_CONFIDENCE", comprehension: { status: "AWAITING_SPOKEN", calibrationVersion: "c" } as never });
    expect(l.record).toMatchObject({ pointerBefore: 1, pointerAfter: 1, comprehensionScore: null, classification: null });
    expect(l.record.assistance.technicalRetryUsed).toBe(true);
  });
  it("records are frozen (APP-DATA-003 immutability)", () => {
    expect(Object.isFrozen(base)).toBe(true);
    expect(() => { (base as AttemptRecord & { displayedWpm: number }).displayedWpm = 1; }).toThrow();
  });
});

describe("APP-DATA-005/006 decision ledger and explainability", () => {
  const G = 0.9, N = 0.5;
  it("records a first-five LEVEL_UP with its evidence, reason code, before/after WPM, versions and time", () => {
    const l = play([G, G, G, G, N]); // 4/5
    const d = deriveDecisionLedger(l.ledger, 90);
    expect(d).toHaveLength(1);
    expect(d[0]).toMatchObject({
      decisionId: "DEC-a5", learnerId: "kid", decisionType: "LEVEL_UP", reasonCode: "LEVEL_UP: first_five_green_count=4/5",
      inputEvidenceIds: ["a1", "a2", "a3", "a4", "a5"], wpmBefore: 90, wpmAfter: 91
    });
    expect(d[0].ruleVersions.calibration).toBeTruthy();
    expect(d[0].decidedAt).toBe(l.ledger[4].completedAt);
    expect(Object.isFrozen(d[0])).toBe(true);
  });
  it("records a HOLD (3/5) and then a post-five LEVEL_UP with only the new window as input", () => {
    const l = play([G, G, G, N, N, G, G, G]);
    const d = deriveDecisionLedger(l.ledger, 90);
    expect(d.map((x) => [x.decisionType, x.reasonCode])).toEqual([["HOLD", "HOLD: first_five_green_count=3/5"], ["LEVEL_UP", "LEVEL_UP: post_five_consecutive_green=3"]]);
    expect(d[0]).toMatchObject({ wpmBefore: 90, wpmAfter: 90, inputEvidenceIds: ["a1", "a2", "a3", "a4", "a5"] });
    expect(d[1]).toMatchObject({ wpmBefore: 90, wpmAfter: 91 });
  });
  it("is reconstructed from the immutable ledger alone and is deterministic", () => {
    const l = play([G, G, G, G, G, G, G, G, G, G]);
    expect(deriveDecisionLedger(l.ledger, 90)).toEqual(deriveDecisionLedger(l.ledger, 90));
    expect(verifyDecisionLedger(deriveDecisionLedger(l.ledger, 90), l.ledger, 90)).toEqual([]);
  });
  it("detects a tampered or incomplete stored ledger", () => {
    const l = play([G, G, G, G, G]);
    const good = deriveDecisionLedger(l.ledger, 90);
    expect(verifyDecisionLedger([], l.ledger, 90).join()).toMatch(/replays to 1/);
    expect(verifyDecisionLedger([{ ...good[0], inputEvidenceIds: ["ghost"] }], l.ledger, 90).join()).toMatch(/unknown evidence ghost/);
    expect(verifyDecisionLedger([{ ...good[0], wpmAfter: 99 }], l.ledger, 90).join()).toMatch(/disagrees with the replay/);
    expect(verifyDecisionLedger([{ ...good[0], inputEvidenceIds: [] }], l.ledger, 90).join()).toMatch(/needs input evidence/);
    expect(verifyDecisionLedger([{ ...good[0], wpmBefore: 95, wpmAfter: 91 }], l.ledger, 90).join()).toMatch(/never decrease/);
  });
  it("practice and unscored attempts produce no decision", () => {
    expect(deriveDecisionLedger(play([G, G]).ledger, 90)).toEqual([]);
  });
});
