// SR-007 - Aggregate analytics for the 3-4 week post-launch calibration review. Informational only: it
// never changes a threshold; any change goes through explicit approval (see pilot-threshold.ts).

export type ScoreRow = { learnerId: string; passageId: string; rsId: string; score: number };
type Stat = { n: number; mean: number };

const mean = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / xs.length;
function median(xs: number[]) {
  const s = [...xs].sort((a, b) => a - b);
  const m = s.length >> 1;
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
}
function groupStats(rows: ScoreRow[], key: (r: ScoreRow) => string): Record<string, Stat> {
  const g: Record<string, number[]> = {};
  for (const r of rows) (g[key(r)] ??= []).push(r.score);
  return Object.fromEntries(Object.entries(g).map(([k, v]) => [k, { n: v.length, mean: mean(v) }]));
}

export function calibrationReport(rows: ScoreRow[], opts: { currentThreshold: number; effectiveDate: string }) {
  const scores = rows.map((r) => r.score);
  const empty = scores.length === 0;
  return {
    effectiveDate: opts.effectiveDate,
    cohortSize: new Set(rows.map((r) => r.learnerId)).size,
    attempts: rows.length,
    mean: empty ? null : mean(scores),
    distribution: empty ? { min: null, max: null, median: null } : { min: Math.min(...scores), max: Math.max(...scores), median: median(scores) },
    byPassage: groupStats(rows, (r) => r.passageId),
    byRs: groupStats(rows, (r) => r.rsId),
    passRateAtCurrent: empty ? null : scores.filter((s) => s >= opts.currentThreshold).length / scores.length,
    autoDeploy: false as const,
    requiresExplicitApproval: true as const
  };
}
