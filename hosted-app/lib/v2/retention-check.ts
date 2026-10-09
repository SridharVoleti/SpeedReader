// Retention: does the learner still remember a story after time away? (the "retention" in the 200-page-book outcome)
//
// Spaced recall checks on stories already read: first after ~24 hours, then ~7 days, then ~30 days (PROVISIONAL_PILOT
// config). The learner answers the story's questions WITHOUT re-reading it, then gets a short refresher (retrieval
// practice followed by feedback). This is a separate evidence namespace (APP-DATA-004): it is scored on its own via the
// delayed-recall helper, is never progression evidence, never changes WPM, the canonical pointer or the attempt ledger,
// and never blocks the next story. A story is "remembered" when the check meets the pilot share; the latest check wins.

import type { LearnerAggregate } from "./learner-aggregate";
import { classifyDelayBucket, recordRetentionEvidence } from "../retention";

export type RetentionPolicy = {
  version: string;
  status: "PROVISIONAL_PILOT";
  /** Hours after the story was completed at which check 1, 2, 3 ... become due. */
  intervalsHours: readonly number[];
  /** Share of the story's questions answered correctly that counts as "remembered". */
  rememberedShare: number;
};

export const RETENTION_POLICY_V1: RetentionPolicy = Object.freeze({
  version: "retention-2026-10-pilot-1",
  status: "PROVISIONAL_PILOT",
  intervalsHours: Object.freeze([24, 24 * 7, 24 * 30]),
  rememberedShare: 0.75
});

export type RetentionRecord = {
  attemptId: string;
  passageId: string;
  checkNumber: number;
  correct: number;
  total: number;
  remembered: boolean;
  delaySeconds: number;
  delayBucket: string | null;
  /** The learner's own immediate result on this story, carried for reporting only. */
  immediateScore: number | null;
  sessionId: string;
  at: string;
  policyVersion: string;
};

export type RetentionDue = { passageId: string; checkNumber: number; dueAt: string; completedAt: string };

const HOUR = 3_600_000;

/** First scored completion of each canonical story, oldest first. */
function completions(learner: LearnerAggregate): { passageId: string; completedAt: string; correct: number; total: number }[] {
  const seen = new Map<string, { passageId: string; completedAt: string; correct: number; total: number }>();
  for (const r of learner.ledger) {
    if (r.attemptType !== "NEW_PROGRESSION" || r.classification === null || seen.has(r.passageId)) continue;
    const items = r.structured?.items ?? [];
    seen.set(r.passageId, { passageId: r.passageId, completedAt: r.completedAt, correct: items.filter((i) => i.score >= 0.5).length, total: items.length });
  }
  return [...seen.values()];
}

export function retentionPolicyValid(p: RetentionPolicy): string[] {
  const errors: string[] = [];
  if (!p.version) errors.push("retention policy needs a version");
  if (!p.intervalsHours.length || p.intervalsHours.some((h, i) => !(h >= 0) || (i > 0 && h <= p.intervalsHours[i - 1]))) errors.push("intervals must be non-negative and strictly increasing");
  if (!(p.rememberedShare > 0 && p.rememberedShare <= 1)) errors.push("rememberedShare must be in (0,1]");
  return errors;
}

/** The next story whose spaced check is due (earliest due first), or null. Never more checks than the policy defines. */
export function retentionDue(learner: LearnerAggregate, now: string, policy: RetentionPolicy = RETENTION_POLICY_V1): RetentionDue | null {
  const nowMs = Date.parse(now);
  if (!Number.isFinite(nowMs)) throw new RangeError("now must be a valid timestamp");
  const log = learner.retentionLog ?? [];
  let best: (RetentionDue & { dueMs: number }) | null = null;
  for (const c of completions(learner)) {
    const done = log.filter((r) => r.passageId === c.passageId).length;
    if (done >= policy.intervalsHours.length) continue;
    const dueMs = Date.parse(c.completedAt) + policy.intervalsHours[done] * HOUR;
    if (dueMs > nowMs) continue;
    if (!best || dueMs < best.dueMs) best = { passageId: c.passageId, checkNumber: done + 1, dueAt: new Date(dueMs).toISOString(), completedAt: c.completedAt, dueMs };
  }
  return best ? { passageId: best.passageId, checkNumber: best.checkNumber, dueAt: best.dueAt, completedAt: best.completedAt } : null;
}

export type RetentionInput = { attemptId: string; passageId: string; correct: number; total: number; sessionId: string; at: string };

export type RetentionResult =
  | { ok: true; learner: LearnerAggregate; record: RetentionRecord; replayed: boolean }
  | { ok: false; error: string };

/** Record one check. Only the retention log changes; core WPM, pointer, ledger and News Reader state are carried over untouched. */
export function recordRetentionCheck(learner: LearnerAggregate, input: RetentionInput, policy: RetentionPolicy = RETENTION_POLICY_V1): RetentionResult {
  const existing = (learner.retentionLog ?? []).find((r) => r.attemptId === input.attemptId);
  if (existing) return { ok: true, learner, record: existing, replayed: true };
  if (!input.attemptId) return { ok: false, error: "attemptId is required" };
  if (!Number.isInteger(input.total) || input.total < 1 || !Number.isInteger(input.correct) || input.correct < 0 || input.correct > input.total) return { ok: false, error: "invalid recall result" };
  const due = retentionDue(learner, input.at, policy);
  if (!due || due.passageId !== input.passageId) return { ok: false, error: "this story is not due for a memory check" };
  const source = completions(learner).find((c) => c.passageId === input.passageId)!;
  const delaySeconds = Math.max(0, (Date.parse(input.at) - Date.parse(source.completedAt)) / 1000);
  const evidence = recordRetentionEvidence(input.passageId, delaySeconds, { correct: source.correct, total: source.total }, { correct: input.correct, total: input.total });
  const record: RetentionRecord = Object.freeze({
    attemptId: input.attemptId, passageId: input.passageId, checkNumber: due.checkNumber, correct: input.correct, total: input.total,
    remembered: input.correct / input.total >= policy.rememberedShare, delaySeconds, delayBucket: classifyDelayBucket(delaySeconds),
    immediateScore: evidence.immediateScore, sessionId: input.sessionId, at: input.at, policyVersion: policy.version
  });
  return { ok: true, learner: { ...learner, retentionLog: [...(learner.retentionLog ?? []), record] }, record, replayed: false };
}

export type RetentionSummary = { checks: number; storiesChecked: number; storiesRemembered: number };

/** A story counts as remembered when its LATEST check met the pilot share. */
export function retentionSummary(learner: LearnerAggregate): RetentionSummary {
  const latest = new Map<string, RetentionRecord>();
  for (const r of learner.retentionLog ?? []) latest.set(r.passageId, r);
  return { checks: (learner.retentionLog ?? []).length, storiesChecked: latest.size, storiesRemembered: [...latest.values()].filter((r) => r.remembered).length };
}
