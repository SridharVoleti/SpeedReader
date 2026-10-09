import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { parseCsv } from "../../../lib/sr/pipeline-v2/csv";
import {
  READINESS_RULES, READINESS_RULESET_ID, RULESET_IS_CANONICAL, RS_KEYS, bandAReadiness, evaluateRs, measuresFromTelemetry, toAttemptOutcome,
  type P10Measures, type P10Sample, type RsKey
} from "../../../lib/v2/p10-readiness";
import { captureOralTelemetry } from "../../../lib/v2/oral-telemetry";
import { COUNT100_VERSION, count100 } from "../../../lib/sr/pipeline-v2/count100";
import { FIXTURE_STORY } from "../../../lib/v2/content-provider";
import { applyReadinessAttempt, newReadinessStream } from "../../../lib/v2/readiness-lifecycle";

const matrix = parseCsv(readFileSync("hosted-app/Content Creation/SpeedReader_World1_Blocker4_BandA_Readiness_Matrix_v1.0.csv", "utf8").replace(/^﻿/, ""));

/** A passing set of measures for each RS (comfortably inside every threshold). */
const PASSING: Record<RsKey, P10Measures> = {
  RS01: { finalAccuracy: 0.98, firstPassAccuracy: 0.96 },
  RS02: { sequenceErrorsPer100: 1, longestConsecutiveSkip: 1 },
  RS03: { functionWordAccuracy: 0.99, repeatedFunctionWordOmissionPattern: false },
  RS04: { taggedInflectedWords: 9, endingAccuracy: 0.96 },
  RS05: { taggedLongWords: 10, longWordFinalCorrectShare: 1, medianLongWordHesitationSec: 1.5, targetCausedFullRestarts: 0 },
  RS06: { longHesitationsPer100: 1, unexplainedSilenceMaxSec: 3 },
  RS07: { eligibleErrors: 4, timelySelfCorrectedShare: 1, correctionTriggeredFullRestarts: 0 },
  RS08: { unnecessaryRepeatsPer100: 1, fullRestartsPer100: 0 },
  RS09: { sentenceBoundaryCompliance: 0.9, boundaryLinkedOmittedFirstWords: 0 },
  RS10: { internalPunctuationCompliance: 0.85, punctuationTriggeredRestarts: 0 },
  RS11: { paceSpread: 0.15, maxQuartileSlowdown: 0.2 },
  RS12: { taggedChallengeWords: 2, challengeRecoveredShare: 1, maxPostChallengeSequenceErrors: 0 },
  RS13: { middleThirdAccuracyDeltaPp: 1, middleThirdMultiWordSkips: 0, unexplainedSilenceMaxSec: 2 },
  RS14: { finalThirdAccuracyDeltaPp: -1, finalThirdWpmDropShare: 0.05 },
  RS15: { finalAccuracy: 0.97, sequenceErrors: 1, longHesitations: 2, fullRestarts: 0, paceSpread: 0.1 }
};
const sample = (rs: RsKey, over: Partial<P10Measures> = {}, extra: Partial<P10Sample> = {}): P10Sample => ({ rs, p: 10, valid: true, measures: { ...PASSING[rs], ...over }, ...extra });
const status = (rs: RsKey, over: Partial<P10Measures> = {}, extra: Partial<P10Sample> = {}) => evaluateRs(sample(rs, over, extra), rs).status;

