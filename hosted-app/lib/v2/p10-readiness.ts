// APP-KM-004 / APP-ORAL-002 steps 8-9 / APP-KM-007 / APP-READY-003 - Band-A P10 oral readiness rules.
//
// Executes the supplied rule table: "SpeedReader World 1 - Blocker 4 Band-A Readiness Specification v1.0"
// (hosted-app/Content Creation). It is a VERSIONED rule set, not canonical authority: the approved canonical v0.56
// package is the final authority and must be diffed against this table when it exists (the table text is asserted equal
// to the shipped matrix CSV by tests, so drift is caught). The app invents no thresholds and no aggregation.
//
// Statuses: READY | READY_NO_ERROR_OPPORTUNITY (RS07 only) | REASSESS | NOT_YET.
//  - invalid sample, unresolved ASR, or any required measure unavailable/insufficient -> REASSESS (never a guessed pass/fail)
//  - valid sample missing a mandatory criterion -> NOT_YET (coaching, not punishment)
// Band-A readiness needs ALL 15 RS resolved READY/READY_NO_ERROR_OPPORTUNITY plus resolved P10 comprehension; there is no
// majority, weighted average, 3/5 rule or compensation across RS, and earlier history never replaces a missing P10 sample.
// None of this feeds core WPM or World progression (APP-READY-008).

export const READINESS_RULESET_ID = "BLOCKER4-BANDA-READINESS-V1.0";
export const RULESET_IS_CANONICAL = false;

export type RsKey = `RS${"01" | "02" | "03" | "04" | "05" | "06" | "07" | "08" | "09" | "10" | "11" | "12" | "13" | "14" | "15"}`;
export const RS_KEYS: readonly RsKey[] = Array.from({ length: 15 }, (_, i) => `RS${String(i + 1).padStart(2, "0")}` as RsKey);

export type ReadinessStatus = "READY" | "READY_NO_ERROR_OPPORTUNITY" | "REASSESS" | "NOT_YET";

/** Measures for one RS-P10 sample. Anything the capture layer could not establish is left undefined. */
export type P10Measures = {
  finalAccuracy?: number;
  firstPassAccuracy?: number;
  sequenceErrorsPer100?: number;
  sequenceErrors?: number;
  longestConsecutiveSkip?: number;
  functionWordAccuracy?: number;
  repeatedFunctionWordOmissionPattern?: boolean;
  taggedInflectedWords?: number;
  endingAccuracy?: number;
  taggedLongWords?: number;
  longWordFinalCorrectShare?: number;
  medianLongWordHesitationSec?: number;
  targetCausedFullRestarts?: number;
  longHesitationsPer100?: number;
  longHesitations?: number;
  unexplainedSilenceMaxSec?: number;
  eligibleErrors?: number;
  timelySelfCorrectedShare?: number;
  correctionTriggeredFullRestarts?: number;
  unnecessaryRepeatsPer100?: number;
  fullRestartsPer100?: number;
  fullRestarts?: number;
  sentenceBoundaryCompliance?: number;
  boundaryLinkedOmittedFirstWords?: number;
  internalPunctuationCompliance?: number;
  punctuationTriggeredRestarts?: number;
  paceSpread?: number;
  maxQuartileSlowdown?: number;
  taggedChallengeWords?: number;
  challengeRecoveredShare?: number;
  maxPostChallengeSequenceErrors?: number;
  middleThirdAccuracyDeltaPp?: number;
  middleThirdMultiWordSkips?: number;
  finalThirdAccuracyDeltaPp?: number;
  finalThirdWpmDropShare?: number;
};

export type P10Sample = {
  rs: RsKey;
  /** Must be the P10 sample; earlier history cannot stand in for it. */
  p: number;
  /** Sample validity under the oral-scoring semantics (recording usable, ASR resolved). */
  valid: boolean;
  measures: P10Measures;
};

