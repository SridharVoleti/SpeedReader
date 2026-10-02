// FR-045 - Evidence recency [FROZEN PRINCIPLE / PROVISIONAL_PILOT PARAMETER]
// Readiness evidence must represent CURRENT ability: very old evidence cannot stay valid indefinitely.
// That a recency/revalidation rule exists is FROZEN. The exact inactivity/session/calendar threshold is
// PROVISIONAL_PILOT: it must be calibrated from learner evidence, versioned and auditable, so it lives
// in a versioned policy record (assumed pilot values below are documented placeholders, not product law).

import type { ReadinessEvidence } from "./world1-completion";

export type RecencyPolicy = {
  version: string;
  status: "PROVISIONAL_PILOT";
  /** Calendar limit; evidence older than this needs revalidation. */
  maxAgeDays: number;
  /** Session/inactivity limit: sessions completed since the evidence was gathered. */
  maxSessionsSince: number;
  audit: { changedAt: string; reason: string; changedBy: string };
};

export const RECENCY_POLICY_V1: RecencyPolicy = Object.freeze({
  version: "recency-2026-10-pilot-1",
  status: "PROVISIONAL_PILOT",
  maxAgeDays: 180,
  maxSessionsSince: 120,
  audit: Object.freeze({ changedAt: "2026-10-03", reason: "initial pilot placeholder pending calibration", changedBy: "product" })
});

/** A recency rule must always exist: at least one finite, positive threshold, versioned and audited. */
export function validateRecencyPolicy(policy: RecencyPolicy): string[] {
  const errors: string[] = [];
  const finitePositive = (n: number) => Number.isFinite(n) && n > 0;
  if (!finitePositive(policy.maxAgeDays) && !finitePositive(policy.maxSessionsSince)) {
    errors.push("recency policy needs at least one finite threshold: evidence cannot stay valid indefinitely");
  }
  if (!policy.version) errors.push("recency policy needs a version");
  if (!policy.audit?.reason || !policy.audit?.changedBy || !policy.audit?.changedAt) errors.push("recency policy needs an audit record");
  return errors;
}

export type EvidenceAge = { gatheredAt: string; sessionsSince: number };

export type RecencyVerdict = { current: boolean; reasons: string[]; policyVersion: string };

export function evidenceRecency(age: EvidenceAge, now: string, policy: RecencyPolicy = RECENCY_POLICY_V1): RecencyVerdict {
  const errors = validateRecencyPolicy(policy);
  if (errors.length) throw new Error(`invalid recency policy: ${errors.join("; ")}`);
  const ageDays = (Date.parse(now) - Date.parse(age.gatheredAt)) / 86_400_000;
  if (!Number.isFinite(ageDays) || ageDays < 0) throw new RangeError("evidence timestamp must be a valid date not after now");
  const reasons: string[] = [];
  if (Number.isFinite(policy.maxAgeDays) && ageDays > policy.maxAgeDays) reasons.push(`AGE_${Math.floor(ageDays)}D_EXCEEDS_${policy.maxAgeDays}D`);
  if (Number.isFinite(policy.maxSessionsSince) && age.sessionsSince > policy.maxSessionsSince) reasons.push(`SESSIONS_${age.sessionsSince}_EXCEEDS_${policy.maxSessionsSince}`);
  return { current: reasons.length === 0, reasons, policyVersion: policy.version };
}

export type DatedReadiness = ReadinessEvidence & EvidenceAge;

/** Stale readiness evidence stops counting as confirmed until revalidated with an approved form (FR-044). */
export function applyRecency(readiness: readonly DatedReadiness[], now: string, policy: RecencyPolicy = RECENCY_POLICY_V1): ReadinessEvidence[] {
  return readiness.map((r) => ({
    rsId: r.rsId,
    formId: r.formId,
    confirmed: r.confirmed && evidenceRecency(r, now, policy).current
  }));
}
