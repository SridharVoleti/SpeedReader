import { describe, expect, it } from "vitest";
import {
  ASSESSMENT_CONFIG, newAssessment, recordAssessmentAttempt, runAssessment, type AssessmentAttempt
} from "../../../lib/v2/initial-assessment";

const cfg = ASSESSMENT_CONFIG; // PROVISIONAL_PILOT: start 60, step 10, min 30, 2 confirmations, 600s
const attempt = (wpm: number, score: number, durationSec = 40, extra: object = {}): AssessmentAttempt =>
  ({ wpm, comprehensionScore: score, durationSec, ...extra });

// A learner who comprehends at or below `limit` WPM and not above it.
const learnerWithLimit = (limit: number, durationSec = 40) => (wpm: number) => attempt(wpm, wpm <= limit ? 0.9 : 0.4, durationSec);

// FR-008 - Ten-minute initial assessment [FROZEN]
describe("FR-008 ten-minute initial assessment", () => {
  it("is bounded to ten minutes", () => {
    expect(cfg.timeBudgetSec).toBe(600);
    const result = runAssessment(learnerWithLimit(500, 120), { ...cfg, ceilingWpm: 1000 }); // never fails, 2 min per attempt
    expect(result.elapsedSec).toBeLessThanOrEqual(600 + 120); // the in-flight attempt may finish
    expect(result.attempts.length).toBeLessThanOrEqual(6);
    expect(result.status).toBe("COMPLETE");
  });

  it("finds a sustainable starting WPM: highest WPM with confirmed comprehension", () => {
    expect(runAssessment(learnerWithLimit(80), cfg).startingWpm).toBe(80);
  });

  it("does not take a single lucky fast attempt as the baseline", () => {
    let state = newAssessment(cfg);
    const script = [attempt(60, 0.9), attempt(60, 0.9), attempt(70, 0.9), attempt(70, 0.9), attempt(80, 0.9), attempt(80, 0.3), attempt(80, 0.3)];
    for (const a of script) state = recordAssessmentAttempt(state, a);
    expect(state.status).toBe("COMPLETE");
    expect(state.startingWpm).toBe(70);
  });

  it("searches downward when the learner cannot sustain the opening speed", () => {
    expect(runAssessment(learnerWithLimit(45), cfg).startingWpm).toBe(40);
    expect(runAssessment(learnerWithLimit(0), cfg).startingWpm).toBe(cfg.minWpm);
  });

  it("never starts above the World 1 ceiling of 150 WPM", () => {
    const result = runAssessment(learnerWithLimit(1000, 10), { ...cfg, timeBudgetSec: 100000 });
    expect(result.startingWpm).toBe(150);
    expect(Math.max(...result.attempts.map((a) => a.wpm))).toBeLessThanOrEqual(150);
  });

  it("uses comprehension as the only evidence: oral/News Reader fields cannot change the result", () => {
    const withOral = runAssessment((wpm) => attempt(wpm, wpm <= 80 ? 0.9 : 0.4, 40, { oralQuality: 0, newsReaderScore: 0 }), cfg);
    expect(withOral.startingWpm).toBe(80);
    expect(JSON.stringify(withOral.attempts)).not.toMatch(/oral|newsReader/i);
  });

  it("uses the 75% GREEN threshold exactly", () => {
    let state = newAssessment(cfg);
    state = recordAssessmentAttempt(state, attempt(60, 0.75));
    expect(state.attempts[0].classification).toBe("GREEN");
    state = recordAssessmentAttempt(state, attempt(60, 0.7499));
    expect(state.attempts[1].classification).toBe("NOT_GREEN");
  });

  it("is deterministic and auditable", () => {
    const a = runAssessment(learnerWithLimit(95), cfg);
    const b = runAssessment(learnerWithLimit(95), cfg);
    expect(a).toEqual(b);
    expect(a.attempts.every((x, i) => x.index === i + 1 && typeof x.reason === "string")).toBe(true);
    expect(a.algorithmVersion).toBe(cfg.algorithmVersion);
  });

  it("records the personal speed baseline and begins P1 at that WPM, with no age or peer inputs", () => {
    const result = runAssessment(learnerWithLimit(90), cfg);
    expect(result.baseline).toEqual({ startingWpm: 90, source: "INITIAL_ASSESSMENT", algorithmVersion: cfg.algorithmVersion });
    expect(result.firstPassageWpm).toBe(90);
    expect(Object.keys(cfg)).not.toEqual(expect.arrayContaining(["age", "peerAverage"]));
  });

  it("rejects attempts after completion, invalid scores and out-of-sequence speeds", () => {
    const done = runAssessment(learnerWithLimit(80), cfg);
    expect(() => recordAssessmentAttempt(done, attempt(80, 0.9))).toThrow(/complete/);
    expect(() => recordAssessmentAttempt(newAssessment(cfg), attempt(60, 1.2))).toThrow(RangeError);
    expect(() => recordAssessmentAttempt(newAssessment(cfg), attempt(70, 0.9))).toThrow(/expected attempt at 60/);
  });
});

// APP-ASSESS-005 baseline persistence record
import { toAssessmentRecord } from "../../../lib/v2/initial-assessment";
describe("APP-ASSESS-005 assessment record", () => {
  it("captures id, learner, attempts, version, config, starting WPM and completion time; later passage 1 starts there (APP-ASSESS-006)", () => {
    const done = runAssessment(learnerWithLimit(90), cfg);
    const rec = toAssessmentRecord(done, { assessmentId: "as-1", learnerId: "kid" }, "2026-10-09T10:00:00Z");
    expect(rec).toMatchObject({ assessmentId: "as-1", learnerId: "kid", startingWpm: 90, algorithmVersion: cfg.algorithmVersion, completedAt: "2026-10-09T10:00:00Z" });
    expect(rec.attempts).toHaveLength(done.attempts.length);
    expect(rec.configSnapshot).toEqual(cfg);
    expect(Object.isFrozen(rec)).toBe(true);
  });
  it("refuses an incomplete assessment, missing ids or a bad timestamp", () => {
    expect(() => toAssessmentRecord(newAssessment(), { assessmentId: "a", learnerId: "k" }, "2026-10-09T10:00:00Z")).toThrow(/completed/);
    const done = runAssessment(learnerWithLimit(90), cfg);
    expect(() => toAssessmentRecord(done, { assessmentId: "", learnerId: "k" }, "2026-10-09T10:00:00Z")).toThrow(/required/);
    expect(() => toAssessmentRecord(done, { assessmentId: "a", learnerId: "k" }, "nope")).toThrow(RangeError);
  });
});