type Criterion = {
  id: string;
  /** Measures that must be available for the criterion to be judged. */
  needs: (keyof P10Measures)[];
  /** Extra check that the evidence is sufficient (e.g. enough tagged words); failing it is REASSESS, not NOT_YET. */
  sufficient?: (m: P10Measures) => boolean;
  test: (m: P10Measures) => boolean;
  threshold: string;
  value: (m: P10Measures) => unknown;
};

type Rule = { rs: RsKey; name: string; specText: string; criteria: Criterion[] };

const num = (k: keyof P10Measures): ((m: P10Measures) => number) => (m) => m[k] as number;
const crit = (id: string, needs: (keyof P10Measures)[], test: (m: P10Measures) => boolean, threshold: string, extra: Partial<Criterion> = {}): Criterion => ({
  id, needs, test, threshold, value: (m) => (needs.length === 1 ? m[needs[0]] : Object.fromEntries(needs.map((k) => [k, m[k]]))), ...extra
});

export const READINESS_RULES: readonly Rule[] = Object.freeze([
  { rs: "RS01", name: "Word-recognition accuracy", specText: "At P10: final_accuracy ≥97% and first_pass_accuracy ≥95%. Before P10, use the passage-specific target; oral results coach rather than block during Sessions 1–100.", criteria: [
    crit("final_accuracy", ["finalAccuracy"], (m) => num("finalAccuracy")(m) >= 0.97, "≥ 0.97"),
    crit("first_pass_accuracy", ["firstPassAccuracy"], (m) => num("firstPassAccuracy")(m) >= 0.95, "≥ 0.95")] },
  { rs: "RS02", name: "Sequential place-keeping", specText: "At P10: ≤2 sequence errors per 100 assessable words and no skip of 2+ consecutive expected words.", criteria: [
    crit("sequence_errors_per_100", ["sequenceErrorsPer100"], (m) => num("sequenceErrorsPer100")(m) <= 2, "≤ 2"),
    crit("no_2plus_word_skip", ["longestConsecutiveSkip"], (m) => num("longestConsecutiveSkip")(m) < 2, "longest skip < 2")] },
  { rs: "RS03", name: "Function-word fidelity", specText: "At P10: function_word_accuracy ≥98% with zero repeated omission pattern for the same common function word.", criteria: [
    crit("function_word_accuracy", ["functionWordAccuracy"], (m) => num("functionWordAccuracy")(m) >= 0.98, "≥ 0.98"),
    crit("no_repeated_function_word_omission", ["repeatedFunctionWordOmissionPattern"], (m) => m.repeatedFunctionWordOmissionPattern === false, "no repeated pattern")] },
  { rs: "RS04", name: "Word-ending fidelity", specText: "At P10: ending_accuracy ≥95% across at least 8 tagged inflected words in the passage.", criteria: [
    crit("tagged_inflected_words", ["taggedInflectedWords"], () => true, "≥ 8 tagged", { sufficient: (m) => (m.taggedInflectedWords as number) >= 8 }),
    crit("ending_accuracy", ["endingAccuracy"], (m) => num("endingAccuracy")(m) >= 0.95, "≥ 0.95")] },
  { rs: "RS05", name: "Longer-word decoding", specText: "At P10: ≥90% of tagged longer words finally correct, with median target hesitation ≤3 s and no full-sentence restart caused by a target.", criteria: [
    crit("tagged_long_words", ["taggedLongWords"], () => true, "tagged targets assessable", { sufficient: (m) => (m.taggedLongWords as number) >= 10 }),
    crit("long_words_final_correct", ["longWordFinalCorrectShare"], (m) => num("longWordFinalCorrectShare")(m) >= 0.9, "≥ 0.90"),
    crit("median_target_hesitation", ["medianLongWordHesitationSec"], (m) => num("medianLongWordHesitationSec")(m) <= 3, "≤ 3 s"),
    crit("no_target_caused_restart", ["targetCausedFullRestarts"], (m) => num("targetCausedFullRestarts")(m) === 0, "0")] },
  { rs: "RS06", name: "Hesitation control", specText: "At P10: ≤3 >2-second hesitations per 100 assessable words and no unexplained silence >6 s.", criteria: [
    crit("long_hesitations_per_100", ["longHesitationsPer100"], (m) => num("longHesitationsPer100")(m) <= 3, "≤ 3"),
    crit("no_unexplained_silence", ["unexplainedSilenceMaxSec"], (m) => num("unexplainedSilenceMaxSec")(m) <= 6, "≤ 6 s")] },
  { rs: "RS07", name: "Efficient self-correction", specText: "At P10: if eligible errors occur, ≥80% are self-corrected within 3 s and ≤1 correction causes a full-sentence restart. If no eligible errors occur, mark skill success automatically.", criteria: [
    // evaluated specially: zero eligible errors -> READY_NO_ERROR_OPPORTUNITY
    crit("timely_self_correction", ["eligibleErrors", "timelySelfCorrectedShare"], (m) => (m.eligibleErrors as number) === 0 || num("timelySelfCorrectedShare")(m) >= 0.8, "≥ 0.80 of eligible errors"),
    crit("correction_restarts", ["correctionTriggeredFullRestarts"], (m) => num("correctionTriggeredFullRestarts")(m) <= 1, "≤ 1")] },
  { rs: "RS08", name: "Repetition and restart control", specText: "At P10: ≤2 unnecessary repeated-word/phrase events and ≤1 full restart per 100 words.", criteria: [
    crit("unnecessary_repeats", ["unnecessaryRepeatsPer100"], (m) => num("unnecessaryRepeatsPer100")(m) <= 2, "≤ 2"),
    crit("full_restarts_per_100", ["fullRestartsPer100"], (m) => num("fullRestartsPer100")(m) <= 1, "≤ 1")] },
  { rs: "RS09", name: "Sentence-boundary control", specText: "At P10: ≥85% sentence-boundary compliance and zero boundary-linked omitted first words.", criteria: [
    crit("sentence_boundary_compliance", ["sentenceBoundaryCompliance"], (m) => num("sentenceBoundaryCompliance")(m) >= 0.85, "≥ 0.85"),
    crit("no_boundary_linked_omissions", ["boundaryLinkedOmittedFirstWords"], (m) => num("boundaryLinkedOmittedFirstWords")(m) === 0, "0")] },
  { rs: "RS10", name: "Internal-punctuation control", specText: "At P10: ≥80% internal-punctuation compliance and zero punctuation-triggered full restarts.", criteria: [
    crit("internal_punctuation_compliance", ["internalPunctuationCompliance"], (m) => num("internalPunctuationCompliance")(m) >= 0.8, "≥ 0.80"),
    crit("no_punctuation_triggered_restarts", ["punctuationTriggeredRestarts"], (m) => num("punctuationTriggeredRestarts")(m) === 0, "0")] },
  { rs: "RS11", name: "Pace consistency", specText: "At P10: pace_spread ≤0.25 with no single quartile >35% slower than the learner's passage median. Absolute WPM is not compared with peers.", criteria: [
    crit("pace_spread", ["paceSpread"], (m) => num("paceSpread")(m) <= 0.25, "≤ 0.25"),
    crit("no_quartile_over_35pct_slower", ["maxQuartileSlowdown"], (m) => num("maxQuartileSlowdown")(m) <= 0.35, "≤ 0.35")] },
  { rs: "RS12", name: "Challenge-word recovery", specText: "At P10: ≥80% of tagged challenge words correct or self-corrected within 4 s, and ≤1 sequence error in the following five words.", criteria: [
    crit("tagged_challenge_words", ["taggedChallengeWords"], () => true, "≥ 1 tagged", { sufficient: (m) => (m.taggedChallengeWords as number) >= 1 }),
    crit("challenge_recovery", ["challengeRecoveredShare"], (m) => num("challengeRecoveredShare")(m) >= 0.8, "≥ 0.80"),
    crit("post_challenge_sequence_errors", ["maxPostChallengeSequenceErrors"], (m) => num("maxPostChallengeSequenceErrors")(m) <= 1, "≤ 1")] },
  { rs: "RS13", name: "Mid-passage attention stability", specText: "At P10: middle-third accuracy is within 2 percentage points of first-third accuracy, no 2+ word skip, and no unexplained silence >6 s.", criteria: [
    crit("middle_third_accuracy", ["middleThirdAccuracyDeltaPp"], (m) => Math.abs(num("middleThirdAccuracyDeltaPp")(m)) <= 2, "|Δ| ≤ 2 pp"),
    crit("no_2plus_word_skip_in_middle", ["middleThirdMultiWordSkips"], (m) => num("middleThirdMultiWordSkips")(m) === 0, "0"),
    crit("no_unexplained_silence", ["unexplainedSilenceMaxSec"], (m) => num("unexplainedSilenceMaxSec")(m) <= 6, "≤ 6 s")] },
  { rs: "RS14", name: "Final-third stamina", specText: "At P10: final-third accuracy within 2 percentage points of first third and final-third WPM no more than 15% below first third.", criteria: [
    crit("final_third_accuracy", ["finalThirdAccuracyDeltaPp"], (m) => Math.abs(num("finalThirdAccuracyDeltaPp")(m)) <= 2, "|Δ| ≤ 2 pp"),
    crit("final_third_wpm_drop", ["finalThirdWpmDropShare"], (m) => num("finalThirdWpmDropShare")(m) <= 0.15, "≤ 0.15")] },
  { rs: "RS15", name: "Integrated one-word fluency", specText: "At P10: final_accuracy ≥95%, sequence_errors ≤2, long hesitations ≤4, full restarts ≤1 and pace_spread ≤0.25. This is 100-word-band integration, not World 1→World 2 graduation.", criteria: [
    crit("final_accuracy", ["finalAccuracy"], (m) => num("finalAccuracy")(m) >= 0.95, "≥ 0.95"),
    crit("sequence_errors", ["sequenceErrors"], (m) => num("sequenceErrors")(m) <= 2, "≤ 2"),
    crit("long_hesitations", ["longHesitations"], (m) => num("longHesitations")(m) <= 4, "≤ 4"),
    crit("full_restarts", ["fullRestarts"], (m) => num("fullRestarts")(m) <= 1, "≤ 1"),
    crit("pace_spread", ["paceSpread"], (m) => num("paceSpread")(m) <= 0.25, "≤ 0.25")] }
] as Rule[]);

