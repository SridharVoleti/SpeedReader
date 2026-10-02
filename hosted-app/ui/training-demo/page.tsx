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
  selectNextForm,
  TrainingActivity
} from "../../lib/training";
import styles from "../page.module.css";

// SR-R6-003: No meaningless repetition.
const MULTI_FORM_POOL = ["form-a", "form-b", "form-c"];
const SOLO_FORM_POOL = ["form-solo"];

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

  // SR-R6-003: No meaningless repetition.
  const [lastMultiFormId, setLastMultiFormId] = useState<string | null>(null);
  const multiFormSelection = selectNextForm(MULTI_FORM_POOL, lastMultiFormId);

  const [lastSoloFormId, setLastSoloFormId] = useState<string | null>(null);
  const soloFormSelection = selectNextForm(SOLO_FORM_POOL, lastSoloFormId);

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

      <section className={styles.stageCard} data-testid="no-meaningless-repetition">
        <p className={styles.kicker}>No meaningless repetition (SR-R6-003)</p>
        <p className={styles.stageHint}>
          The immediately-prior form is never reused while an alternative exists. Only when the
          pool is exhausted to a single form is reuse allowed, and only with a logged reason.
        </p>

        <p data-testid="selected-form">Selected form: {multiFormSelection.formId ?? "none"}</p>
        <p data-testid="reuse-reason">Reuse reason: {multiFormSelection.reuseReason ?? "none"}</p>
        <div className={styles.actions}>
          <button
            type="button"
            className={styles.primaryButton}
            data-testid="use-next-form"
            onClick={() => setLastMultiFormId(multiFormSelection.formId)}
          >
            Use next form (3-form pool)
          </button>
        </div>

        <p data-testid="solo-selected-form">Selected form: {soloFormSelection.formId ?? "none"}</p>
        <p data-testid="solo-reuse-reason">Reuse reason: {soloFormSelection.reuseReason ?? "none"}</p>
        <div className={styles.actions}>
          <button
            type="button"
            className={styles.secondaryButton}
            data-testid="use-next-form-solo"
            onClick={() => setLastSoloFormId(soloFormSelection.formId)}
          >
            Use next form (1-form pool)
          </button>
        </div>
      </section>
    </main>
  );
}
