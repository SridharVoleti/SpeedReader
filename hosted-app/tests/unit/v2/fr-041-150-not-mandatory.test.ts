import { describe, expect, it } from "vitest";
import { world1Status, type ReadinessEvidence } from "../../../lib/v2/world1-completion";
import { RS_IDS } from "../../../lib/world1-framework";
import { WORLD1_MAX_WPM, ceilingIsCompletionRequirement } from "../../../lib/v2/speed-ceiling";

const allReady = (): ReadinessEvidence[] => RS_IDS.map((rsId) => ({ rsId, confirmed: true, formId: `form-${rsId}-v1` }));

// FR-041 - 150 WPM is not mandatory [FROZEN] (AC-P25)
describe("FR-041 150 WPM is not mandatory", () => {
  it("a learner completes World 1 below 150 WPM when all other core requirements are met (AC-P25 fixture)", () => {
    for (const earnedWpm of [35, 60, 90, 120, 149]) {
      expect(world1Status({ canonicalPointer: 1501, readiness: allReady(), earnedWpm })).toEqual({ status: "WORLD1_COMPLETE" });
    }
  });

  it("completion decision is identical whatever WPM was earned", () => {
    const low = world1Status({ canonicalPointer: 1501, readiness: allReady(), earnedWpm: 40 });
    const ceiling = world1Status({ canonicalPointer: 1501, readiness: allReady(), earnedWpm: 150 });
    expect(low).toEqual(ceiling);
  });

  it("150 WPM is the ceiling, not a target: it is not a completion requirement", () => {
    expect(WORLD1_MAX_WPM).toBe(150);
    expect(ceilingIsCompletionRequirement()).toBe(false);
  });

  it("reaching 150 WPM does not complete World 1 when other requirements are unmet", () => {
    expect(world1Status({ canonicalPointer: 1501, readiness: [], earnedWpm: 150 }).status).toBe("SEQUENCE_COMPLETE_READINESS_PENDING");
    expect(world1Status({ canonicalPointer: 700, readiness: allReady(), earnedWpm: 150 }).status).toBe("IN_PROGRESS");
  });
});
