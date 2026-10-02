import { describe, expect, it } from "vitest";
import {
  assertResponseEditable, correctAttempt, effectiveAttempts, isSilentFailureRecord, recordPostModelAnswerInteraction
} from "../../../lib/v2/evidence-governance";
import { lockScoring, newBpcAttempt, submitAttempt } from "../../../lib/v2/best-comprehension";
import { recordNewProgressionAttempt, validateAttemptRecord } from "../../../lib/v2/attempt-record";
import { newLearnerAggregate } from "../../../lib/v2/learner-aggregate";
import { scoreComprehension, structuredEvidence } from "../../../lib/v2/comprehension-score";
import { applyAttemptToCore, newCoreWpmState } from "../../../lib/v2/attempt-types";
import { recordPracticeAttempt, type LearnerRecord } from "../../../lib/v2/familiar-practice";
import { comprehensionEvidenceForPassage, emptyEvidenceStore, recordNewsReaderEvidence } from "../../../lib/v2/evidence-store";

const scored = (s: number) => scoreComprehension(structuredEvidence([{ itemId: "q1", score: s }]), { score: s });
const input = (id: string, s = 0.5) => ({ attemptId: id, passageId: "P001", displayedWpm: 90, passageWords: 100, recordedAt: "2026-10-03T10:00:00Z", comprehension: scored(s) });

// FR-048 - Evidence separation [FROZEN]
describe("FR-048 evidence separation", () => {
  it("familiar practice cannot count as new progression evidence", () => {
    let state = newCoreWpmState(90);
    for (let i = 0; i < 20; i += 1) state = applyAttemptToCore(state, { attemptId: `p${i}`, attemptType: "FAMILIAR_PRACTICE", classification: "GREEN" }).state;
    expect(state.wpm).toBe(90);
    expect(state.newAttempts).toEqual([]);
    const rec: LearnerRecord = { core: state, canonicalPointer: 4, originalAttempts: { P1: { score: 0.6 } }, practiceAnalytics: [] };
    expect(recordPracticeAttempt(rec, { attemptId: "x", passageId: "P1", wpm: 90, classification: "GREEN" }).core).toEqual(state);
  });

  it("News Reader cannot count as comprehension GREEN evidence", () => {
    const base = recordNewProgressionAttempt(newLearnerAggregate("l", 90), input("a1", 0.9)).record;
    expect(validateAttemptRecord({ ...base, attemptType: "NEWS_READER" }).join()).toMatch(/NEWS_READER attempts cannot carry comprehension evidence/);
    let store = emptyEvidenceStore();
    store = recordNewsReaderEvidence(store, { attemptId: "n", passageId: "P001", readNumber: 1, metrics: { clarity: 1 }, technicalState: "OK", recordedAt: "2026-10-03T10:00:00Z" });
    expect(comprehensionEvidenceForPassage(store, "P001")).toEqual([]);
  });

  it("post-model-answer interaction cannot retroactively improve the original passage score", () => {
    const open = newBpcAttempt("a1", "P001");
    expect(() => assertResponseEditable(open)).not.toThrow();
    const submitted = submitAttempt(open);
    expect(() => assertResponseEditable(submitted)).toThrow(/closed/);
    const locked = lockScoring(submitted, { score: 0.5, classification: "NOT_GREEN" });
    expect(() => assertResponseEditable(locked)).toThrow(/cannot change the original passage score/);
    expect(locked.lockedEvidence).toEqual({ score: 0.5, classification: "NOT_GREEN" });
  });

  it("records interactions after the model answer separately, never as evidence", () => {
    const list = recordPostModelAnswerInteraction([], "a1", "RETELL_AFTER_MODEL_ANSWER", "2026-10-03T10:05:00Z");
    expect(list).toHaveLength(1);
    expect(list[0].countsAsEvidence).toBe(false);
    expect(Object.isFrozen(list[0])).toBe(true);
  });

  it("technical retries are never silently recorded as learner failures", () => {
    const pending = scoreComprehension(structuredEvidence([{ itemId: "q1", score: 0 }]), null);
    const { record, learner } = recordNewProgressionAttempt(newLearnerAggregate("l", 90), { ...input("a1"), comprehension: pending, spokenReason: "ASR_UNUSABLE" });
    expect(record.classification).toBeNull();
    expect(isSilentFailureRecord(record)).toBe(false);
    expect(learner.core.newAttempts).toEqual([]);
    expect(learner.canonicalPointer).toBe(1);
    // the audit would catch a record that did sneak in as NOT_GREEN
    expect(isSilentFailureRecord({ ...record, classification: "NOT_GREEN", comprehensionScore: 0 })).toBe(true);
  });

  it("historical attempts are immutable; corrections add an explicit replacement + audit record", () => {
    const { learner, record } = recordNewProgressionAttempt(newLearnerAggregate("l", 90), input("a1", 0.6));
    const fixed = Object.freeze({ ...record, attemptId: "a1-corrected", comprehensionScore: 0.8, classification: "GREEN" as const });
    const audit = { correctedAt: "2026-10-04", reason: "scoring defect SD-12", correctedBy: "qa-1" };
    const corrections = correctAttempt(learner.ledger, [], "a1", fixed, audit);
    expect(effectiveAttempts(learner.ledger, corrections)[0].attemptId).toBe("a1-corrected");
    // original untouched
    expect(learner.ledger[0]).toBe(record);
    expect(learner.ledger[0].comprehensionScore).toBeCloseTo(0.6);
    expect(Object.isFrozen(corrections[0])).toBe(true);
    expect(corrections[0].audit).toEqual(audit);
    expect(() => {
      "use strict";
      (record as { comprehensionScore: number }).comprehensionScore = 1;
    }).toThrow();
  });

  it("rejects unaudited corrections, unknown attempts and in-place replacement", () => {
    const { learner, record } = recordNewProgressionAttempt(newLearnerAggregate("l", 90), input("a1"));
    const audit = { correctedAt: "2026-10-04", reason: "x", correctedBy: "qa" };
    expect(() => correctAttempt(learner.ledger, [], "nope", record, audit)).toThrow(/unknown attempt/);
    expect(() => correctAttempt(learner.ledger, [], "a1", { ...record, attemptId: "b" }, { ...audit, reason: "" })).toThrow(/reason/);
    expect(() => correctAttempt(learner.ledger, [], "a1", record, audit)).toThrow(/own attempt id/);
  });
});
