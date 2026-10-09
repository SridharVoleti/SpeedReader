// APP-KM-004 / APP-ORAL-002 - the P10 measure-capture layer.
//
// Turns one oral reading (alignment trace from oral-telemetry.ts) plus the passage's writer tags into the P10Measures the
// readiness rules consume (p10-readiness.ts). It decides nothing: thresholds stay in the rule table. Metric definitions are
// the repo's own "Oral metric definitions used by RS01-RS15" (pipeline/wip/SpeedReader_W1_BandA_Spec_v0.25.md); the few
// numeric windows those definitions state (pause bands, 3 s / 4 s repair windows, five following words) live in
// P10_CAPTURE_V1 as PROVISIONAL_PILOT configuration.
//
// Missing evidence is left undefined, never zero: no tags for a rule -> no measure -> that RS is REASSESS. Tags are
// 1-based expected_token_index values from the approved passage package (the app never invents them).

import type { CountToken } from "../sr/pipeline-v2/count100";
import { captureOralDetailed, type Aligned, type OralDetailed, type OralOptions, type OralTrace, type SampleReport, type SpokenWord } from "./oral-telemetry";
import type { P10Measures, P10Sample, RsKey } from "./p10-readiness";

export type P10CaptureConfig = {
  version: string;
  status: "PROVISIONAL_PILOT";
  /** RS07: a repair counts as timely within this long of the misread. */
  selfCorrectionWindowMs: number;
  /** RS12: a challenge word counts as recovered if corrected within this long. */
  challengeRecoveryMs: number;
  /** RS12: how many following words are checked for sequence errors. */
  postChallengeWords: number;
  /** RS09: sentence-boundary pause band (terminal . ! ?). */
  sentencePauseMs: readonly [number, number];
  /** RS10: internal-punctuation pause band (, ; :). */
  internalPauseMs: readonly [number, number];
  /** RS06/RS15: a silent gap longer than this is a long hesitation. */
  longHesitationMs: number;
};

export const P10_CAPTURE_V1: P10CaptureConfig = Object.freeze({
  version: "p10-capture-2026-10-pilot-1",
  status: "PROVISIONAL_PILOT",
  selfCorrectionWindowMs: 3000,
  challengeRecoveryMs: 4000,
  postChallengeWords: 5,
  sentencePauseMs: Object.freeze([150, 1800] as const),
  internalPauseMs: Object.freeze([80, 900] as const),
  longHesitationMs: 2000
});

/** Writer tags for the passage (1-based expected_token_index). Absent tag set -> the rules that need it cannot be judged. */
export type P10Tags = {
  functionWords?: readonly number[];
  inflected?: readonly number[];
  longWords?: readonly number[];
  challenge?: readonly number[];
};