describe("the rule table is exactly the shipped Blocker-4 readiness matrix (no invented thresholds)", () => {
  it("is versioned and honestly labelled as non-canonical", () => {
    expect(READINESS_RULESET_ID).toBe("BLOCKER4-BANDA-READINESS-V1.0");
    expect(RULESET_IS_CANONICAL).toBe(false);
  });
  it("covers RS01..RS15 once each, and each rule text equals the CSV p10_success_rule verbatim", () => {
    expect(READINESS_RULES.map((r) => r.rs)).toEqual([...RS_KEYS]);
    expect(matrix).toHaveLength(15);
    for (const row of matrix) {
      const rule = READINESS_RULES.find((r) => r.rs === row.reading_stage)!;
      expect(rule.specText, row.reading_stage).toBe(row.p10_success_rule.trim());
      expect(rule.name).toBe(row.rs_name);
    }
  });
  it("the baseline passing fixtures really pass every rule", () => {
    for (const rs of RS_KEYS) expect(["READY", "READY_NO_ERROR_OPPORTUNITY"], rs).toContain(status(rs));
  });
});

describe("every threshold is exact: the boundary passes, one step beyond is NOT_YET", () => {
  const cases: [RsKey, string, Partial<P10Measures>, Partial<P10Measures>][] = [
    ["RS01", "final_accuracy", { finalAccuracy: 0.97 }, { finalAccuracy: 0.9699 }],
    ["RS01", "first_pass_accuracy", { firstPassAccuracy: 0.95 }, { firstPassAccuracy: 0.9499 }],
    ["RS02", "sequence_errors_per_100", { sequenceErrorsPer100: 2 }, { sequenceErrorsPer100: 2.01 }],
    ["RS02", "no_2plus_word_skip", { longestConsecutiveSkip: 1 }, { longestConsecutiveSkip: 2 }],
    ["RS03", "function_word_accuracy", { functionWordAccuracy: 0.98 }, { functionWordAccuracy: 0.9799 }],
    ["RS03", "no_repeated_function_word_omission", { repeatedFunctionWordOmissionPattern: false }, { repeatedFunctionWordOmissionPattern: true }],
    ["RS04", "ending_accuracy", { endingAccuracy: 0.95 }, { endingAccuracy: 0.9499 }],
    ["RS05", "long_words_final_correct", { longWordFinalCorrectShare: 0.9 }, { longWordFinalCorrectShare: 0.8 }],
    ["RS05", "median_target_hesitation", { medianLongWordHesitationSec: 3 }, { medianLongWordHesitationSec: 3.01 }],
    ["RS05", "no_target_caused_restart", { targetCausedFullRestarts: 0 }, { targetCausedFullRestarts: 1 }],
    ["RS06", "long_hesitations_per_100", { longHesitationsPer100: 3 }, { longHesitationsPer100: 3.01 }],
    ["RS06", "no_unexplained_silence", { unexplainedSilenceMaxSec: 6 }, { unexplainedSilenceMaxSec: 6.01 }],
    ["RS07", "timely_self_correction", { timelySelfCorrectedShare: 0.8 }, { timelySelfCorrectedShare: 0.79 }],
    ["RS07", "correction_restarts", { correctionTriggeredFullRestarts: 1 }, { correctionTriggeredFullRestarts: 2 }],
    ["RS08", "unnecessary_repeats", { unnecessaryRepeatsPer100: 2 }, { unnecessaryRepeatsPer100: 2.01 }],
    ["RS08", "full_restarts_per_100", { fullRestartsPer100: 1 }, { fullRestartsPer100: 1.01 }],
    ["RS09", "sentence_boundary_compliance", { sentenceBoundaryCompliance: 0.85 }, { sentenceBoundaryCompliance: 0.8499 }],
    ["RS09", "no_boundary_linked_omissions", { boundaryLinkedOmittedFirstWords: 0 }, { boundaryLinkedOmittedFirstWords: 1 }],
    ["RS10", "internal_punctuation_compliance", { internalPunctuationCompliance: 0.8 }, { internalPunctuationCompliance: 0.7999 }],
    ["RS10", "no_punctuation_triggered_restarts", { punctuationTriggeredRestarts: 0 }, { punctuationTriggeredRestarts: 1 }],
    ["RS11", "pace_spread", { paceSpread: 0.25 }, { paceSpread: 0.2501 }],
    ["RS11", "no_quartile_over_35pct_slower", { maxQuartileSlowdown: 0.35 }, { maxQuartileSlowdown: 0.3501 }],
    ["RS12", "challenge_recovery", { challengeRecoveredShare: 0.8 }, { challengeRecoveredShare: 0.79 }],
    ["RS12", "post_challenge_sequence_errors", { maxPostChallengeSequenceErrors: 1 }, { maxPostChallengeSequenceErrors: 2 }],
    ["RS13", "middle_third_accuracy", { middleThirdAccuracyDeltaPp: 2 }, { middleThirdAccuracyDeltaPp: 2.01 }],
    ["RS13", "no_2plus_word_skip_in_middle", { middleThirdMultiWordSkips: 0 }, { middleThirdMultiWordSkips: 1 }],
    ["RS14", "final_third_accuracy", { finalThirdAccuracyDeltaPp: -2 }, { finalThirdAccuracyDeltaPp: -2.01 }],
    ["RS14", "final_third_wpm_drop", { finalThirdWpmDropShare: 0.15 }, { finalThirdWpmDropShare: 0.1501 }],
    ["RS15", "final_accuracy", { finalAccuracy: 0.95 }, { finalAccuracy: 0.9499 }],
    ["RS15", "sequence_errors", { sequenceErrors: 2 }, { sequenceErrors: 3 }],
    ["RS15", "long_hesitations", { longHesitations: 4 }, { longHesitations: 5 }],
    ["RS15", "full_restarts", { fullRestarts: 1 }, { fullRestarts: 2 }],
    ["RS15", "pace_spread", { paceSpread: 0.25 }, { paceSpread: 0.26 }]
  ];
  it.each(cases)("%s %s", (rs, id, atBoundary, beyond) => {
    expect(["READY", "READY_NO_ERROR_OPPORTUNITY"]).toContain(status(rs, atBoundary));
    const r = evaluateRs(sample(rs, beyond), rs);
    expect(r.status).toBe("NOT_YET");
    expect(r.failedCriteria).toContain(id);
  });
  it("a miss on one criterion names exactly that criterion and leaves the others passed", () => {
    const r = evaluateRs(sample("RS15", { sequenceErrors: 5 }), "RS15");
    expect(r.failedCriteria).toEqual(["sequence_errors"]);
    expect(r.criteria.filter((c) => c.passed).length).toBe(4);
  });
});

