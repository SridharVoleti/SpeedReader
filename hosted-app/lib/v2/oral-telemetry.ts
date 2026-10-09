// APP-ORAL-001..009 - Oral-reading telemetry and first-150 competency history.
//
// Diagnostic/competency evidence only. Nothing here feeds core WPM or World progression (APP-READY-008,
// APP-NR-003); the module imports no progression code. It does NOT invent RS/P pass/fail thresholds:
// applying the supplied RS/P scoring rule is the job of the approved canonical scoring contract
// (APP-KM-004), which consumes the telemetry produced here.
//
// Scoring order (APP-ORAL-002): validate sample -> canonical tokens -> align -> classify
// substitution/omission/insertion/repetition -> accepted self-corrections -> first-pass/final accuracy ->
// time/WPM/hesitation/restart/punctuation/recovery -> (rule applied by the caller).
// Capture parameters are PROVISIONAL_PILOT configuration, never scattered constants.

import type { CountToken } from "../sr/pipeline-v2/count100";
import { RS_IDS, type RsId } from "../world1-framework";

export type OralConfig = {
  version: string;
  status: "PROVISIONAL_PILOT";
  /** Recognition confidence below this makes a word unassessable (never a child error). */
  minWordConfidence: number;
  /** A gap at least this long between spoken words is a long hesitation. */
  longHesitationMs: number;
  /** An insertion followed by the correct word within this window is an accepted self-correction. */
  selfCorrectionWindowMs: number;
  /** A pause at least this long after a punctuated token counts as honouring the punctuation. */
  punctuationPauseMs: number;
  /** Re-reading from token 1 after at least this many tokens of progress is a full restart. */
  restartMinProgressTokens: number;
  /** Final accuracy at or above this at P1 marks the learner baseline-strong (APP-ORAL-009). */
  strongBaselineAccuracy: number;
  /** A sample shorter than this, or with no speech, cannot be assessed. */
  minSampleMs: number;
};

export const ORAL_CONFIG_V1: OralConfig = Object.freeze({
  version: "oral-telemetry-2026-10-pilot-1",
  status: "PROVISIONAL_PILOT",
  minWordConfidence: 0.6,
  longHesitationMs: 2000,
  selfCorrectionWindowMs: 3000,
  punctuationPauseMs: 250,
  restartMinProgressTokens: 5,
  strongBaselineAccuracy: 0.95,
  minSampleMs: 2000
});

export type SpokenWord = { word: string; startMs: number; endMs: number; confidence: number | null };

export type SampleReport = { usable: boolean; speechDetected: boolean; durationMs: number };

export type OralOptions = {
  /** Expected tokens whose reading is a challenge/unfamiliar word (token index, 1-based). */
  challengeTokenIndexes?: readonly number[];
  /** Approved accepted pronunciation/spelling variants per normalized expected word (accent fairness). */
  acceptedVariants?: Readonly<Record<string, readonly string[]>>;
  config?: OralConfig;
};

export type PassAccuracy = { correct: number; assessable: number; accuracy: number | null };

export type OralTelemetry = {
  configVersion: string;
  tokenizerVersion: string;
  expectedTokens: number;
  alignedCorrect: number;
  substitutions: number;
  omissions: number;
  insertions: number;
  repetitions: number;
  acceptedSelfCorrections: number;
  selfCorrectionLatenciesMs: number[];
  longHesitations: number;
  fullRestarts: number;
  completionTimeMs: number;
  wpm: number | null;
  punctuation: { opportunities: number; honoured: number };
  challengeWords: { total: number; recovered: number };
  asr: { meanConfidence: number | null; uncertainWords: number; unassessedTokens: number };
  accuracy: { firstPass: PassAccuracy; final: PassAccuracy };
};

export type OralResult =
  | { status: "ASSESSED"; telemetry: OralTelemetry }
  | { status: "UNASSESSABLE"; reason: "SAMPLE_UNUSABLE" | "NO_SPEECH" | "SAMPLE_TOO_SHORT"; learnerError: false };

