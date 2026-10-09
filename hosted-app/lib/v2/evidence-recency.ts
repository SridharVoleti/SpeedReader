// FR-045 / APP-RECENCY-001..008 - Evidence recency [FROZEN PRINCIPLE / PROVISIONAL_PILOT PARAMETERS]
// Readiness evidence represents CURRENT ability and cannot stay current indefinitely. That a recency
// rule exists is FROZEN; the clock values are PROVISIONAL_PILOT configuration (RECENCY_POLICY_V1), never
// scattered constants. Three independent clocks (calendar age, subsequent valid sessions, inactivity)
// plus version invalidation. Any trigger makes the affected evidence non-current and the trigger is
// reported so it can be persisted.
//
// Day counting (documented assumption, APP-GOV-004): a "completed learner-local calendar day after the
// anchor" is a whole local calendar day strictly after the anchor's own day and before today, i.e.
// localDateDifference - 1. So 14 complete inactive days means the learner's last activity was on a local
// date 15 or more dates ago.

import type { ReadinessEvidence } from "./world1-completion";

export type RecencyPolicy = {
  version: string;
  status: "PROVISIONAL_PILOT";
  /** Calendar clock: due when MORE THAN this many completed calendar days have passed since the anchor. */
  maxAgeDays: number;
  /** Session clock: due when MORE THAN this many subsequent valid Band-A sessions have completed. */
  maxSessionsSince: number;
  /** Inactivity clock: due once THIS MANY complete learner-local days passed without a completed activity. */
  inactiveDays: number;
  audit: { changedAt: string; reason: string; changedBy: string };
};

export const RECENCY_POLICY_V1: RecencyPolicy = Object.freeze({
  version: "recency-2026-10-pilot-2",
  status: "PROVISIONAL_PILOT",
  maxAgeDays: 56,
  maxSessionsSince: 16,
  inactiveDays: 14,
  audit: Object.freeze({
    changedAt: "2026-10-09",
    reason: "APP-RECENCY-003 v3.0 pilot defaults (56 days / 16 sessions / 14 inactive days); replaces 28-day inactivity",
    changedBy: "product"
  })
});

/** A recency rule must always exist: at least one finite, positive threshold, versioned and audited. */
export function validateRecencyPolicy(policy: RecencyPolicy): string[] {
  const errors: string[] = [];
  const finitePositive = (n: number) => Number.isFinite(n) && n > 0;
  if (!finitePositive(policy.maxAgeDays) && !finitePositive(policy.maxSessionsSince) && !finitePositive(policy.inactiveDays)) {
    errors.push("recency policy needs at least one finite threshold: evidence cannot stay valid indefinitely");
  }
  if (!policy.version) errors.push("recency policy needs a version");
  if (!policy.audit?.reason || !policy.audit?.changedBy || !policy.audit?.changedAt) errors.push("recency policy needs an audit record");
  return errors;
}

/** Versions that produced the evidence (APP-RECENCY-006 / APP-GOV-005). */
export type EvidenceVersions = { scoring: string; threshold: string; tokenizer: string; evidenceRules: string };

export type EvidenceAge = {
  /** Evidence anchor time (ISO). */
  gatheredAt: string;
  /** Subsequent valid Band-A sessions completed after the anchor. */
  sessionsSince: number;
  /** Last completed SpeedReader learning activity (ISO). Defaults to the anchor. */
  lastActivityAt?: string;
  /** Learner's IANA timezone for the local-date basis. Defaults to UTC. */
  timeZone?: string;
  /** Versions in force when the evidence was produced; compared with `currentVersions` when given. */
  versions?: EvidenceVersions;
};

export type RecencyTrigger = "VERSION_INVALIDATED" | "CALENDAR_AGE" | "SESSION_COUNT" | "INACTIVITY";

export type RecencyAudit = {
  anchorAt: string;
  evaluatedAt: string;
  timeZone: string;
  anchorLocalDate: string;
  evaluationLocalDate: string;
  completedCalendarDays: number;
  sessionsSince: number;
  completedInactiveDays: number;
};

export type RecencyVerdict = {
  current: boolean;
  /** Every clock that has fired, in precedence order (version, calendar, sessions, inactivity). */
  reasons: string[];
  triggers: RecencyTrigger[];
  /** The persisted reason: version invalidation has precedence, otherwise the first configured clock. */
  firstTrigger: RecencyTrigger | null;
  /** Version invalidation needs a new compatible cycle, never a one-form shortcut (APP-RECENCY-006). */
  revalidation: "NONE" | "SINGLE_FORM" | "NEW_COMPATIBLE_CYCLE";
  policyVersion: string;
  audit: RecencyAudit;
};

const DAY_MS = 86_400_000;

