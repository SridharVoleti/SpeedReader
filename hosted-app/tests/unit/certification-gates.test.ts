import { describe, expect, it } from "vitest";
import {
  allGatesPassed,
  ConfirmationTracker,
  GateResults,
  recordConfirmationWithGates,
  startConfirmationTracker
} from "../../lib/certification";

// SR-R2-003: Certification gate composition.
// "Require exposure validity + comprehension PASS + evidence sufficiency for every required
//  confirmation."
// "Any required gate failure blocks certification; INVALID does not count as learner failure."
// (TC-R2-003-B: "One confirmation fails comprehension" - two valid passes + one valid
//  comprehension fail -> no target certification; prior CRR intact.)
function allPassingGates(): GateResults {
  return { exposureValid: true, comprehensionPassed: true, evidenceSufficient: true };
}

describe("allGatesPassed", () => {
  it("requires every gate to pass, not a majority or average", () => {
    expect(allGatesPassed(allPassingGates())).toBe(true);
    expect(allGatesPassed({ ...allPassingGates(), exposureValid: false })).toBe(false);
    expect(allGatesPassed({ ...allPassingGates(), comprehensionPassed: false })).toBe(false);
    expect(allGatesPassed({ ...allPassingGates(), evidenceSufficient: false })).toBe(false);
  });
});

describe("recordConfirmationWithGates", () => {
  it("does not count a confirmation when comprehension fails, even with valid exposure and evidence (TC-R2-003-B)", () => {
    let tracker: ConfirmationTracker = startConfirmationTracker(150, 3);
    tracker = recordConfirmationWithGates(tracker, "form-a", allPassingGates());
    tracker = recordConfirmationWithGates(tracker, "form-b", allPassingGates());
    tracker = recordConfirmationWithGates(tracker, "form-c", {
      exposureValid: true,
      comprehensionPassed: false,
      evidenceSufficient: true
    });

    expect(tracker.confirmedFormIds).toEqual(["form-a", "form-b"]);
    expect(tracker.confirmedFormIds.length).toBeLessThan(tracker.requiredConfirmations);
  });

  it("blocks the confirmation when exposure was invalid, even with comprehension PASS and sufficient evidence", () => {
    let tracker = startConfirmationTracker(150, 1);
    tracker = recordConfirmationWithGates(tracker, "form-a", {
      exposureValid: false,
      comprehensionPassed: true,
      evidenceSufficient: true
    });

    expect(tracker.confirmedFormIds).toEqual([]);
  });

  it("blocks the confirmation when evidence is insufficient, even with valid exposure and comprehension PASS", () => {
    let tracker = startConfirmationTracker(150, 1);
    tracker = recordConfirmationWithGates(tracker, "form-a", {
      exposureValid: true,
      comprehensionPassed: true,
      evidenceSufficient: false
    });

    expect(tracker.confirmedFormIds).toEqual([]);
  });

  it("treats an invalid-exposure attempt the same as any other non-passing attempt - no extra penalty", () => {
    const tracker = startConfirmationTracker(150, 3);
    const afterInvalid = recordConfirmationWithGates(tracker, "form-a", {
      exposureValid: false,
      comprehensionPassed: true,
      evidenceSufficient: true
    });
    const afterComprehensionFail = recordConfirmationWithGates(tracker, "form-a", {
      exposureValid: true,
      comprehensionPassed: false,
      evidenceSufficient: true
    });

    // Neither counts - INVALID exposure is not singled out as a harsher "learner failure".
    expect(afterInvalid).toEqual(afterComprehensionFail);
    expect(afterInvalid).toEqual(tracker);
  });

  it("still counts a confirmation once all three gates genuinely pass", () => {
    let tracker = startConfirmationTracker(150, 1);
    tracker = recordConfirmationWithGates(tracker, "form-a", allPassingGates());
    expect(tracker.confirmedFormIds).toEqual(["form-a"]);
  });
});
