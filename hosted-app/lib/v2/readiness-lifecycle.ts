// APP-READY-001..008 - Readiness stream lifecycle for one learner + one competency stream (e.g. an RS).
//
// Pure state machine over valid, controlled-form attempts:
//   PRIMARY pass -> CONFIRMATION due (one primary pass can never close a stream: APP-READY-005)
//   CONFIRMATION pass -> CONFIRMED
//   valid FAIL -> REMEDIATION_REQUIRED; no fresh form is offered until remediation completes, then a NEW
//                 cycle starts (no retry lottery: APP-READY-006)
//   TECHNICAL_INVALID / INSUFFICIENT_EVIDENCE / INVALID_FORM -> lifecycle phase unchanged; a replacement for
//                 the SAME protected role is required, using a different form (APP-READY-007)
// Readiness identity (registry passage, form family, assessment form, delivery event, attempt, role) is kept
// separate from the canonical World 1 sequence and never consumes a canonical position (APP-READY-002).
// This module imports nothing from core WPM progression and nothing reads it for core WPM or World
// advancement (APP-READY-008).

import type { RecencyTrigger } from "./evidence-recency";

export const ATTEMPT_OUTCOMES = ["PASS", "FAIL", "TECHNICAL_INVALID", "INSUFFICIENT_EVIDENCE", "INVALID_FORM"] as const;
export type AttemptOutcome = (typeof ATTEMPT_OUTCOMES)[number];

export const ATTEMPT_ROLES = ["PRIMARY", "NEW_CYCLE_PRIMARY", "CONFIRMATION", "NEW_CYCLE_CONFIRMATION", "TECHNICAL_REPLACEMENT", "REVALIDATION"] as const;
export type AttemptRole = (typeof ATTEMPT_ROLES)[number];
/** Roles that carry a protected lifecycle slot (a replacement stands in for one of these). */
export type ProtectedRole = Exclude<AttemptRole, "TECHNICAL_REPLACEMENT">;

export type ReadinessPhase =
  | "PRIMARY_DUE"
  | "CONFIRMATION_DUE"
  | "CONFIRMED"
  | "REMEDIATION_REQUIRED"
  | "NEW_CYCLE_PRIMARY_DUE"
  | "NEW_CYCLE_CONFIRMATION_DUE"
  | "REVALIDATION_DUE"
  | "NEW_CYCLE_REQUIRED_VERSION_INVALIDATED";

/** The separate identities persisted for every readiness attempt (APP-READY-002). */
export type ReadinessIdentity = {
  registryPassageId: string;
  formFamilyId: string;
  assessmentFormId: string;
  deliveryEventId: string;
  attemptId: string;
};

export type ReadinessAttempt = ReadinessIdentity & {
  role: AttemptRole;
  /** Required when role is TECHNICAL_REPLACEMENT: which protected slot is being filled. */
  replacesRole?: ProtectedRole;
  outcome: AttemptOutcome;
  at: string;
  /** Must be absent: readiness forms never occupy a canonical World 1 position. */
  canonicalSequence?: never;
};

export type ReadinessStream = {
  learnerId: string;
  streamId: string;
  phase: ReadinessPhase;
  cycle: number;
  /** Set while a technical/evidence/form-invalid outcome awaits a same-role replacement. */
  pendingReplacement: ProtectedRole | null;
  /** Anchor of the latest CONFIRMED state (drives recency). */
  confirmedAt: string | null;
  revalidationTrigger: RecencyTrigger | null;
  /** Every attempt, valid or not, in order. Never rewritten. */
  history: readonly ReadinessAttempt[];
};

export function newReadinessStream(learnerId: string, streamId: string): ReadinessStream {
  return { learnerId, streamId, phase: "PRIMARY_DUE", cycle: 1, pendingReplacement: null, confirmedAt: null, revalidationTrigger: null, history: [] };
}

/** The protected role the stream is waiting for, or null when nothing can be attempted. */
export function expectedRole(stream: ReadinessStream): ProtectedRole | null {
  switch (stream.phase) {
    case "PRIMARY_DUE": return "PRIMARY";
    case "CONFIRMATION_DUE": return "CONFIRMATION";
    case "NEW_CYCLE_PRIMARY_DUE": return "NEW_CYCLE_PRIMARY";
    case "NEW_CYCLE_CONFIRMATION_DUE": return "NEW_CYCLE_CONFIRMATION";
    case "REVALIDATION_DUE": return "REVALIDATION";
    default: return null; // CONFIRMED, REMEDIATION_REQUIRED, NEW_CYCLE_REQUIRED_VERSION_INVALIDATED
  }
}

export function identityErrors(a: ReadinessIdentity & { canonicalSequence?: unknown }): string[] {
  const errors: string[] = [];
  for (const k of ["registryPassageId", "formFamilyId", "assessmentFormId", "deliveryEventId", "attemptId"] as const) {
    if (!a[k]) errors.push(`missing ${k}`);
  }
  if (a.canonicalSequence !== undefined) errors.push("readiness forms must not consume a canonical World 1 position");
  return errors;
}