describe("REASSESS is 'no trustworthy evidence', never a guessed pass or fail", () => {
  it("no sample, a sample for another RS, or an earlier-P sample cannot be judged", () => {
    expect(evaluateRs(undefined, "RS03")).toMatchObject({ status: "REASSESS", reassessReason: "NO_P10_SAMPLE" });
    expect(evaluateRs(sample("RS04"), "RS03")).toMatchObject({ status: "REASSESS", reassessReason: "SAMPLE_FOR_DIFFERENT_RS" });
    expect(evaluateRs(sample("RS03", {}, { p: 9 }), "RS03")).toMatchObject({ status: "REASSESS", reassessReason: "NOT_A_P10_SAMPLE" });
  });
  it("an invalid sample (unusable audio, unresolved ASR) is REASSESS even if its numbers look perfect", () => {
    expect(evaluateRs(sample("RS01", {}, { valid: false }), "RS01")).toMatchObject({ status: "REASSESS", reassessReason: "INVALID_SAMPLE" });
  });
  it("a missing measure is insufficient evidence, not a failure", () => {
    const r = evaluateRs(sample("RS02", { longestConsecutiveSkip: undefined }), "RS02");
    expect(r).toMatchObject({ status: "REASSESS", reassessReason: "INSUFFICIENT_EVIDENCE:longestConsecutiveSkip" });
    expect(evaluateRs(sample("RS01", { finalAccuracy: Number.NaN }), "RS01").status).toBe("REASSESS");
  });
  it("too few tagged opportunities are insufficient evidence (RS04 needs 8, RS05 needs 10, RS12 needs 1)", () => {
    expect(evaluateRs(sample("RS04", { taggedInflectedWords: 7 }), "RS04").reassessReason).toBe("INSUFFICIENT_EVIDENCE:tagged_inflected_words");
    expect(status("RS04", { taggedInflectedWords: 8 })).toBe("READY");
    expect(evaluateRs(sample("RS05", { taggedLongWords: 9 }), "RS05").status).toBe("REASSESS");
    expect(status("RS05", { taggedLongWords: 10 })).toBe("READY");
    expect(evaluateRs(sample("RS12", { taggedChallengeWords: 0 }), "RS12").status).toBe("REASSESS");
  });
  it("REASSESS wins over a would-be NOT_YET: an unjudgeable sample is never scored as a miss", () => {
    expect(status("RS04", { taggedInflectedWords: 3, endingAccuracy: 0.1 })).toBe("REASSESS");
  });
});