const norm = (w: string) => w.normalize("NFKC").toLowerCase().replace(/[‘’ʼ]/gu, "'").replace(/[^\p{L}\p{N}'-]/gu, "");
const marksOf = (t: CountToken) => `${t.text}${t.punctuationAfter.join("")}`.replace(/[^.,!?;:]/g, "");
const isTerminal = (t: CountToken) => /[.!?]$/.test(marksOf(t));
const isInternal = (t: CountToken) => /[,;:]$/.test(marksOf(t));
const isPunctuated = (t: CountToken) => marksOf(t).length > 0;
const median = (xs: number[]) => {
  if (!xs.length) return null;
  const s = [...xs].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
};

type Timed = { expectedIdx: number; startMs: number; endMs: number };

/** Final reading of each expected token: the last pass's aligned word (MATCH or SUB), with its timing. */
function finalReading(trace: OralTrace) {
  const last = trace.passes[trace.passes.length - 1];
  const byIdx = new Map<number, { op: Aligned["op"]; timed: Timed | null }>();
  for (const a of last.aligned) {
    if (a.expectedIdx === null) continue;
    const w = a.spokenIdx !== null ? last.spoken[a.spokenIdx] : null;
    byIdx.set(a.expectedIdx, { op: a.op, timed: w ? { expectedIdx: a.expectedIdx, startMs: w.startMs, endMs: w.endMs } : null });
  }
  return byIdx;
}

/** Words per minute over a run of tokens, excluding pauses that follow punctuation. */
function wpmOf(idxs: readonly number[], reading: ReturnType<typeof finalReading>, tokens: readonly CountToken[]): number | null {
  const timed = idxs.map((i) => reading.get(i)?.timed).filter((t): t is Timed => !!t);
  if (timed.length < 2) return null;
  let ms = timed[timed.length - 1].endMs - timed[0].startMs;
  for (let k = 1; k < timed.length; k += 1) if (isPunctuated(tokens[timed[k - 1].expectedIdx])) ms -= Math.max(0, timed[k].startMs - timed[k - 1].endMs);
  return ms > 0 ? (timed.length / ms) * 60_000 : null;
}

export type P10Capture = { configVersion: string; measures: P10Measures };

export function captureP10Measures(trace: OralTrace, telemetry: { expectedTokens: number; acceptedSelfCorrections: number }, tags: P10Tags = {}, cfg: P10CaptureConfig = P10_CAPTURE_V1): P10Capture {
  const tokens = trace.tokens;
  const n = tokens.length;
  const m: P10Measures = {};
  const first = trace.passes[0];
  const reading = finalReading(trace);
  const reclassified = new Set(trace.reclassifiedSpoken);

  const unassessed = (i: number) => reading.get(i)?.op === "UNASSESSED";
  const assessableIdx = Array.from({ length: n }, (_, i) => i).filter((i) => !unassessed(i));
  const finalCorrect = (i: number) => reading.get(i)?.op === "MATCH";
  const firstAt = new Map<number, Aligned>();
  // An aborted first pass (restart) says nothing about the tokens it never reached: those are not omissions.
  const firstEnd = trace.passes.length > 1
    ? Math.max(-1, ...first.aligned.filter((a) => a.expectedIdx !== null && a.op !== "OMIT").map((a) => a.expectedIdx as number))
    : n - 1;
  for (const a of first.aligned) if (a.expectedIdx !== null && a.expectedIdx <= firstEnd) firstAt.set(a.expectedIdx, a);
  const assessable = assessableIdx.length;
  if (!assessable) return { configVersion: cfg.version, measures: m };

  // ---- accuracy ----
  m.finalAccuracy = assessableIdx.filter(finalCorrect).length / assessable;
  const selfCorrected = new Set(trace.selfCorrections.map((s) => s.expectedIdx));
  m.firstPassAccuracy = assessableIdx.filter((i) => (i > firstEnd ? finalCorrect(i) : firstAt.get(i)?.op === "MATCH" && !selfCorrected.has(i))).length / assessable;

  // ---- sequence: omissions + insertions + reorderings (first pass), longest consecutive skip ----
  const transposed = new Set<number>();
  for (let i = 0; i + 1 < n; i += 1) {
    const a = firstAt.get(i), b = firstAt.get(i + 1);
    if (a?.op === "SUB" && b?.op === "SUB" && a.spokenIdx !== null && b.spokenIdx !== null && b.spokenIdx === a.spokenIdx + 1 &&
      first.spoken[a.spokenIdx].w === norm(tokens[i + 1].text) && first.spoken[b.spokenIdx].w === norm(tokens[i].text)) { transposed.add(i); transposed.add(i + 1); i += 1; }
  }
  const omitted = (i: number) => firstAt.get(i)?.op === "OMIT";
  const insertionsAt = (lo: number, hi: number) => first.aligned.filter((a, k) => {
    if (a.op !== "INS" || a.spokenIdx === null || reclassified.has(a.spokenIdx)) return false;
    const before = first.aligned.slice(0, k).reverse().find((x) => x.expectedIdx !== null)?.expectedIdx ?? -1;
    return before + 1 >= lo && before + 1 <= hi;
  }).length;
  const seqErrorsIn = (lo: number, hi: number) => {
    let c = insertionsAt(lo, hi);
    for (let i = lo; i <= hi && i < n; i += 1) { if (omitted(i)) c += 1; if (transposed.has(i) && !transposed.has(i - 1)) c += 1; }
    return c;
  };
  const sequenceErrors = seqErrorsIn(0, n - 1);
  m.sequenceErrors = sequenceErrors;
  m.sequenceErrorsPer100 = (sequenceErrors * 100) / assessable;
  const skipRuns = (lo: number, hi: number) => { let run = 0, longest = 0; for (let i = lo; i <= hi && i < n; i += 1) { run = omitted(i) ? run + 1 : 0; longest = Math.max(longest, run); } return longest; };
  m.longestConsecutiveSkip = skipRuns(0, n - 1);

  // ---- tag-driven accuracy: function words (RS03), inflected endings (RS04), longer words (RS05) ----
  const tagged = (t?: readonly number[]) => (t ? [...new Set(t)].map((x) => x - 1).filter((i) => i >= 0 && i < n && !unassessed(i)) : null);
  const fw = tagged(tags.functionWords);
  if (fw && fw.length) {
    m.functionWordAccuracy = fw.filter(finalCorrect).length / fw.length;
    const omittedWords = fw.filter(omitted).map((i) => norm(tokens[i].text));
    m.repeatedFunctionWordOmissionPattern = omittedWords.some((w, k) => omittedWords.indexOf(w) !== k);
  }
  const infl = tagged(tags.inflected);
  if (infl) { m.taggedInflectedWords = infl.length; if (infl.length) m.endingAccuracy = infl.filter(finalCorrect).length / infl.length; }

  // ---- restarts: where each earlier pass stopped ----
  const stops = trace.passes.slice(0, -1).map((p) => {
    const idxs = p.aligned.filter((a) => a.expectedIdx !== null && a.op !== "OMIT").map((a) => a.expectedIdx as number);
    const stop = idxs.length ? Math.max(...idxs) : 0;
    const tail = p.aligned.filter((a) => a.expectedIdx === null || a.expectedIdx <= stop).slice(-3);
    return { stop, errored: tail.some((a) => a.op !== "MATCH" && a.op !== "UNASSESSED") };
  });
  const longSet = new Set(tagged(tags.longWords) ?? []);
  const challengeSet = new Set(tagged(tags.challenge) ?? []);
  const lw = tagged(tags.longWords);
  if (lw) {
    m.taggedLongWords = lw.length;
    if (lw.length) {
      m.longWordFinalCorrectShare = lw.filter(finalCorrect).length / lw.length;
      // hesitation = target appearance (previous word completed) -> target completed
      const hes: number[] = [];
      for (const i of lw) {
        const a = firstAt.get(i);
        if (!a || a.spokenIdx === null || (a.op !== "MATCH" && a.op !== "SUB")) continue;
        const w = first.spoken[a.spokenIdx];
        const prev = a.spokenIdx > 0 ? first.spoken[a.spokenIdx - 1].endMs : w.startMs;
        hes.push((w.endMs - prev) / 1000);
      }
      const md = median(hes);
      if (md !== null) m.medianLongWordHesitationSec = md;
      m.targetCausedFullRestarts = stops.filter((s) => longSet.has(s.stop) || longSet.has(s.stop + 1)).length;
    }
  }

  // ---- hesitation and silence (non-punctuation gaps; ASR-uncertain neighbours excluded) ----
  let longHes = 0;
  let maxUnexplained = 0;
  for (const p of trace.passes) {
    const exp = new Map<number, number>(); // spoken idx -> expected idx
    for (const a of p.aligned) if (a.spokenIdx !== null && a.expectedIdx !== null) exp.set(a.spokenIdx, a.expectedIdx);
    for (let j = 1; j < p.spoken.length; j += 1) {
      const a = p.spoken[j - 1], b = p.spoken[j];
      if (a.uncertain || b.uncertain) continue;
      const gap = b.startMs - a.endMs;
      const prevTok = exp.has(j - 1) ? tokens[exp.get(j - 1) as number] : null;
      if (prevTok && isPunctuated(prevTok)) continue;
      if (gap > cfg.longHesitationMs) longHes += 1;
      const nextIdx = exp.get(j);
      const explained = nextIdx !== undefined && (longSet.has(nextIdx) || challengeSet.has(nextIdx));
      if (!explained) maxUnexplained = Math.max(maxUnexplained, gap / 1000);
    }
  }
  m.longHesitations = longHes;
  m.longHesitationsPer100 = (longHes * 100) / assessable;
  m.unexplainedSilenceMaxSec = maxUnexplained;

  // ---- self-correction (RS07) ----
  const subs = [...firstAt.values()].filter((a) => a.op === "SUB" && a.expectedIdx !== null && !transposed.has(a.expectedIdx)).length;
  const timely = trace.selfCorrections.filter((s) => s.latencyMs <= cfg.selfCorrectionWindowMs).length;
  const eligible = subs + trace.selfCorrections.length;
  m.eligibleErrors = eligible;
  if (eligible > 0) m.timelySelfCorrectedShare = timely / eligible;
  m.correctionTriggeredFullRestarts = stops.filter((s) => s.errored).length;

  // ---- repetition and restarts (RS08) ----
  m.unnecessaryRepeatsPer100 = (reclassified.size - trace.selfCorrections.length) * 100 / assessable;
  m.fullRestarts = stops.length;
  m.fullRestartsPer100 = (stops.length * 100) / assessable;

  // ---- punctuation (RS09, RS10) ----
  let sOpp = 0, sOk = 0, iOpp = 0, iOk = 0, boundaryOmits = 0;
  first.aligned.forEach((a) => {
    if (a.expectedIdx === null || a.spokenIdx === null || (a.op !== "MATCH" && a.op !== "UNASSESSED")) return;
    const tk = tokens[a.expectedIdx];
    const next = first.spoken[a.spokenIdx + 1];
    if (!next || (!isTerminal(tk) && !isInternal(tk))) return;
    const gap = next.startMs - first.spoken[a.spokenIdx].endMs;
    const [lo, hi] = isTerminal(tk) ? cfg.sentencePauseMs : cfg.internalPauseMs;
    if (isTerminal(tk)) { sOpp += 1; if (gap >= lo && gap <= hi) sOk += 1; } else { iOpp += 1; if (gap >= lo && gap <= hi) iOk += 1; }
  });
  for (let i = 1; i < n; i += 1) if (omitted(i) && isTerminal(tokens[i - 1])) boundaryOmits += 1;
  if (sOpp) m.sentenceBoundaryCompliance = sOk / sOpp;
  m.boundaryLinkedOmittedFirstWords = boundaryOmits;
  if (iOpp) m.internalPunctuationCompliance = iOk / iOpp;
  m.punctuationTriggeredRestarts = stops.filter((s) => isPunctuated(tokens[s.stop])).length;

  // ---- pace (RS11): four equal assessable-word quartiles of the final reading ----
  const q = (k: number) => assessableIdx.slice(Math.floor((assessable * k) / 4), Math.floor((assessable * (k + 1)) / 4));
  const quartileWpm = [0, 1, 2, 3].map((k) => wpmOf(q(k), reading, tokens));
  if (quartileWpm.every((x): x is number => x !== null)) {
    const med = median(quartileWpm) as number;
    m.paceSpread = (Math.max(...quartileWpm) - Math.min(...quartileWpm)) / med;
    m.maxQuartileSlowdown = Math.max(0, ...quartileWpm.map((x) => (med - x) / med));
  }

  // ---- thirds (RS13, RS14) ----
  const third = (k: number) => assessableIdx.slice(Math.floor((assessable * k) / 3), Math.floor((assessable * (k + 1)) / 3));
  const acc = (idxs: number[]) => (idxs.length ? idxs.filter(finalCorrect).length / idxs.length : null);
  const [t1, t2, t3] = [third(0), third(1), third(2)];
  const a1 = acc(t1), a2 = acc(t2), a3 = acc(t3);
  if (a1 !== null && a2 !== null) m.middleThirdAccuracyDeltaPp = (a2 - a1) * 100;
  if (a1 !== null && a3 !== null) m.finalThirdAccuracyDeltaPp = (a3 - a1) * 100;
  if (t2.length) m.middleThirdMultiWordSkips = skipRunsIn(t2, omitted);
  const w1 = wpmOf(t1, reading, tokens), w3 = wpmOf(t3, reading, tokens);
  if (w1 !== null && w3 !== null) m.finalThirdWpmDropShare = (w1 - w3) / w1;

  // ---- challenge words (RS12) ----
  const ch = tagged(tags.challenge);
  if (ch) {
    m.taggedChallengeWords = ch.length;
    if (ch.length) {
      const recovered = ch.filter((i) => (firstAt.get(i)?.op === "MATCH" && !selfCorrected.has(i)) || trace.selfCorrections.some((s) => s.expectedIdx === i && s.latencyMs <= cfg.challengeRecoveryMs)).length;
      m.challengeRecoveredShare = recovered / ch.length;
      m.maxPostChallengeSequenceErrors = Math.max(...ch.map((i) => seqErrorsIn(i + 1, i + cfg.postChallengeWords)));
    }
  }

  void telemetry;
  return { configVersion: cfg.version, measures: m };
}

/** Longest run of consecutive omitted tokens within a set of (ascending) token indexes. */
function skipRunsIn(idxs: readonly number[], omitted: (i: number) => boolean): number {
  let run = 0, longest = 0, prev = -2;
  for (const i of idxs) { run = omitted(i) ? (i === prev + 1 ? run + 1 : 1) : 0; prev = i; longest = Math.max(longest, run); }
  return longest;
}

/** Oral reading -> the P10 sample the readiness rules judge. An unassessable recording is an invalid sample (REASSESS), never a child error. */
export function p10SampleFromOral(
  rs: RsKey,
  tokens: readonly CountToken[],
  words: readonly SpokenWord[],
  sample: SampleReport,
  tokenizerVersion: string,
  tags: P10Tags = {},
  options: OralOptions = {}
): { sample: P10Sample; captureVersion: string; oral: OralDetailed } {
  const oral = captureOralDetailed(tokens, words, sample, tokenizerVersion, { ...options, challengeTokenIndexes: options.challengeTokenIndexes ?? tags.challenge });
  if (oral.status !== "ASSESSED") return { sample: { rs, p: 10, valid: false, measures: {} }, captureVersion: P10_CAPTURE_V1.version, oral };
  const cap = captureP10Measures(oral.trace, oral.telemetry, tags);
  return { sample: { rs, p: 10, valid: true, measures: cap.measures }, captureVersion: cap.configVersion, oral };
}