export type CriterionResult = { id: string; passed: boolean | null; value: unknown; threshold: string };
export type RsResult = {
  rs: RsKey;
  status: ReadinessStatus;
  rulesetId: string;
  criteria: CriterionResult[];
  failedCriteria: string[];
  /** Why the sample could not be judged (REASSESS only). */
  reassessReason: string | null;
};

const isNum = (v: unknown) => typeof v === "number" && Number.isFinite(v);

export function evaluateRs(sample: P10Sample | undefined, rs: RsKey): RsResult {
  const rule = READINESS_RULES.find((r) => r.rs === rs)!;
  const base = { rs, rulesetId: READINESS_RULESET_ID };
  const reassess = (reason: string, criteria: CriterionResult[] = []): RsResult => ({ ...base, status: "REASSESS", criteria, failedCriteria: [], reassessReason: reason });

  if (!sample) return reassess("NO_P10_SAMPLE");
  if (sample.rs !== rs) return reassess("SAMPLE_FOR_DIFFERENT_RS");
  if (sample.p !== 10) return reassess("NOT_A_P10_SAMPLE"); // earlier history cannot replace a missing P10 sample
  if (!sample.valid) return reassess("INVALID_SAMPLE");

  const m = sample.measures;
  const results: CriterionResult[] = [];
  for (const c of rule.criteria) {
    const missing = c.needs.filter((k) => (k === "repeatedFunctionWordOmissionPattern" ? typeof m[k] !== "boolean" : !isNum(m[k])));
    // RS07 with no eligible errors does not need a self-correction share
    const rs07NoErrors = rs === "RS07" && c.id === "timely_self_correction" && m.eligibleErrors === 0;
    if (missing.length && !(rs07NoErrors && missing.every((k) => k === "timelySelfCorrectedShare"))) return reassess(`INSUFFICIENT_EVIDENCE:${missing.join(",")}`, results);
    if (c.sufficient && !c.sufficient(m)) return reassess(`INSUFFICIENT_EVIDENCE:${c.id}`, results);
    results.push({ id: c.id, passed: c.sufficient ? null : c.test(m), value: c.value(m), threshold: c.threshold });
  }
  const failed = results.filter((r) => r.passed === false).map((r) => r.id);
  if (failed.length) return { ...base, status: "NOT_YET", criteria: results, failedCriteria: failed, reassessReason: null };
  const status: ReadinessStatus = rs === "RS07" && m.eligibleErrors === 0 ? "READY_NO_ERROR_OPPORTUNITY" : "READY";
  return { ...base, status, criteria: results, failedCriteria: [], reassessReason: null };
}

