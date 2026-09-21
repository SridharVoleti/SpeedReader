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