export type ApplyResult =
  | { ok: true; stream: ReadinessStream; learnerFailure: boolean }
  | { ok: false; error: string; stream: ReadinessStream };

const reject = (stream: ReadinessStream, error: string): ApplyResult => ({ ok: false, error, stream });

/** Apply one attempt. Rejected attempts change nothing. */
export function applyReadinessAttempt(stream: ReadinessStream, attempt: ReadinessAttempt): ApplyResult {
  const idErrors = identityErrors(attempt);
  if (idErrors.length) return reject(stream, idErrors.join("; "));
  if (!ATTEMPT_ROLES.includes(attempt.role)) return reject(stream, `unknown role ${attempt.role}`);
  if (!ATTEMPT_OUTCOMES.includes(attempt.outcome)) return reject(stream, `unknown outcome ${attempt.outcome}`);
  if (stream.history.some((h) => h.attemptId === attempt.attemptId)) return reject(stream, `attempt ${attempt.attemptId} already recorded`);
  if (stream.history.some((h) => h.assessmentFormId === attempt.assessmentFormId)) return reject(stream, `form ${attempt.assessmentFormId} was already used in this stream`);

  const slot = stream.pendingReplacement ?? expectedRole(stream);
  if (slot === null) return reject(stream, `no attempt is due in phase ${stream.phase}`);

  if (stream.pendingReplacement) {
    if (attempt.role !== "TECHNICAL_REPLACEMENT" || attempt.replacesRole !== stream.pendingReplacement) {
      return reject(stream, `a TECHNICAL_REPLACEMENT for ${stream.pendingReplacement} is required`);
    }
  } else if (attempt.role !== slot) {
    return reject(stream, `expected role ${slot}, got ${attempt.role}`);
  }

  const history = [...stream.history, Object.freeze({ ...attempt })];
  const base: ReadinessStream = { ...stream, history };

  switch (attempt.outcome) {
    case "TECHNICAL_INVALID":
    case "INSUFFICIENT_EVIDENCE":
    case "INVALID_FORM":
      // Not a learner failure and not progress: same protected role must be re-attempted on a different form.
      return { ok: true, stream: { ...base, pendingReplacement: slot }, learnerFailure: false };
    case "FAIL":
      return { ok: true, stream: { ...base, pendingReplacement: null, phase: "REMEDIATION_REQUIRED" }, learnerFailure: true };
    case "PASS": {
      const cleared = { ...base, pendingReplacement: null };
      switch (slot) {
        case "PRIMARY": return { ok: true, stream: { ...cleared, phase: "CONFIRMATION_DUE" }, learnerFailure: false };
        case "NEW_CYCLE_PRIMARY": return { ok: true, stream: { ...cleared, phase: "NEW_CYCLE_CONFIRMATION_DUE" }, learnerFailure: false };
        case "CONFIRMATION":
        case "NEW_CYCLE_CONFIRMATION":
        case "REVALIDATION":
          return { ok: true, stream: { ...cleared, phase: "CONFIRMED", confirmedAt: attempt.at, revalidationTrigger: null }, learnerFailure: false };
      }
    }
  }
}

/** Remediation finished: only now may a new cycle begin (APP-READY-006). */
export function completeRemediation(stream: ReadinessStream): ReadinessStream {
  if (stream.phase !== "REMEDIATION_REQUIRED") throw new Error(`remediation is not pending in phase ${stream.phase}`);
  return { ...stream, phase: "NEW_CYCLE_PRIMARY_DUE", cycle: stream.cycle + 1 };
}

/**
 * Recency trigger fired for a CONFIRMED stream. A clock trigger asks for a single REVALIDATION form;
 * version invalidation demands a full new compatible cycle (APP-RECENCY-006).
 */
export function dueForRevalidation(stream: ReadinessStream, trigger: RecencyTrigger): ReadinessStream {
  if (stream.phase !== "CONFIRMED") return stream; // already being re-earned; the trigger changes nothing
  if (trigger === "VERSION_INVALIDATED") {
    return { ...stream, phase: "NEW_CYCLE_PRIMARY_DUE", cycle: stream.cycle + 1, confirmedAt: null, revalidationTrigger: trigger };
  }
  return { ...stream, phase: "REVALIDATION_DUE", revalidationTrigger: trigger };
}

/**
 * Pick the next form for the due slot. Returns null when nothing is due, or while remediation is
 * outstanding - a valid failure never gets a stream of fresh forms.
 */
export function nextForm(stream: ReadinessStream, approvedEquivalentForms: readonly string[]): string | null {
  if (stream.pendingReplacement === null && expectedRole(stream) === null) return null;
  const used = new Set(stream.history.map((h) => h.assessmentFormId));
  return approvedEquivalentForms.find((f) => !used.has(f)) ?? null;
}

/** Evidence counts as current readiness only when the stream is CONFIRMED. */
export function isReadinessConfirmed(stream: ReadinessStream): boolean {
  return stream.phase === "CONFIRMED";
}
