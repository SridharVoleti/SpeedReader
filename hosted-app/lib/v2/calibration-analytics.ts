// APP-CAL-003/004 - post-launch calibration evidence. INFORMATIONAL ONLY.
//
// Aggregate cuts a calibration review needs: score distributions, cohort size, passage and RS/P splits, device and
// browser effects, ASR uncertainty, progression rate, time to Level Up, practice frequency, false-ready /
// false-not-ready indicators, stamina-transition outcomes and retention/engagement. Nothing here changes a
// threshold or any config: it returns a report; any change needs explicit approval, versioning and an effective date
// (threshold-lifecycle.ts). The report holds no learner identifiers.

import type { AttemptRecord } from "./attempt-record";
import type { LearnerAggregate } from "./learner-aggregate";
import { GREEN_THRESHOLD } from "./comprehension-threshold";
import { deriveDecisionLedger } from "./decision-ledger";
import type { RetentionRecord } from "./retention-check";
import type { ReadinessStream } from "./readiness-lifecycle";
import type { ClientClass } from "./client-class";

const mean = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null);
function quantile(xs: number[], q: number): number | null {
  if (!xs.length) return null;
  const s = [...xs].sort((a, b) => a - b);
  const pos = (s.length - 1) * q;
  const lo = Math.floor(pos);
  return s[lo] + (s[Math.ceil(pos)] - s[lo]) * (pos - lo);
}
const round = (n: number | null) => (n === null ? null : Math.round(n * 1000) / 1000);

type Group = { attempts: number; meanScore: number | null; greenShare: number | null };
function group(records: readonly AttemptRecord[]): Group {
  const scored = records.filter((r) => r.comprehensionScore !== null);
  return {
    attempts: records.length,
    meanScore: round(mean(scored.map((r) => r.comprehensionScore as number))),
    greenShare: scored.length ? round(scored.filter((r) => r.classification === "GREEN").length / scored.length) : null
  };
}
function groupBy(records: readonly AttemptRecord[], key: (r: AttemptRecord) => string | null): Record<string, Group> {
  const buckets = new Map<string, AttemptRecord[]>();
  for (const r of records) {
    const k = key(r);
    if (k === null) continue;
    buckets.set(k, [...(buckets.get(k) ?? []), r]);
  }
  return Object.fromEntries([...buckets.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([k, v]) => [k, group(v)]));
}

const DAY = 86_400_000;

type RetentionCuts = {
  learnersChecked: number;
  checks: number;
  rememberedShare: number | null;
  byCheckNumber: Record<string, { checks: number; rememberedShare: number | null; meanRecall: number | null }>;
  byDelayBucket: Record<string, { checks: number; rememberedShare: number | null }>;
  /** Mean (immediate score - delayed recall share): how much is forgotten between reading and the check. */
  meanDropFromImmediate: number | null;
};

function retentionCuts(learners: readonly LearnerAggregate[]): RetentionCuts {
  const logs = learners.map((l) => l.retentionLog ?? []);
  const all = logs.flat();
  const share = (rs: readonly RetentionRecord[]) => (rs.length ? round(rs.filter((r) => r.remembered).length / rs.length) : null);
  const bucket = <T>(key: (r: RetentionRecord) => string | null, f: (rs: RetentionRecord[]) => T): Record<string, T> => {
    const m = new Map<string, RetentionRecord[]>();
    for (const r of all) { const k = key(r); if (k !== null) m.set(k, [...(m.get(k) ?? []), r]); }
    return Object.fromEntries([...m.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([k, v]) => [k, f(v)]));
  };
  const drops = all.filter((r) => r.immediateScore !== null).map((r) => (r.immediateScore as number) - r.correct / r.total);
  return {
    learnersChecked: logs.filter((l) => l.length > 0).length,
    checks: all.length,
    rememberedShare: share(all),
    byCheckNumber: bucket((r) => String(r.checkNumber), (rs) => ({ checks: rs.length, rememberedShare: share(rs), meanRecall: round(mean(rs.map((r) => r.correct / r.total))) })),
    byDelayBucket: bucket((r) => r.delayBucket, (rs) => ({ checks: rs.length, rememberedShare: share(rs) })),
    meanDropFromImmediate: round(mean(drops))
  };
}

