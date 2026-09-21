// SR-R2-001: Certified Reading Rate.
// "Maintain CRR separately from attempted/challenge WPM." A learner may attempt (challenge) any
// WPM at any time; the Certified Reading Rate only ever changes through an explicit
// certification decision (built out fully in SR-R2-002/003's independent-confirmation and gate
// rules) - never merely from having attempted, or even scored well on, a higher WPM.

export type CertificationRateState = {
  certifiedWpm: number;
  challengeWpm: number | null;
};

export function recordChallengeAttempt(
  state: CertificationRateState,
  challengeWpm: number,
  certificationPassed: boolean
): CertificationRateState {
  if (!certificationPassed) {
    return { certifiedWpm: state.certifiedWpm, challengeWpm };
  }
  // CRR only ever moves up - a passing certification below the current CRR (e.g. a stale rule
  // evaluation) can never lower it.
  return { certifiedWpm: Math.max(state.certifiedWpm, challengeWpm), challengeWpm };
}

// SR-R2-002: Independent confirmation.
// "Require configurable valid independent forms before certifying WPM."
// "One success cannot certify when confirmations>1; same form/version cannot count repeatedly as
//  independent." Tracks distinct passed form_ids toward a configurable requiredConfirmations
// count; the result feeds the `certificationPassed` gate of recordChallengeAttempt above.
export type ConfirmationTracker = {
  challengeWpm: number;
  requiredConfirmations: number;
  confirmedFormIds: string[];
};

export function startConfirmationTracker(
  challengeWpm: number,
  requiredConfirmations: number
): ConfirmationTracker {
  return { challengeWpm, requiredConfirmations, confirmedFormIds: [] };
}

export function recordConfirmation(
  tracker: ConfirmationTracker,
  formId: string,
  passed: boolean
): ConfirmationTracker {
  if (!passed) return tracker;
  if (tracker.confirmedFormIds.includes(formId)) return tracker; // same form/version, not independent
  return { ...tracker, confirmedFormIds: [...tracker.confirmedFormIds, formId] };
}

export function isReadyToCertify(tracker: ConfirmationTracker): boolean {
  return tracker.confirmedFormIds.length >= tracker.requiredConfirmations;
}

// SR-R2-003: Certification gate composition.
// "Require exposure validity + comprehension PASS + evidence sufficiency for every required
//  confirmation." "Any required gate failure blocks certification; INVALID does not count as
//  learner failure." All three gates are required - never averaged or majority-voted - and a
//  failed exposureValid gate (a technically INVALID attempt) is treated exactly like any other
//  non-passing attempt: it simply doesn't count, with no extra penalty.
export type GateResults = {
  exposureValid: boolean;
  comprehensionPassed: boolean;
  evidenceSufficient: boolean;
};

export function allGatesPassed(gates: GateResults): boolean {
  return gates.exposureValid && gates.comprehensionPassed && gates.evidenceSufficient;
}

export function recordConfirmationWithGates(
  tracker: ConfirmationTracker,
  formId: string,
  gates: GateResults
): ConfirmationTracker {
  return recordConfirmation(tracker, formId, allGatesPassed(gates));
}

// SR-R2-004: Certification history.
// "Make every CRR change auditable." "History stores old/new CRR, qualifying attempts, rule
// version and timestamp; replay yields same result." Bump whenever the certification rule
// (required-confirmations composition above) changes, so a stored entry always identifies
// exactly which rule produced it.
export const CERTIFICATION_RULE_VERSION = "1.0";

export type CertificationHistoryEntry = {
  oldCertifiedWpm: number;
  newCertifiedWpm: number;
  qualifyingFormIds: string[];
  ruleVersion: string;
  recordedAt: string;
};

export function buildCertificationHistoryEntry(params: {
  oldCertifiedWpm: number;
  newCertifiedWpm: number;
  qualifyingFormIds: string[];
  now?: () => string;
}): CertificationHistoryEntry {
  const now = params.now ?? (() => new Date().toISOString());
  return {
    oldCertifiedWpm: params.oldCertifiedWpm,
    newCertifiedWpm: params.newCertifiedWpm,
    qualifyingFormIds: params.qualifyingFormIds,
    ruleVersion: CERTIFICATION_RULE_VERSION,
    recordedAt: now()
  };
}

// Deterministically re-derives a certification outcome purely from the qualifying attempts and
// the current rule (startConfirmationTracker + recordConfirmation + isReadyToCertify), so a
// stored history entry can always be independently verified/replayed to the same result.
export function replayCertification(params: {
  priorCertifiedWpm: number;
  challengeWpm: number;
  qualifyingFormIds: string[];
  requiredConfirmations: number;
}): CertificationRateState {
  let tracker = startConfirmationTracker(params.challengeWpm, params.requiredConfirmations);
  for (const formId of params.qualifyingFormIds) {
    tracker = recordConfirmation(tracker, formId, true);
  }
  return recordChallengeAttempt(
    { certifiedWpm: params.priorCertifiedWpm, challengeWpm: null },
    params.challengeWpm,
    isReadyToCertify(tracker)
  );
}

const CERTIFICATION_HISTORY_STORAGE_KEY = "speedreader-certification-history-v1";

function certificationHistoryStorageKey(learnerId?: string): string {
  return learnerId
    ? `${CERTIFICATION_HISTORY_STORAGE_KEY}:${learnerId}`
    : CERTIFICATION_HISTORY_STORAGE_KEY;
}

export function loadCertificationHistory(learnerId?: string): CertificationHistoryEntry[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(certificationHistoryStorageKey(learnerId));
    return raw ? (JSON.parse(raw) as CertificationHistoryEntry[]) : [];
  } catch {
    return [];
  }
}

// The history only ever grows - past entries are never edited or removed, keeping it a faithful
// audit trail of every CRR change.
export function appendCertificationHistory(
  entry: CertificationHistoryEntry,
  learnerId?: string
): CertificationHistoryEntry[] {
  if (typeof window === "undefined") return [];
  const next = [...loadCertificationHistory(learnerId), entry];
  window.localStorage.setItem(certificationHistoryStorageKey(learnerId), JSON.stringify(next));
  return next;
}