describe("RS07: efficient self-correction", () => {
  it("no eligible errors -> READY_NO_ERROR_OPPORTUNITY (success, not a penalty)", () => {
    expect(status("RS07", { eligibleErrors: 0, timelySelfCorrectedShare: undefined, correctionTriggeredFullRestarts: 0 })).toBe("READY_NO_ERROR_OPPORTUNITY");
  });
  it("with eligible errors the 80% rule applies; unknown eligible-error count is insufficient", () => {
    expect(status("RS07", { eligibleErrors: 5, timelySelfCorrectedShare: 0.8 })).toBe("READY");
    expect(status("RS07", { eligibleErrors: 5, timelySelfCorrectedShare: 0.6 })).toBe("NOT_YET");
    expect(status("RS07", { eligibleErrors: undefined })).toBe("REASSESS");
  });
  it("READY_NO_ERROR_OPPORTUNITY exists for RS07 only", () => {
    for (const rs of RS_KEYS) if (rs !== "RS07") expect(status(rs)).not.toBe("READY_NO_ERROR_OPPORTUNITY");
  });
});

describe("Band-A decision: all 15 resolved ready AND P10 comprehension resolved; no compensation", () => {
  const allReady = () => RS_KEYS.map((rs) => sample(rs));
  it("is ready only when every RS is ready and comprehension is resolved", () => {
    const r = bandAReadiness(allReady(), true);
    expect(r).toMatchObject({ bandAReady: true, readyCount: 15, display: "15/15 competencies ready", notYet: [], reassess: [], rulesetId: READINESS_RULESET_ID });
  });
  it("14/15 is not enough: no majority, 13/15, or 3/5 shortcut", () => {
    const s = allReady().map((x) => (x.rs === "RS09" ? sample("RS09", { sentenceBoundaryCompliance: 0.5 }) : x));
    const r = bandAReadiness(s, true);
    expect(r).toMatchObject({ bandAReady: false, readyCount: 14, display: "14/15 competencies ready", notYet: ["RS09"] });
  });
  it("one weak RS is never cancelled by strong others (no averaging), and the integrated RS15 cannot stand in for RS01-14", () => {
    const strongRs15 = allReady().map((x) => (x.rs === "RS02" ? sample("RS02", { sequenceErrorsPer100: 9 }) : x));
    const r = bandAReadiness(strongRs15, true);
    expect(r.vector.RS15).toBe("READY");
    expect(r.bandAReady).toBe(false);
  });
  it("unresolved P10 comprehension keeps Band-A open even when all oral competencies are ready (separate dimensions)", () => {
    expect(bandAReadiness(allReady(), false)).toMatchObject({ bandAReady: false, readyCount: 15, p10ComprehensionResolved: false });
  });
  it("a missing RS sample is REASSESS (the final round must cover all 15), and a lone sample cannot be a shortcut", () => {
    const r = bandAReadiness(allReady().filter((s) => s.rs !== "RS11"), true);
    expect(r.vector.RS11).toBe("REASSESS");
    expect(r.bandAReady).toBe(false);
    expect(bandAReadiness([sample("RS01")], true).readyCount).toBe(1);
    expect(bandAReadiness([], true).reassess).toHaveLength(15);
  });
  it("the P10 sample is used even if earlier-P history for the same RS is also supplied", () => {
    const history = [sample("RS01", { finalAccuracy: 0.2 }, { p: 3 }), sample("RS01")];
    expect(bandAReadiness(history, true).vector.RS01).toBe("READY");
    const onlyHistory = bandAReadiness([sample("RS01", {}, { p: 9 })], true);
    expect(onlyHistory.vector.RS01).toBe("REASSESS");
  });
  it("NOT_YET and REASSESS are tracked separately for targeted remediation vs a fresh sample", () => {
    const s = allReady().map((x) => (x.rs === "RS03" ? sample("RS03", { functionWordAccuracy: 0.9 }) : x.rs === "RS06" ? sample("RS06", {}, { valid: false }) : x));
    const r = bandAReadiness(s, true);
    expect(r.notYet).toEqual(["RS03"]);
    expect(r.reassess).toEqual(["RS06"]);
    expect(r.results.RS03.failedCriteria).toEqual(["function_word_accuracy"]);
  });
});