export type CalibrationAnalytics = {
  informationalOnly: true;
  /** The frozen product threshold in force when the report was produced (never a tunable here). */
  greenThreshold: number;
  cohort: { learners: number; attempts: number; scoredAttempts: number };
  scoreDistribution: { min: number | null; p25: number | null; median: number | null; p75: number | null; max: number | null; mean: number | null; atOrAboveGreen: number | null };
  byPassage: Record<string, Group>;
  byRsAndP: Record<string, Group>;
  byDeviceBrowser: Record<string, Group>;
  asrUncertainty: { attempts: number; technicalShare: number | null; byReason: Record<string, number> };
  progression: { levelUps: number; holds: number; deferredByLengthStep: number; levelUpsPerLearner: number | null };
  timeToLevelUp: { samples: number; medianAttempts: number | null; medianDays: number | null };
  practice: { practiceEvents: number; per100NewPassages: number | null };
  staminaTransitions: { transitions: number; greenShareAtFirstLongerPassage: number | null; greenShareElsewhere: number | null };
  readiness: { streams: number; confirmed: number; falseReadyIndicators: number; falseNotReadyIndicators: number };
  retention: RetentionCuts;
  engagement: { learnersActive: number; medianActiveDays: number | null; returnedAfterGapShare: number | null };
};

export type AnalyticsInput = {
  learners: readonly LearnerAggregate[];
  /** Coarse client class per attempt id (stored on the attempt record when captured). */
  readiness?: readonly ReadinessStream[];
  /** Gap (days) that counts as having left and returned. */
  returnGapDays?: number;
};

