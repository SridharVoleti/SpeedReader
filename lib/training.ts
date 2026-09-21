import { ConfirmationTracker, GateResults, recordConfirmationWithGates } from "./certification";

// SR-R6-001: Evidence-driven next activity.
// "Select next activity from diagnosed needs and prerequisites." "Same learner profile yields
// same eligible activity/reason; only approved tagged content selected." Selection is a pure
// function of the learner's diagnosed bottlenecks and completed activities against an authored
// catalog - never randomized, and never reaching past an unapproved activity.

export type TrainingActivity = {
  activityId: string;
  targetsRsId: string;
  approvalStatus: "WIP" | "APPROVED" | "RETIRED";
  prerequisiteActivityIds: string[];
};

export type LearnerProfile = {
  diagnosedBottleneckRsIds: string[];
  completedActivityIds: string[];
};

export type ActivitySelection = {
  activityId: string | null;
  selectionReason: string;
};

export function selectNextActivity(profile: LearnerProfile, catalog: TrainingActivity[]): ActivitySelection {
  const eligible = catalog.filter(
    (activity) =>
      activity.approvalStatus === "APPROVED" &&
      profile.diagnosedBottleneckRsIds.includes(activity.targetsRsId) &&
      !profile.completedActivityIds.includes(activity.activityId) &&
      activity.prerequisiteActivityIds.every((prerequisiteId) =>
        profile.completedActivityIds.includes(prerequisiteId)
      )
  );

  if (eligible.length === 0) {
    return { activityId: null, selectionReason: "NO_ELIGIBLE_ACTIVITY" };
  }

  const chosen = eligible[0];
  return { activityId: chosen.activityId, selectionReason: `TARGETS_BOTTLENECK_${chosen.targetsRsId}` };
}

// SR-R6-002: Remediation then independent reassessment.
// "Certification after remediation must use independent reassessment evidence." "Training
// result itself cannot count as independent confirmation unless explicitly approved for
// assessment." A training-purposed form is excluded from certification by default - remediation
// practice is not proof of independent mastery - unless a content author has explicitly marked
// that specific form as approved for assessment use (a deliberate, rare override).
export type FormPurpose = "training" | "assessment";

export type ReassessmentForm = {
  formId: string;
  formPurpose: FormPurpose;
  explicitlyApprovedForAssessment: boolean;
};

export function canCountAsIndependentConfirmation(form: ReassessmentForm): boolean {
  return form.formPurpose === "assessment" || form.explicitlyApprovedForAssessment;
}

export function recordConfirmationRespectingFormPurpose(
  tracker: ConfirmationTracker,
  form: ReassessmentForm,
  gates: GateResults
): ConfirmationTracker {
  if (!canCountAsIndependentConfirmation(form)) return tracker;
  return recordConfirmationWithGates(tracker, form.formId, gates);
}

// SR-R6-003: No meaningless repetition.
// "Repeated activities vary evidence/form while preserving target skill." "Immediate duplicate
// form reuse is rejected when alternatives exist; unavoidable reuse logs reason." The same form
// is never chosen again while a genuine alternative exists; only when it's the sole available
// form does reuse happen, and only with an explicit reason recorded.
export type FormSelection = {
  formId: string | null;
  reuseReason: string | null;
};

export function selectNextForm(availableFormIds: string[], lastUsedFormId: string | null): FormSelection {
  if (availableFormIds.length === 0) {
    return { formId: null, reuseReason: null };
  }

  const alternatives = availableFormIds.filter((formId) => formId !== lastUsedFormId);
  if (alternatives.length > 0) {
    return { formId: alternatives[0], reuseReason: null };
  }

  // The only available form is the one just used - reuse is unavoidable, and logged as such.
  return { formId: lastUsedFormId, reuseReason: "NO_ALTERNATIVE_FORM_AVAILABLE" };
}