export type BandAReadiness = {
  rulesetId: string;
  vector: Record<RsKey, ReadinessStatus>;
  results: Record<RsKey, RsResult>;
  readyCount: number;
  /** Progress text may say "14/15 competencies ready"; it never decides advancement. */
  display: string;
  notYet: RsKey[];
  reassess: RsKey[];
  p10ComprehensionResolved: boolean;
  bandAReady: boolean;
};

/** The only aggregation: all 15 resolved ready AND P10 comprehension resolved. No majority, average or compensation. */
export function bandAReadiness(samples: readonly P10Sample[], p10ComprehensionResolved: boolean): BandAReadiness {
  const results = {} as Record<RsKey, RsResult>;
  for (const rs of RS_KEYS) results[rs] = evaluateRs(samples.filter((s) => s.rs === rs).sort((a, b) => b.p - a.p)[0], rs);
  const vector = Object.fromEntries(RS_KEYS.map((rs) => [rs, results[rs].status])) as Record<RsKey, ReadinessStatus>;
  const ready = (s: ReadinessStatus) => s === "READY" || s === "READY_NO_ERROR_OPPORTUNITY";
  const readyCount = RS_KEYS.filter((rs) => ready(vector[rs])).length;
  return {
    rulesetId: READINESS_RULESET_ID,
    vector,
    results,
    readyCount,
    display: `${readyCount}/15 competencies ready`,
    notYet: RS_KEYS.filter((rs) => vector[rs] === "NOT_YET"),
    reassess: RS_KEYS.filter((rs) => vector[rs] === "REASSESS"),
    p10ComprehensionResolved,
    bandAReady: readyCount === 15 && p10ComprehensionResolved
  };
}