describe("integration with the readiness lifecycle and the oral telemetry", () => {
  it("maps statuses onto lifecycle outcomes: ready=PASS, NOT_YET=FAIL, REASSESS=INSUFFICIENT_EVIDENCE (not a learner failure)", () => {
    expect(toAttemptOutcome("READY")).toBe("PASS");
    expect(toAttemptOutcome("READY_NO_ERROR_OPPORTUNITY")).toBe("PASS");
    expect(toAttemptOutcome("NOT_YET")).toBe("FAIL");
    expect(toAttemptOutcome("REASSESS")).toBe("INSUFFICIENT_EVIDENCE");
    const att = (outcome: ReturnType<typeof toAttemptOutcome>) => ({ registryPassageId: "R", formFamilyId: "F", assessmentFormId: "f1", deliveryEventId: "e1", attemptId: "a1", role: "PRIMARY" as const, outcome, at: "2026-10-09T10:00:00Z" });
    const r = applyReadinessAttempt(newReadinessStream("kid", "RS01"), att(toAttemptOutcome("REASSESS")));
    expect(r).toMatchObject({ ok: true, learnerFailure: false });
  });

  it("telemetry supplies only what it truly measures, so rules needing the rest return REASSESS instead of an undercounted pass", () => {
    const tokens = count100(FIXTURE_STORY).tokens;
    const words = tokens.map((t, i) => ({ word: t.text, startMs: i * 400, endMs: i * 400 + 300, confidence: 0.95 }));
    const res = captureOralTelemetry(tokens, words, { usable: true, speechDetected: true, durationMs: 60_000 }, COUNT100_VERSION);
    if (res.status !== "ASSESSED") throw new Error("expected assessed");
    const m = measuresFromTelemetry(res.telemetry);
    expect(m).toMatchObject({ finalAccuracy: 1, firstPassAccuracy: 1, longHesitationsPer100: 0, fullRestartsPer100: 0, unnecessaryRepeatsPer100: 0 });
    expect(status("RS01", m)).toBe("READY");
    expect(evaluateRs({ rs: "RS08", p: 10, valid: true, measures: m }, "RS08").status).toBe("READY");
    // RS02 needs reorderings/longest skip, RS06 needs silence length, RS15 needs sequence errors + pace: not captured -> REASSESS
    for (const rs of ["RS02", "RS06", "RS15"] as RsKey[]) expect(evaluateRs({ rs, p: 10, valid: true, measures: m }, rs).status, rs).toBe("REASSESS");
  });
});
