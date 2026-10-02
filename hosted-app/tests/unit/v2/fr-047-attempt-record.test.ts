import { describe, expect, it } from "vitest";
import { currentRuleVersions, recordNewProgressionAttempt, validateAttemptRecord, type AttemptRecord } from "../../../lib/v2/attempt-record";
import { newLearnerAggregate } from "../../../lib/v2/learner-aggregate";
import { scoreComprehension, structuredEvidence } from "../../../lib/v2/comprehension-score";
import { ATTEMPT_TYPES } from "../../../lib/v2/attempt-types";

const scored = (s: number) => scoreComprehension(structuredEvidence([{ itemId: "q1", score: s }, { itemId: "q2", score: s }]), { score: s });
const input = (id: string, s = 0.9) => ({
  attemptId: id, passageId: "P001", displayedWpm: 90, passageWords: 100, recordedAt: "2026-10-03T10:00:00Z", comprehension: scored(s)
});

// FR-047 - Attempt types and attempt record [FROZEN]
describe("FR-047 attempt records", () => {
  it("records every required field for a new progression attempt", () => {
    const { record } = recordNewProgressionAttempt(newLearnerAggregate("learner-1", 90), input("a1"));
    expect(record).toMatchObject({
      learnerId: "learner-1", attemptId: "a1", passageId: "P001", attemptType: "NEW_PROGRESSION", displayedWpm: 90,
      passageWords: 100, recordedAt: "2026-10-03T10:00:00Z", spokenStatus: "SCORED", technicalState: "CLEAR", classification: "GREEN"
    });
    expect(record.structured?.items).toHaveLength(2);
    expect(record.comprehensionScore).toBeCloseTo(0.9);
    expect(record.levelUpBefore).toEqual({ wpm: 90 });
    expect(record.levelUpAfter).toEqual({ wpm: 90, event: "NONE" });
    expect(record.ruleVersions).toEqual(currentRuleVersions());
    expect(validateAttemptRecord(record)).toEqual([]);
  });

  it("captures Level-Up state before and after", () => {
    let learner = newLearnerAggregate("l", 90);
    let last!: AttemptRecord;
    for (let i = 0; i < 5; i += 1) {
      const out = recordNewProgressionAttempt(learner, input(`a${i}`));
      learner = out.learner;
      last = out.record;
    }
    expect(last.levelUpBefore).toEqual({ wpm: 90 });
    expect(last.levelUpAfter).toEqual({ wpm: 91, event: "LEVEL_UP" });
    expect(learner.ledger).toHaveLength(5);
  });

  it("stores the versions of every rule that affects the decision (CODEX-11)", () => {
    const v = recordNewProgressionAttempt(newLearnerAggregate("l", 90), input("a1")).record.ruleVersions;
    expect(Object.keys(v).sort()).toEqual(["asrPolicy", "calibration", "content", "readiness", "spokenExpression", "tokenizer"]);
    expect(Object.values(v).every((x) => x.length > 0)).toBe(true);
  });

  it("records unresolved spoken evidence with an audit reason and no score or classification", () => {
    const pending = scoreComprehension(structuredEvidence([{ itemId: "q1", score: 1 }]), null);
    const { record, learner } = recordNewProgressionAttempt(newLearnerAggregate("l", 90), {
      ...input("a1"), comprehension: pending, spokenReason: "ASR_LOW_CONFIDENCE"
    });
    expect(record).toMatchObject({ spokenStatus: "UNRESOLVED_TECHNICAL", spokenReason: "ASR_LOW_CONFIDENCE", comprehensionScore: null, classification: null, technicalState: "ASR_UNCERTAIN" });
    expect(learner.canonicalPointer).toBe(1);
  });

  it("freezes records: historical attempts are immutable", () => {
    const { record } = recordNewProgressionAttempt(newLearnerAggregate("l", 90), input("a1"));
    expect(Object.isFrozen(record)).toBe(true);
    expect(() => {
      "use strict";
      (record as { displayedWpm: number }).displayedWpm = 1;
    }).toThrow();
  });

  it("is idempotent per attempt id: reprocessing cannot award a second Level Up (AC-C04)", () => {
    let learner = newLearnerAggregate("l", 90);
    for (let i = 0; i < 5; i += 1) learner = recordNewProgressionAttempt(learner, input(`a${i}`)).learner;
    const again = recordNewProgressionAttempt(learner, input("a4"));
    expect(again.learner).toBe(learner);
    expect(again.learner.core.wpm).toBe(91);
    expect(again.learner.ledger).toHaveLength(5);
  });

  it("validation: requires a non-null approved attempt type (AC-C02) and the required fields", () => {
    const base = recordNewProgressionAttempt(newLearnerAggregate("l", 90), input("a1")).record;
    expect(validateAttemptRecord({ ...base, attemptType: undefined as never }).join()).toMatch(/attemptType/);
    expect(validateAttemptRecord({ ...base, attemptType: "OTHER" as never }).join()).toMatch(/attemptType/);
    expect(validateAttemptRecord({ ...base, learnerId: "" })).toContain("learnerId is required");
    expect(validateAttemptRecord({ ...base, passageId: "" })).toContain("passageId is required");
    expect(validateAttemptRecord({ ...base, displayedWpm: 0 })).toContain("displayedWpm must be positive");
    expect(validateAttemptRecord({ ...base, passageWords: 0 })).toContain("passageWords must be a positive integer");
    expect(validateAttemptRecord({ ...base, recordedAt: "nope" })).toContain("recordedAt must be a valid timestamp");
    expect(validateAttemptRecord({ ...base, ruleVersions: { ...base.ruleVersions, calibration: "" } }).join()).toMatch(/calibration/);
  });

  it("validation: News Reader records cannot carry comprehension evidence; only new progression changes Level-Up state; WPM never drops", () => {
    const base = recordNewProgressionAttempt(newLearnerAggregate("l", 90), input("a1")).record;
    expect(validateAttemptRecord({ ...base, attemptType: "NEWS_READER" }).join()).toMatch(/NEWS_READER attempts cannot carry comprehension evidence/);
    expect(validateAttemptRecord({ ...base, attemptType: "FAMILIAR_PRACTICE", levelUpAfter: { wpm: 91, event: "NOT_APPLICABLE" } }).join()).toMatch(/only NEW_PROGRESSION/);
    expect(validateAttemptRecord({ ...base, levelUpAfter: { wpm: 89, event: "NONE" } }).join()).toMatch(/never decrease/);
    expect(validateAttemptRecord({ ...base, classification: null }).join()).toMatch(/both be present or both absent/);
    expect(ATTEMPT_TYPES).toHaveLength(5);
  });
});