/** Map a per-RS status onto the readiness-lifecycle attempt outcome (APP-READY-003). */
export function toAttemptOutcome(status: ReadinessStatus): "PASS" | "FAIL" | "INSUFFICIENT_EVIDENCE" {
  return status === "READY" || status === "READY_NO_ERROR_OPPORTUNITY" ? "PASS" : status === "NOT_YET" ? "FAIL" : "INSUFFICIENT_EVIDENCE";
}

/**
 * Measures the oral telemetry can establish today. Anything it does not capture (reorderings, silences, tagged-word
 * outcomes, quartile pace, thirds) is left undefined, so the rule returns REASSESS rather than an undercounted pass.
 */
export function measuresFromTelemetry(t: {
  expectedTokens: number; longHesitations: number; fullRestarts: number; repetitions: number;
  accuracy: { firstPass: { accuracy: number | null }; final: { accuracy: number | null } };
}): P10Measures {
  const per100 = (n: number) => (n * 100) / t.expectedTokens;
  const m: P10Measures = {};
  if (t.accuracy.final.accuracy !== null) m.finalAccuracy = t.accuracy.final.accuracy;
  if (t.accuracy.firstPass.accuracy !== null) m.firstPassAccuracy = t.accuracy.firstPass.accuracy;
  m.longHesitationsPer100 = per100(t.longHesitations);
  m.longHesitations = t.longHesitations;
  m.unnecessaryRepeatsPer100 = per100(t.repetitions);
  m.fullRestartsPer100 = per100(t.fullRestarts);
  m.fullRestarts = t.fullRestarts;
  return m;
}