export function calibrationAnalytics(input: AnalyticsInput): CalibrationAnalytics {
  const { learners } = input;
  const records = learners.flatMap((l) => l.ledger.filter((r) => r.attemptType === "NEW_PROGRESSION"));
  const scored = records.filter((r) => r.comprehensionScore !== null);
  const scores = scored.map((r) => r.comprehensionScore as number);

  const clientOf = (r: AttemptRecord): ClientClass | null => (r as AttemptRecord & { client?: ClientClass | null }).client ?? null;

  // decisions, time to Level Up
  let levelUps = 0, holds = 0, deferred = 0;
  const attemptsBetween: number[] = [];
  const daysBetween: number[] = [];
  for (const l of learners) {
    const decisions = deriveDecisionLedger(l.ledger, l.baselineWpm);
    let anchor = l.ledger[0]?.completedAt ?? null;
    let count = 0;
    const byId = new Map(l.ledger.map((r) => [r.attemptId, r]));
    for (const r of l.ledger) {
      if (r.classification !== null) count += 1;
      const d = decisions.find((x) => x.decisionId === `DEC-${r.attemptId}`);
      if (!d) continue;
      if (d.decisionType === "HOLD") holds += 1;
      if (d.decisionType === "LEVEL_UP_DEFERRED") deferred += 1;
      if (d.decisionType === "LEVEL_UP") {
        levelUps += 1;
        attemptsBetween.push(count);
        if (anchor) daysBetween.push((Date.parse(byId.get(r.attemptId)!.completedAt) - Date.parse(anchor)) / DAY);
        anchor = r.completedAt;
        count = 0;
      }
    }
  }

  // stamina transitions: first passage whose length is longer than the previous one
  let transitions = 0;
  const atTransition: AttemptRecord[] = [];
  const elsewhere: AttemptRecord[] = [];
  for (const l of learners) {
    const ordered = l.ledger.filter((r) => r.attemptType === "NEW_PROGRESSION" && r.classification !== null);
    ordered.forEach((r, i) => {
      if (i > 0 && r.passageWords > ordered[i - 1].passageWords) { transitions += 1; atTransition.push(r); } else elsewhere.push(r);
    });
  }
  const greenShare = (rs: AttemptRecord[]) => (rs.length ? round(rs.filter((r) => r.classification === "GREEN").length / rs.length) : null);

  // readiness indicators (informational): confirmed then failed on revalidation; failed then passed first time in the new cycle
  const streams = input.readiness ?? [];
  let falseReady = 0, falseNotReady = 0;
  for (const s of streams) {
    const h = s.history;
    h.forEach((a, i) => {
      if (a.role === "REVALIDATION" && a.outcome === "FAIL" && h.slice(0, i).some((p) => p.outcome === "PASS" && (p.role === "CONFIRMATION" || p.role === "NEW_CYCLE_CONFIRMATION"))) falseReady += 1;
      if (a.role === "NEW_CYCLE_PRIMARY" && a.outcome === "PASS") {
        const prior = h.slice(0, i).filter((p) => p.outcome === "FAIL" || p.outcome === "PASS");
        if (prior.length && prior[prior.length - 1].outcome === "FAIL") falseNotReady += 1;
      }
    });
  }

  // engagement
  const activeDays = learners.map((l) => new Set(l.ledger.map((r) => r.completedAt.slice(0, 10))).size).filter((n) => n > 0);
  const gap = (input.returnGapDays ?? 7) * DAY;
  const returned = learners.filter((l) => {
    const t = l.ledger.map((r) => Date.parse(r.completedAt)).sort((a, b) => a - b);
    return t.some((x, i) => i > 0 && x - t[i - 1] >= gap);
  }).length;
  const practiceEvents = learners.reduce((n, l) => n + (l.practiceLog?.length ?? 0), 0);
  const technical = records.filter((r) => r.technicalState !== "CLEAR");
  const reasons: Record<string, number> = {};
  for (const r of technical) { const k = r.spokenReason ?? r.technicalState; reasons[k] = (reasons[k] ?? 0) + 1; }

  return {
    informationalOnly: true,
    greenThreshold: GREEN_THRESHOLD,
    cohort: { learners: learners.length, attempts: records.length, scoredAttempts: scored.length },
    scoreDistribution: {
      min: round(scores.length ? Math.min(...scores) : null), p25: round(quantile(scores, 0.25)), median: round(quantile(scores, 0.5)), p75: round(quantile(scores, 0.75)),
      max: round(scores.length ? Math.max(...scores) : null), mean: round(mean(scores)),
      atOrAboveGreen: scores.length ? round(scores.filter((s) => s >= GREEN_THRESHOLD).length / scores.length) : null
    },
    byPassage: groupBy(records, (r) => r.passageId),
    byRsAndP: groupBy(records, (r) => (r.registry ? `${r.registry.rsId}-P${r.registry.p}` : null)),
    byDeviceBrowser: groupBy(records, (r) => { const c = clientOf(r); return c ? `${c.device}/${c.browser}` : null; }),
    asrUncertainty: { attempts: technical.length, technicalShare: records.length ? round(technical.length / records.length) : null, byReason: reasons },
    progression: { levelUps, holds, deferredByLengthStep: deferred, levelUpsPerLearner: learners.length ? round(levelUps / learners.length) : null },
    timeToLevelUp: { samples: attemptsBetween.length, medianAttempts: round(quantile(attemptsBetween, 0.5)), medianDays: round(quantile(daysBetween, 0.5)) },
    practice: { practiceEvents, per100NewPassages: scored.length ? round((practiceEvents / scored.length) * 100) : null },
    staminaTransitions: { transitions, greenShareAtFirstLongerPassage: greenShare(atTransition), greenShareElsewhere: greenShare(elsewhere) },
    readiness: { streams: streams.length, confirmed: streams.filter((s) => s.phase === "CONFIRMED").length, falseReadyIndicators: falseReady, falseNotReadyIndicators: falseNotReady },
    retention: retentionCuts(learners),
    engagement: { learnersActive: activeDays.length, medianActiveDays: round(quantile(activeDays, 0.5)), returnedAfterGapShare: learners.length ? round(returned / learners.length) : null }
  };
}
