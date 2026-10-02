"use client";

// SR-R9-004: Personal Reading Model.
// A reachable demo proving the profile derives only from valid stored evidence and rebuilds
// identically from the same ledger (TC-R9-004-B: delete the derived profile, rebuild - same
// result).

import { useState } from "react";
import {
  buildPersonalReadingModel,
  LedgerEntry,
  ModeCertificationState,
  recordModeChallengeAttempt,
  startModeCertificationState
} from "../../lib/personal-reading-model";
import styles from "../page.module.css";

const LEDGER: LedgerEntry[] = [
  { kind: "CRR_ATTEMPT", challengeWpm: 240, passed: true },
  { kind: "CRR_ATTEMPT", challengeWpm: 300, passed: false },
  { kind: "SUSTAINED_ATTEMPT", measuredWpm: 200, durationBandMet: true, comprehensionPassed: true },
  { kind: "SUSTAINED_ATTEMPT", measuredWpm: 260, durationBandMet: false, comprehensionPassed: true },
  { kind: "SPAN_ATTEMPT", challengeSpanLevel: 2, comprehensionPassed: true },
  { kind: "SPAN_ATTEMPT", challengeSpanLevel: 3, comprehensionPassed: false },
  { kind: "RS_EVIDENCE", rsId: "RS-INFERENCE", matched: false },
  { kind: "RS_EVIDENCE", rsId: "RS-INFERENCE", matched: true }
];

export default function PersonalReadingModelDemoPage() {
  const [profile, setProfile] = useState(() => buildPersonalReadingModel(LEDGER));
  const [rebuildCount, setRebuildCount] = useState(0);

  function rebuildFromLedger() {
    // Simulates deleting the derived profile and rebuilding it purely from the retained ledger.
    setProfile(buildPersonalReadingModel(LEDGER));
    setRebuildCount((previous) => previous + 1);
  }

  // SR-R9-005: Reading-purpose profiles.
  const [modeState, setModeState] = useState<ModeCertificationState>(startModeCertificationState());

  return (
    <main className={styles.shell} data-testid="personal-reading-model-demo">
      <h1>Personal Reading Model</h1>
      <p className={styles.lede}>
        The profile is folded purely from an append-only evidence ledger - only valid (passing)
        entries move CRR, sustainable rate and certified span - and rebuilding from that same
        ledger always yields an identical profile.
      </p>

      <section className={styles.stageCard} data-testid="personal-reading-model">
        <p data-testid="profile-version">Profile version: {profile.profileVersion}</p>
        <p data-testid="profile-crr">CRR: {profile.crr.certifiedWpm}</p>
        <p data-testid="profile-sustainable-rate">Sustainable rate: {profile.sustainableRate.sustainableWpm}</p>
        <p data-testid="profile-span">Certified span: L{profile.span.certifiedSpanLevel}</p>
        <p data-testid="profile-rs-evidence">
          RS-INFERENCE evidence: {profile.rsEvidence.map((entry) => (entry.matched ? "matched" : "not matched")).join(", ")}
        </p>
        <p data-testid="rebuild-count">Rebuild count: {rebuildCount}</p>
        <div className={styles.actions}>
          <button type="button" className={styles.primaryButton} data-testid="rebuild-from-ledger" onClick={rebuildFromLedger}>
            Delete derived profile and rebuild from ledger
          </button>
        </div>
      </section>

      <section className={styles.stageCard} data-testid="reading-purpose-profiles">
        <p className={styles.kicker}>Reading-purpose profiles (SR-R9-005)</p>
        <p className={styles.stageHint}>
          Each reading-purpose mode keeps its own certified rate - a passing attempt in one mode
          never certifies another mode unless an explicit transfer rule permits it.
        </p>
        <p data-testid="mode-normal-crr">normal: {modeState.normal.certifiedWpm}</p>
        <p data-testid="mode-study-crr">study: {modeState.study.certifiedWpm}</p>
        <p data-testid="mode-story-crr">story: {modeState.story.certifiedWpm}</p>
        <p data-testid="mode-scan-crr">scan_preview_review: {modeState.scan_preview_review.certifiedWpm}</p>
        <div className={styles.actions}>
          <button
            type="button"
            className={styles.primaryButton}
            data-testid="certify-study-mode"
            onClick={() => setModeState((previous) => recordModeChallengeAttempt(previous, "study", 240, true))}
          >
            Certify study mode at 240 WPM
          </button>
          <button
            type="button"
            className={styles.secondaryButton}
            data-testid="certify-story-mode-with-transfer"
            onClick={() =>
              setModeState((previous) =>
                recordModeChallengeAttempt(previous, "story", 320, true, [{ fromMode: "story", toMode: "normal" }])
              )
            }
          >
            Certify story mode at 320 WPM (transfers to normal)
          </button>
        </div>
      </section>
    </main>
  );
}
