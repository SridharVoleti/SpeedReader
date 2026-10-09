// APP-REPORT-001..004 - Parent / progress report.
//
// Personal progress only: starting and current WPM, Level Ups, canonical passage/stamina progress, the
// learner's own trend, per-RS competency timelines, readiness/practice status in parent-appropriate language,
// and News Reader improvement kept separate. No peer rank/percentile/age-group figures exist in the shape, and a
// 15-RS composite appears only once every RS has reached the same P level. Internal state names (GREEN,
// NOT_GREEN, PASS/FAIL) are never used in the copy.

import type { LearnerAggregate } from "./learner-aggregate";
import { deriveDecisionLedger } from "./decision-ledger";
import { personalImprovement, assertPersonalOnly, type PersonalImprovement } from "./personal-trajectory";
import { competencyTimelines, pLevelComposite, rsProgress, type OralHistory, type OralHistoryEntry } from "./oral-telemetry";
import { RS_IDS, type RsId } from "../world1-framework";
import type { ReadinessPhase, ReadinessStream } from "./readiness-lifecycle";
import { twoReadCoaching } from "./news-reader-coaching";
import { passageWords, WORLD1_LAST_PASSAGE } from "./stamina";
import { learnerLanguageViolations } from "./learner-language";
import { retentionSummary } from "./retention-check";

export const READINESS_PARENT_COPY: Readonly<Record<ReadinessPhase, string>> = Object.freeze({
  PRIMARY_DUE: "A reading check-in is coming up.",
  CONFIRMATION_DUE: "One more check-in will confirm this skill.",
  CONFIRMED: "This skill has been confirmed.",
  REMEDIATION_REQUIRED: "Some extra practice is planned before the next check-in.",
  NEW_CYCLE_PRIMARY_DUE: "A fresh check-in is coming up after practice.",
  NEW_CYCLE_CONFIRMATION_DUE: "One more check-in will confirm this skill.",
  REVALIDATION_DUE: "A short refresher check-in is due to keep this skill current.",
  NEW_CYCLE_REQUIRED_VERSION_INVALIDATED: "The reading checks were updated, so a fresh set of check-ins is planned."
});

export const PRACTICE_PARENT_COPY = "Your child is enjoying familiar stories to build confidence at their current speed.";
export const COMPOSITE_PENDING_COPY = "An overall picture appears once all 15 reading skills have reached the same level.";

export type ParentReport = {
  learnerId: string;
  personal: { startingWpm: number; currentWpm: number; levelUps: number; trend: PersonalImprovement };
  canonicalProgress: { completedPassages: number; ofPassages: number; nextPassageWords: number | null; worldComplete: boolean };
  practice: { status: string | null };
  competencies: Record<RsId, { timeline: OralHistoryEntry[]; sinceBaseline: ReturnType<typeof rsProgress> }>;
  composite: { p: number; meanAccuracyDelta: number | null } | { pending: string };
  readiness: { streamId: string; status: string }[];
  /** News Reader improvement is reported on its own and never folded into any other figure. */
  /** Spaced memory checks, reported on their own: how many stories were still remembered after time away. */
  retention: { checks: number; storiesChecked: number; storiesRemembered: number; summary: string | null };
  newsReader: { passages: { passageId: string; improved: boolean | null; coaching: string | null }[] };
};

export type ParentReportInput = {
  learner: LearnerAggregate;
  oralHistory?: OralHistory;
  readiness?: readonly ReadinessStream[];
};

export function buildParentReport(input: ParentReportInput): ParentReport {
  const { learner } = input;
  const history = input.oralHistory ?? [];
  const decisions = deriveDecisionLedger(learner.ledger, learner.baselineWpm);
  const trendPoints = learner.ledger
    .filter((r) => r.attemptType === "NEW_PROGRESSION")
    .map((r) => ({ attemptId: r.attemptId, wpm: r.levelUpAfter.wpm, valid: r.classification !== null }));
  const trend = personalImprovement([{ attemptId: "baseline", wpm: learner.baselineWpm, valid: true }, ...trendPoints]);

  const timelines = competencyTimelines(history, learner.learnerId);
  const competencies = Object.fromEntries(
    RS_IDS.map((rs) => [rs, { timeline: timelines[rs], sinceBaseline: rsProgress(history, learner.learnerId, rs) }])
  ) as ParentReport["competencies"];

  // highest P level for which every RS has reached it
  let composite: ParentReport["composite"] = { pending: COMPOSITE_PENDING_COPY };
  for (let p = 10; p >= 1; p -= 1) {
    const c = pLevelComposite(history, learner.learnerId, p);
    if (c) { composite = { p: c.p, meanAccuracyDelta: c.meanAccuracyDelta }; break; }
  }

  const completed = Math.min(learner.canonicalPointer - 1, WORLD1_LAST_PASSAGE);
  const passageIds = [...new Set(learner.newsReader.attempts.map((a) => a.passageId))];
  const report: ParentReport = {
    learnerId: learner.learnerId,
    personal: { startingWpm: learner.baselineWpm, currentWpm: learner.core.wpm, levelUps: decisions.filter((d) => d.decisionType === "LEVEL_UP").length, trend },
    canonicalProgress: {
      completedPassages: completed,
      ofPassages: WORLD1_LAST_PASSAGE,
      nextPassageWords: learner.canonicalPointer <= WORLD1_LAST_PASSAGE ? passageWords(learner.canonicalPointer) : null,
      worldComplete: learner.canonicalPointer > WORLD1_LAST_PASSAGE
    },
    practice: { status: learner.core.practiceEligible ? PRACTICE_PARENT_COPY : null },
    competencies,
    composite,
    readiness: (input.readiness ?? []).map((s) => ({ streamId: s.streamId, status: READINESS_PARENT_COPY[s.phase] })),
    retention: (() => {
      const r = retentionSummary(learner);
      return { ...r, summary: r.storiesChecked ? `Your child still remembered ${r.storiesRemembered} of ${r.storiesChecked} ${r.storiesChecked === 1 ? "story" : "stories"} when asked after time away.` : null };
    })(),
    newsReader: {
      passages: passageIds.map((passageId) => {
        const r = twoReadCoaching(learner.newsReader, passageId);
        return { passageId, improved: r.status === "COMPLETE" ? r.improved : null, coaching: r.status === "COMPLETE" ? r.coaching : null };
      })
    }
  };
  assertPersonalOnly(report);
  return report;
}

/** Every human-readable string in the report, for language scanning. */
export function parentCopy(report: ParentReport): string[] {
  const out: string[] = [];
  if (report.practice.status) out.push(report.practice.status);
  if ("pending" in report.composite) out.push(report.composite.pending);
  for (const r of report.readiness) out.push(r.status);
  if (report.retention.summary) out.push(report.retention.summary);
  for (const p of report.newsReader.passages) if (p.coaching) out.push(p.coaching);
  return out;
}

export function parentCopyViolations(report: ParentReport): string[] {
  return parentCopy(report).flatMap((t) => learnerLanguageViolations(t));
}
