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
