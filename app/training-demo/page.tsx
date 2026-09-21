"use client";

// SR-R6-001: Evidence-driven next activity.
// A reachable demo: a diagnosed bottleneck (RS-INFERENCE) selects the correct approved,
// prerequisite-satisfying activity, ignoring WIP content and already-completed activities.

import { useState } from "react";
import { startConfirmationTracker } from "../../lib/certification";
import {
  LearnerProfile,
  ReassessmentForm,
  recordConfirmationRespectingFormPurpose,
  selectNextActivity,
  TrainingActivity
} from "../../lib/training";
import styles from "../page.module.css";

const CATALOG: TrainingActivity[] = [
  { activityId: "act-wip", targetsRsId: "RS-INFERENCE", approvalStatus: "WIP", prerequisiteActivityIds: [] },
  {
    activityId: "act-inference-1",
    targetsRsId: "RS-INFERENCE",
    approvalStatus: "APPROVED",
    prerequisiteActivityIds: []
  },
  {
    activityId: "act-inference-2",
    targetsRsId: "RS-INFERENCE",
    approvalStatus: "APPROVED",
    prerequisiteActivityIds: ["act-inference-1"]
  }
];

const ALL_PASSING_GATES = { exposureValid: true, comprehensionPassed: true, evidenceSufficient: true };

export default function TrainingDemoPage() {
  const [completedActivityIds, setCompletedActivityIds] = useState<string[]>([]);
  const profile: LearnerProfile = { diagnosedBottleneckRsIds: ["RS-INFERENCE"], completedActivityIds };
  const selection = selectNextActivity(profile, CATALOG);

  // SR-R6-002: Remediation then independent reassessment.
  const [confirmationTracker, setConfirmationTracker] = useState(() => startConfirmationTracker(150, 1));

  function submitForm(formPurpose: "training" | "assessment") {
    const form: ReassessmentForm = {
      formId: `${formPurpose}-form-1`,
      formPurpose,
      explicitlyApprovedForAssessment: false
    };
    setConfirmationTracker((previous) =>
      recordConfirmationRespectingFormPurpose(previous, form, ALL_PASSING_GATES)
    );
  }

  return (
    <main className={styles.shell} data-testid="training-demo">
      <h1>Evidence-driven next activity</h1>
      <p className={styles.lede}>
        With a diagnosed RS-INFERENCE bottleneck, the next activity is selected purely from the
        authored catalog: only APPROVED activities whose prerequisites are already completed are
        eligible - the WIP activity is never selected.
      </p>

      <section className={styles.stageCard} data-testid="activity-selection">
        <p data-testid="selected-activity">Selected activity: {selection.activityId ?? "none"}</p>
        <p data-testid="selection-reason">Selection reason: {selection.selectionReason}</p>
        <p data-testid="completed-activities">Completed: {completedActivityIds.join(", ") || "none"}</p>
        <div className={styles.actions}>
          <button
            type="button"
            className={styles.primaryButton}
            data-testid="complete-inference-1"
            disabled={completedActivityIds.includes("act-inference-1")}
            onClick={() => setCompletedActivityIds((previous) => [...previous, "act-inference-1"])}
          >
            Mark act-inference-1 complete
          </button>
        </div>
      </section>

      <section className={styles.stageCard} data-testid="remediation-reassessment">
        <p className={styles.kicker}>Remediation then independent reassessment (SR-R6-002)</p>
        <p className={styles.stageHint}>
          A passing training/remediation attempt is excluded from independent confirmation by
          default - only an assessment-purposed form (or one explicitly approved for assessment)
          counts toward certification.
        </p>
        <p data-testid="confirmation-count">Confirmations: {confirmationTracker.confirmedFormIds.length}/1</p>
        <p data-testid="confirmed-forms">Confirmed forms: {confirmationTracker.confirmedFormIds.join(", ") || "none"}</p>
        <div className={styles.actions}>
          <button
            type="button"
            className={styles.secondaryButton}
            data-testid="submit-training-form"
            onClick={() => submitForm("training")}
          >
            Submit passing training/remediation attempt
          </button>
          <button
            type="button"
            className={styles.primaryButton}
            data-testid="submit-assessment-form"
            onClick={() => submitForm("assessment")}
          >
            Submit passing assessment attempt
          </button>
        </div>
      </section>
    </main>
  );
}
