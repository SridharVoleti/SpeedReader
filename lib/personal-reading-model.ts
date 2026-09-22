// SR-R9-004: Personal Reading Model.
// "Maintain explainable profile: CRR, sustainable rate, span, construct strengths and
//  bottlenecks."
// "Profile derives only from valid stored evidence and rebuilds identically from ledger."
// (TC-R9-004-B) The profile is never mutated directly - it is purely folded from an append-only
// ledger through each release's own pure reducer (recordChallengeAttempt, recordSustainedAttempt,
// recordSpanChallengeAttempt), so "delete the derived profile and rebuild" is just re-running the
// same fold and always yields the same result.

import { CertificationRateState, recordChallengeAttempt } from "./certification";
import { recordSpanChallengeAttempt, SpanCertificationState } from "./meaningful-chunking";
import { recordSustainedAttempt, startSustainableRate, SustainableRateState } from "./sustained-reading";

export type LedgerEntry =
  | { kind: "CRR_ATTEMPT"; challengeWpm: number; passed: boolean }
  | { kind: "SUSTAINED_ATTEMPT"; measuredWpm: number; durationBandMet: boolean; comprehensionPassed: boolean }
  | { kind: "SPAN_ATTEMPT"; challengeSpanLevel: number; comprehensionPassed: boolean }
  | { kind: "RS_EVIDENCE"; rsId: string; matched: boolean };

export type RsEvidenceRecord = {
  rsId: string;
  matched: boolean;
};

export type PersonalReadingModel = {
  profileVersion: number;
  crr: CertificationRateState;
  sustainableRate: SustainableRateState;
  span: SpanCertificationState;
  rsEvidence: RsEvidenceRecord[];
};

export const PROFILE_VERSION = 1;

export function buildPersonalReadingModel(ledger: LedgerEntry[]): PersonalReadingModel {
  let crr: CertificationRateState = { certifiedWpm: 0, challengeWpm: null };
  let sustainableRate: SustainableRateState = startSustainableRate();
  let span: SpanCertificationState = { certifiedSpanLevel: 1, challengeSpanLevel: null };
  const rsEvidence: RsEvidenceRecord[] = [];

  for (const entry of ledger) {
    switch (entry.kind) {
      case "CRR_ATTEMPT":
        crr = recordChallengeAttempt(crr, entry.challengeWpm, entry.passed);
        break;
      case "SUSTAINED_ATTEMPT":
        sustainableRate = recordSustainedAttempt(sustainableRate, entry.measuredWpm, {
          durationBandMet: entry.durationBandMet,
          comprehensionPassed: entry.comprehensionPassed
        });
        break;
      case "SPAN_ATTEMPT":
        span = recordSpanChallengeAttempt(span, entry.challengeSpanLevel, entry.comprehensionPassed);
        break;
      case "RS_EVIDENCE":
        rsEvidence.push({ rsId: entry.rsId, matched: entry.matched });
        break;
    }
  }

  return { profileVersion: PROFILE_VERSION, crr, sustainableRate, span, rsEvidence };
}