function localDate(iso: string, timeZone: string): string {
  const ms = Date.parse(iso);
  if (!Number.isFinite(ms)) throw new RangeError(`invalid timestamp ${iso}`);
  return new Intl.DateTimeFormat("en-CA", { timeZone, year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date(ms));
}

function dateDiff(fromLocal: string, toLocal: string): number {
  return Math.round((Date.parse(`${toLocal}T00:00:00Z`) - Date.parse(`${fromLocal}T00:00:00Z`)) / DAY_MS);
}

const completedDays = (fromLocal: string, toLocal: string) => Math.max(0, dateDiff(fromLocal, toLocal) - 1);

export function evidenceRecency(
  age: EvidenceAge,
  now: string,
  policy: RecencyPolicy = RECENCY_POLICY_V1,
  currentVersions?: EvidenceVersions
): RecencyVerdict {
  const errors = validateRecencyPolicy(policy);
  if (errors.length) throw new Error(`invalid recency policy: ${errors.join("; ")}`);
  const nowMs = Date.parse(now);
  const anchorMs = Date.parse(age.gatheredAt);
  const lastMs = Date.parse(age.lastActivityAt ?? age.gatheredAt);
  if (!Number.isFinite(anchorMs) || !Number.isFinite(nowMs) || !Number.isFinite(lastMs) || anchorMs > nowMs || lastMs > nowMs) {
    throw new RangeError("evidence timestamp must be a valid date not after now");
  }
  const timeZone = age.timeZone ?? "UTC";
  const anchorLocal = localDate(age.gatheredAt, timeZone);
  const nowLocal = localDate(now, timeZone);
  const lastLocal = localDate(age.lastActivityAt ?? age.gatheredAt, timeZone);
  const ageDays = completedDays(anchorLocal, nowLocal);
  const inactiveCompleted = completedDays(lastLocal, nowLocal);

  const reasons: string[] = [];
  const triggers: RecencyTrigger[] = [];
  if (age.versions && currentVersions) {
    const changed = (Object.keys(currentVersions) as (keyof EvidenceVersions)[]).filter((k) => age.versions![k] !== currentVersions[k]);
    if (changed.length) {
      triggers.push("VERSION_INVALIDATED");
      reasons.push(`VERSION_INVALIDATED_${changed.join("+")}`);
    }
  }
  if (Number.isFinite(policy.maxAgeDays) && ageDays > policy.maxAgeDays) {
    triggers.push("CALENDAR_AGE");
    reasons.push(`AGE_${ageDays}D_EXCEEDS_${policy.maxAgeDays}D`);
  }
  if (Number.isFinite(policy.maxSessionsSince) && age.sessionsSince > policy.maxSessionsSince) {
    triggers.push("SESSION_COUNT");
    reasons.push(`SESSIONS_${age.sessionsSince}_EXCEEDS_${policy.maxSessionsSince}`);
  }
  if (Number.isFinite(policy.inactiveDays) && inactiveCompleted >= policy.inactiveDays) {
    triggers.push("INACTIVITY");
    reasons.push(`INACTIVE_${inactiveCompleted}D_REACHES_${policy.inactiveDays}D`);
  }
  const versionInvalid = triggers.includes("VERSION_INVALIDATED");
  return {
    current: triggers.length === 0,
    reasons,
    triggers,
    firstTrigger: triggers[0] ?? null,
    revalidation: triggers.length === 0 ? "NONE" : versionInvalid ? "NEW_COMPATIBLE_CYCLE" : "SINGLE_FORM",
    policyVersion: policy.version,
    audit: {
      anchorAt: age.gatheredAt,
      evaluatedAt: now,
      timeZone,
      anchorLocalDate: anchorLocal,
      evaluationLocalDate: nowLocal,
      completedCalendarDays: ageDays,
      sessionsSince: age.sessionsSince,
      completedInactiveDays: inactiveCompleted
    }
  };
}

export type RevalidationAttempt = "VALID_PASS" | "VALID_FAILURE" | "TECHNICAL_INVALID" | "INSUFFICIENT_EVIDENCE" | "INVALID_FORM";

export type RevalidationResult = {
  state: "CURRENT_NEW_ANCHOR" | "REMEDIATION_THEN_NEW_CYCLE" | "REVALIDATION_PENDING" | "NEW_COMPATIBLE_CYCLE_REQUIRED";
  /** True when the evidence/form must be replaced before another try (APP-RECENCY-007). */
  replaceEvidenceOrForm: boolean;
};

/** APP-RECENCY-007: outcome of a recency revalidation attempt for one affected stream. */
export function revalidationOutcome(trigger: RecencyTrigger, attempt: RevalidationAttempt): RevalidationResult {
  if (trigger === "VERSION_INVALIDATED") {
    return { state: "NEW_COMPATIBLE_CYCLE_REQUIRED", replaceEvidenceOrForm: attempt === "INVALID_FORM" || attempt === "TECHNICAL_INVALID" };
  }
  switch (attempt) {
    case "VALID_PASS":
      return { state: "CURRENT_NEW_ANCHOR", replaceEvidenceOrForm: false };
    case "VALID_FAILURE":
      return { state: "REMEDIATION_THEN_NEW_CYCLE", replaceEvidenceOrForm: false };
    default:
      return { state: "REVALIDATION_PENDING", replaceEvidenceOrForm: true };
  }
}

export type DatedReadiness = ReadinessEvidence & EvidenceAge;

/** Stale readiness evidence stops counting as confirmed until revalidated with an approved form (FR-044). */
export function applyRecency(
  readiness: readonly DatedReadiness[],
  now: string,
  policy: RecencyPolicy = RECENCY_POLICY_V1,
  currentVersions?: EvidenceVersions
): ReadinessEvidence[] {
  return readiness.map((r) => ({
    rsId: r.rsId,
    formId: r.formId,
    confirmed: r.confirmed && evidenceRecency(r, now, policy, currentVersions).current
  }));
}
