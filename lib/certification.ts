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
