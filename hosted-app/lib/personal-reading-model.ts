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

// SR-R9-005: Reading-purpose profiles.
// "Support configurable normal/study/story/scan-preview-review modes without conflating
//  certified rates."
// "Evidence in one mode does not certify another unless transfer rule permits." Each mode keeps
// its own independent CertificationRateState; a passing attempt in one mode only ever touches
// another mode's rate when an explicit transfer rule names that exact from/to pair.
export type ReadingPurpose = "normal" | "study" | "story" | "scan_preview_review";

export type ModeCertificationState = Record<ReadingPurpose, CertificationRateState>;

export type ModeTransferRule = {
  fromMode: ReadingPurpose;
  toMode: ReadingPurpose;
};

export function startModeCertificationState(): ModeCertificationState {
  const empty: CertificationRateState = { certifiedWpm: 0, challengeWpm: null };
  return {
    normal: { ...empty },
    study: { ...empty },
    story: { ...empty },
    scan_preview_review: { ...empty }
  };
}

export function recordModeChallengeAttempt(
  state: ModeCertificationState,
  attemptMode: ReadingPurpose,
  challengeWpm: number,
  passed: boolean,
  transferRules: ModeTransferRule[] = []
): ModeCertificationState {
  const targetModes = new Set<ReadingPurpose>([attemptMode]);
  for (const rule of transferRules) {
    if (rule.fromMode === attemptMode) targetModes.add(rule.toMode);
  }

  const next = { ...state };
  for (const mode of targetModes) {
    next[mode] = recordChallengeAttempt(state[mode], challengeWpm, passed);
  }
  return next;
}
