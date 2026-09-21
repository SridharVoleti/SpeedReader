"use client";

// SR-R6-001: Evidence-driven next activity.
// A reachable demo: a diagnosed bottleneck (RS-INFERENCE) selects the correct approved,
// prerequisite-satisfying activity, ignoring WIP content and already-completed activities.

import { useState } from "react";
import { LearnerProfile, selectNextActivity, TrainingActivity } from "../../lib/training";
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

export default function TrainingDemoPage() {
  const [completedActivityIds, setCompletedActivityIds] = useState<string[]>([]);
  const profile: LearnerProfile = { diagnosedBottleneckRsIds: ["RS-INFERENCE"], completedActivityIds };
  const selection = selectNextActivity(profile, CATALOG);

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
    </main>
  );
}
