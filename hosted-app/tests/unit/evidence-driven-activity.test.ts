import { describe, expect, it } from "vitest";
import { LearnerProfile, selectNextActivity, TrainingActivity } from "../../lib/training";

// SR-R6-001: Evidence-driven next activity.
// "Select next activity from diagnosed needs and prerequisites."
// "Same learner profile yields same eligible activity/reason; only approved tagged content
//  selected."
const catalog: TrainingActivity[] = [
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
  },
  {
    activityId: "act-vocab-1",
    targetsRsId: "RS-VOCABULARY",
    approvalStatus: "APPROVED",
    prerequisiteActivityIds: []
  }
];

describe("selectNextActivity", () => {
  it("selects an approved activity targeting a diagnosed bottleneck", () => {
    const profile: LearnerProfile = { diagnosedBottleneckRsIds: ["RS-INFERENCE"], completedActivityIds: [] };

    const selection = selectNextActivity(profile, catalog);

    expect(selection.activityId).toBe("act-inference-1");
    expect(selection.selectionReason).toBe("TARGETS_BOTTLENECK_RS-INFERENCE");
  });

  it("never selects WIP or unapproved content, even when it targets a diagnosed bottleneck", () => {
    const wipOnlyCatalog: TrainingActivity[] = [catalog[0]]; // only the WIP activity
    const profile: LearnerProfile = { diagnosedBottleneckRsIds: ["RS-INFERENCE"], completedActivityIds: [] };

    const selection = selectNextActivity(profile, wipOnlyCatalog);

    expect(selection.activityId).toBeNull();
    expect(selection.selectionReason).toBe("NO_ELIGIBLE_ACTIVITY");
  });

  it("respects prerequisites - an activity is not eligible until its prerequisite is completed", () => {
    const profile: LearnerProfile = { diagnosedBottleneckRsIds: ["RS-INFERENCE"], completedActivityIds: [] };
    const selection = selectNextActivity(profile, [catalog[2]]); // only act-inference-2, prereq not met

    expect(selection.activityId).toBeNull();
    expect(selection.selectionReason).toBe("NO_ELIGIBLE_ACTIVITY");
  });

  it("becomes eligible once its prerequisite has been completed", () => {
    const profile: LearnerProfile = {
      diagnosedBottleneckRsIds: ["RS-INFERENCE"],
      completedActivityIds: ["act-inference-1"]
    };

    const selection = selectNextActivity(profile, catalog);

    expect(selection.activityId).toBe("act-inference-2");
  });

  it("never re-selects an activity the learner already completed", () => {
    const profile: LearnerProfile = {
      diagnosedBottleneckRsIds: ["RS-VOCABULARY"],
      completedActivityIds: ["act-vocab-1"]
    };

    const selection = selectNextActivity(profile, catalog);

    expect(selection.activityId).toBeNull();
  });

  it("is deterministic: the same learner profile always yields the same eligible activity and reason", () => {
    const profile: LearnerProfile = { diagnosedBottleneckRsIds: ["RS-INFERENCE"], completedActivityIds: [] };
    expect(selectNextActivity(profile, catalog)).toEqual(selectNextActivity(profile, catalog));
  });
});