const norm = (w: string) => w.normalize("NFKC").toLowerCase().replace(/[‘’ʼ]/gu, "'").replace(/[^\p{L}\p{N}'-]/gu, "");

function editDistance(a: string, b: string): number {
  const d = Array.from({ length: a.length + 1 }, (_, i) => [i, ...new Array<number>(b.length).fill(0)]);
  for (let j = 1; j <= b.length; j += 1) d[0][j] = j;
  for (let i = 1; i <= a.length; i += 1) for (let j = 1; j <= b.length; j += 1) d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
  return d[a.length][b.length];
}

/** An inserted word counts as an attempt at the following target only when it is close to it (or a partial start of it). */
function isAttemptAt(inserted: string, target: string): boolean {
  if (inserted === target) return false;
  if (inserted.length >= 2 && target.startsWith(inserted)) return true;
  return editDistance(inserted, target) <= Math.max(1, Math.floor(target.length / 2) - 1);
}

type Op = "MATCH" | "UNASSESSED" | "SUB" | "OMIT" | "INS";
type Aligned = { op: Op; expectedIdx: number | null; spokenIdx: number | null };

/** Deterministic edit-distance alignment. Tie-break order: match, substitution, omission, insertion. */
function align(expected: readonly string[], variants: ReadonlyArray<ReadonlySet<string>>, spoken: readonly { w: string; uncertain: boolean }[]): Aligned[] {
  const n = expected.length;
  const m = spoken.length;
  const cost: number[][] = Array.from({ length: n + 1 }, () => new Array<number>(m + 1).fill(0));
  for (let i = 1; i <= n; i += 1) cost[i][0] = i;
  for (let j = 1; j <= m; j += 1) cost[0][j] = j;
  const isMatch = (i: number, j: number) => spoken[j].uncertain || spoken[j].w === expected[i] || variants[i].has(spoken[j].w);
  for (let i = 1; i <= n; i += 1) {
    for (let j = 1; j <= m; j += 1) {
      const diag = cost[i - 1][j - 1] + (isMatch(i - 1, j - 1) ? 0 : 1);
      cost[i][j] = Math.min(diag, cost[i - 1][j] + 1, cost[i][j - 1] + 1);
    }
  }
  const out: Aligned[] = [];
  let i = n;
  let j = m;
  while (i > 0 || j > 0) {
    if (i > 0 && j > 0) {
      const match = isMatch(i - 1, j - 1);
      if (cost[i][j] === cost[i - 1][j - 1] + (match ? 0 : 1)) {
        out.push({ op: match ? (spoken[j - 1].uncertain && spoken[j - 1].w !== expected[i - 1] ? "UNASSESSED" : "MATCH") : "SUB", expectedIdx: i - 1, spokenIdx: j - 1 });
        i -= 1; j -= 1;
        continue;
      }
    }
    if (i > 0 && cost[i][j] === cost[i - 1][j] + 1) {
      out.push({ op: "OMIT", expectedIdx: i - 1, spokenIdx: null });
      i -= 1;
    } else {
      out.push({ op: "INS", expectedIdx: null, spokenIdx: j - 1 });
      j -= 1;
    }
  }
  return out.reverse();
}

/** Split spoken words where the child starts the passage over after real progress (full restart). */
function splitAtRestarts(expected: readonly string[], spoken: readonly { w: string }[], minProgress: number): number[] {
  const starts = [0];
  if (expected.length < 2) return starts;
  let progressFrom = 0;
  for (let j = 1; j < spoken.length - 1; j += 1) {
    if (spoken[j].w === expected[0] && spoken[j + 1].w === expected[1] && j - progressFrom >= minProgress) {
      starts.push(j);
      progressFrom = j;
    }
  }
  return starts;
}

function tally(aligned: readonly Aligned[]) {
  const t = { match: 0, unassessed: 0, sub: 0, omit: 0, ins: 0 };
  for (const a of aligned) {
    if (a.op === "MATCH") t.match += 1;
    else if (a.op === "UNASSESSED") t.unassessed += 1;
    else if (a.op === "SUB") t.sub += 1;
    else if (a.op === "OMIT") t.omit += 1;
    else t.ins += 1;
  }
  return t;
}

export function captureOralTelemetry(
  tokens: readonly CountToken[],
  words: readonly SpokenWord[],
  sample: SampleReport,
  tokenizerVersion: string,
  options: OralOptions = {}
): OralResult {
  const cfg = options.config ?? ORAL_CONFIG_V1;
  // 1. sample validity comes first (APP-ORAL-003): an unusable recording is never a child error
  if (!sample.usable) return { status: "UNASSESSABLE", reason: "SAMPLE_UNUSABLE", learnerError: false };
  if (!sample.speechDetected || words.length === 0) return { status: "UNASSESSABLE", reason: "NO_SPEECH", learnerError: false };
  if (sample.durationMs < cfg.minSampleMs) return { status: "UNASSESSABLE", reason: "SAMPLE_TOO_SHORT", learnerError: false };

  // 2. canonical tokens (never re-tokenised here)
  const expected = tokens.map((t) => norm(t.text));
  const variants = expected.map((e) => new Set((options.acceptedVariants?.[e] ?? []).map(norm)));
  const spoken = words.map((w) => ({ ...w, w: norm(w.word), uncertain: w.confidence === null || w.confidence < cfg.minWordConfidence }));

  // 3-4. align per pass (restarts split the recording; unassessable audio never resegments the passage)
  const starts = splitAtRestarts(expected, spoken, cfg.restartMinProgressTokens);
  const passes = starts.map((s, k) => spoken.slice(s, k + 1 < starts.length ? starts[k + 1] : spoken.length));
  const alignedPasses = passes.map((p) => align(expected, variants, p));
  const first = alignedPasses[0];
  const last = alignedPasses[alignedPasses.length - 1];

  // 5. classify insertions of the first pass: repetition, accepted self-correction, or plain insertion
  const sp0 = passes[0];
  let repetitions = 0;
  let selfCorrections = 0;
  let insertions = 0;
  const latencies: number[] = [];
  const reclassifiedSpoken = new Set<number>(); // insertions that are not errors
  const selfCorrectedExpected = new Set<number>();
  first.forEach((a, idx) => {
    if (a.op !== "INS" || a.spokenIdx === null) return;
    const w = sp0[a.spokenIdx];
    const dupPrev = a.spokenIdx > 0 && sp0[a.spokenIdx - 1].w === w.w;
    const dupNext = a.spokenIdx + 1 < sp0.length && sp0[a.spokenIdx + 1].w === w.w;
    if (dupPrev || dupNext) {
      repetitions += 1;
      reclassifiedSpoken.add(a.spokenIdx);
      return;
    }
    const next = first[idx + 1];
    if (next && (next.op === "MATCH" || next.op === "UNASSESSED") && next.spokenIdx !== null && next.expectedIdx !== null) {
      const target = sp0[next.spokenIdx];
      const latency = target.startMs - w.startMs;
      if (!w.uncertain && latency >= 0 && latency <= cfg.selfCorrectionWindowMs && isAttemptAt(w.w, expected[next.expectedIdx])) {
        selfCorrections += 1;
        latencies.push(latency);
        reclassifiedSpoken.add(a.spokenIdx);
        selfCorrectedExpected.add(next.expectedIdx);
        return;
      }
    }
    insertions += 1;
  });

  const ft = tally(first);
  const lt = tally(last);
  const accuracyOf = (t: ReturnType<typeof tally>, extraCorrect: number): PassAccuracy => {
    const assessable = expected.length - t.unassessed;
    const correct = t.match + extraCorrect;
    return { correct, assessable, accuracy: assessable > 0 ? correct / assessable : null };
  };
  // first pass: a self-corrected token was first read wrongly; the final accuracy accepts the correction
  const firstPass = accuracyOf(ft, -selfCorrections);
  const final = alignedPasses.length > 1 ? accuracyOf(lt, 0) : accuracyOf(ft, 0);

  // 6. timing, hesitation, punctuation, challenge words
  const all = spoken;
  const completionTimeMs = Math.max(...all.map((w) => w.endMs)) - Math.min(...all.map((w) => w.startMs));
  let longHesitations = 0;
  for (let j = 1; j < all.length; j += 1) if (all[j].startMs - all[j - 1].endMs >= cfg.longHesitationMs) longHesitations += 1;

  let opportunities = 0;
  let honoured = 0;
  first.forEach((a) => {
    if (a.expectedIdx === null || a.spokenIdx === null || (a.op !== "MATCH" && a.op !== "UNASSESSED")) return;
    const tk = tokens[a.expectedIdx];
    if (!/[.,!?;:]$/.test(tk.text) && !tk.punctuationAfter.some((p) => /[.,!?;:]/.test(p))) return;
    const nextWord = sp0[a.spokenIdx + 1];
    if (!nextWord) return; // end of reading: no following pause to judge
    opportunities += 1;
    if (nextWord.startMs - sp0[a.spokenIdx].endMs >= cfg.punctuationPauseMs) honoured += 1;
  });

  const challenge = options.challengeTokenIndexes ?? [];
  const recoveredIdx = new Set<number>();
  for (const pass of alignedPasses) for (const a of pass) if ((a.op === "MATCH" || a.op === "UNASSESSED") && a.expectedIdx !== null) recoveredIdx.add(a.expectedIdx);
  for (const idx of selfCorrectedExpected) recoveredIdx.add(idx);
  const challengeRecovered = challenge.filter((t) => recoveredIdx.has(t - 1)).length;

  const confidences = spoken.filter((w) => w.confidence !== null).map((w) => w.confidence as number);

  return {
    status: "ASSESSED",
    telemetry: {
      configVersion: cfg.version,
      tokenizerVersion,
      expectedTokens: expected.length,
      alignedCorrect: ft.match,
      substitutions: ft.sub,
      omissions: ft.omit,
      insertions,
      repetitions,
      acceptedSelfCorrections: selfCorrections,
      selfCorrectionLatenciesMs: latencies,
      longHesitations,
      fullRestarts: starts.length - 1,
      completionTimeMs,
      wpm: completionTimeMs > 0 ? Math.round((expected.length / (completionTimeMs / 60_000)) * 10) / 10 : null,
      punctuation: { opportunities, honoured },
      challengeWords: { total: challenge.length, recovered: challengeRecovered },
      asr: { meanConfidence: confidences.length ? confidences.reduce((a, b) => a + b, 0) / confidences.length : null, uncertainWords: spoken.filter((w) => w.uncertain).length, unassessedTokens: ft.unassessed },
      accuracy: { firstPass, final }
    }
  };
}

// ---------------------------------------------------------------------------------------------------
// APP-ORAL-006..009 - personal same-RS history

export type OralHistoryEntry = {
  learnerId: string;
  rsId: RsId;
  /** P1..P10 within the RS. */
  p: number;
  /** Complete-round number (1 = the first pass through all 15 RS). */
  round: number;
  finalAccuracy: number | null;
  wpm: number | null;
};

export type OralHistory = readonly OralHistoryEntry[];

/** The RS-specific P1 baseline. Sessions 1-15 each establish the baseline of their own RS only. */
export function rsBaseline(history: OralHistory, learnerId: string, rsId: RsId): OralHistoryEntry | null {
  return history.filter((e) => e.learnerId === learnerId && e.rsId === rsId && e.p === 1).sort((a, b) => a.round - b.round)[0] ?? null;
}

export type RsProgress =
  | { state: "NO_BASELINE" }
  | { state: "BASELINE_ONLY"; baselineStrong: boolean }
  | { state: "COMPARED"; baselineStrong: boolean; accuracyDelta: number | null; wpmDelta: number | null; later: OralHistoryEntry };

/** Progress is `same learner + same RS + later P` against that RS's own baseline - never across RS. */
export function rsProgress(history: OralHistory, learnerId: string, rsId: RsId, config: OralConfig = ORAL_CONFIG_V1): RsProgress {
  const base = rsBaseline(history, learnerId, rsId);
  if (!base) return { state: "NO_BASELINE" };
  const baselineStrong = base.finalAccuracy !== null && base.finalAccuracy >= config.strongBaselineAccuracy;
  const later = history
    .filter((e) => e.learnerId === learnerId && e.rsId === rsId && (e.p > base.p || e.round > base.round))
    .sort((a, b) => b.round - a.round || b.p - a.p)[0];
  if (!later) return { state: "BASELINE_ONLY", baselineStrong };
  const delta = (a: number | null, b: number | null) => (a === null || b === null ? null : a - b);
  return { state: "COMPARED", baselineStrong, accuracyDelta: delta(later.finalAccuracy, base.finalAccuracy), wpmDelta: delta(later.wpm, base.wpm), later };
}

/** The 15 competency trajectories, kept separate (APP-ORAL-008). */
export function competencyTimelines(history: OralHistory, learnerId: string): Record<RsId, OralHistoryEntry[]> {
  const out = Object.fromEntries(RS_IDS.map((rs) => [rs, [] as OralHistoryEntry[]])) as Record<RsId, OralHistoryEntry[]>;
  for (const e of history.filter((h) => h.learnerId === learnerId).sort((a, b) => a.round - b.round || a.p - b.p)) out[e.rsId].push(e);
  return out;
}

/**
 * A composite exists only at a COMPLETE round boundary: every one of the 15 RS has an entry for that round.
 * It is the mean of each RS's own accuracy delta against its own baseline - raw unlike metrics are never averaged.
 */
export function roundComposite(history: OralHistory, learnerId: string, round: number): { round: number; meanAccuracyDelta: number | null; perRs: Record<RsId, number | null> } | null {
  const perRs = {} as Record<RsId, number | null>;
  for (const rs of RS_IDS) {
    const entry = history.find((e) => e.learnerId === learnerId && e.rsId === rs && e.round === round);
    if (!entry) return null;
    const base = rsBaseline(history, learnerId, rs);
    perRs[rs] = base && base.finalAccuracy !== null && entry.finalAccuracy !== null ? entry.finalAccuracy - base.finalAccuracy : null;
  }
  const deltas = Object.values(perRs).filter((d): d is number => d !== null);
  return { round, meanAccuracyDelta: deltas.length ? deltas.reduce((a, b) => a + b, 0) / deltas.length : null, perRs };
}

/**
 * APP-REPORT-004: a 15-RS composite for P level `p` exists only once EVERY RS has an entry at that same P level.
 * Mean of each RS's accuracy delta against its own baseline; unlike raw RS metrics are never averaged.
 */
export function pLevelComposite(history: OralHistory, learnerId: string, p: number): { p: number; meanAccuracyDelta: number | null; perRs: Record<RsId, number | null> } | null {
  const perRs = {} as Record<RsId, number | null>;
  for (const rs of RS_IDS) {
    const entry = history.filter((e) => e.learnerId === learnerId && e.rsId === rs && e.p === p).sort((a, b) => b.round - a.round)[0];
    if (!entry) return null;
    const base = rsBaseline(history, learnerId, rs);
    perRs[rs] = base && base.finalAccuracy !== null && entry.finalAccuracy !== null ? entry.finalAccuracy - base.finalAccuracy : null;
  }
  const deltas = Object.values(perRs).filter((d): d is number => d !== null);
  return { p, meanAccuracyDelta: deltas.length ? deltas.reduce((a, b) => a + b, 0) / deltas.length : null, perRs };
}
