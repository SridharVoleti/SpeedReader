import { describe, expect, it } from "vitest";
import {
  ConfirmationTracker,
  isReadyToCertify,
  recordConfirmation,
  startConfirmationTracker
} from "../../lib/certification";

// SR-R2-002: Independent confirmation.
// "Require configurable valid independent forms before certifying WPM."
// "One success cannot certify when confirmations>1; same form/version cannot count repeatedly as
//  independent." (TC-R2-002-B: "Duplicate form cannot confirm" - pass the same form/version 3
//  times with 3 confirmations required -> rate remains uncertified.)
describe("independent confirmation tracking", () => {
  it("does not certify from a single success when more than one confirmation is required", () => {
    let tracker = startConfirmationTracker(150, 2);
    tracker = recordConfirmation(tracker, "form-a", true);

    expect(isReadyToCertify(tracker)).toBe(false);
  });

  it("passing the same form/version repeatedly never counts as independent confirmations (TC-R2-002-B)", () => {
    let tracker: ConfirmationTracker = startConfirmationTracker(150, 3);
    tracker = recordConfirmation(tracker, "form-a", true);
    tracker = recordConfirmation(tracker, "form-a", true);
    tracker = recordConfirmation(tracker, "form-a", true);

    expect(tracker.confirmedFormIds).toEqual(["form-a"]);
    expect(isReadyToCertify(tracker)).toBe(false);
  });

  it("certifies once enough distinct forms have each passed independently", () => {
    let tracker = startConfirmationTracker(150, 3);
    tracker = recordConfirmation(tracker, "form-a", true);
    tracker = recordConfirmation(tracker, "form-b", true);
    expect(isReadyToCertify(tracker)).toBe(false);

    tracker = recordConfirmation(tracker, "form-c", true);
    expect(isReadyToCertify(tracker)).toBe(true);
  });

  it("does not count a failed confirmation toward the total, distinct form or not", () => {
    let tracker = startConfirmationTracker(150, 2);
    tracker = recordConfirmation(tracker, "form-a", false);
    tracker = recordConfirmation(tracker, "form-b", false);

    expect(tracker.confirmedFormIds).toEqual([]);
    expect(isReadyToCertify(tracker)).toBe(false);
  });

  it("the required confirmation count is configurable, not hard-coded", () => {
    const single = startConfirmationTracker(150, 1);
    const many = startConfirmationTracker(150, 5);
    expect(single.requiredConfirmations).toBe(1);
    expect(many.requiredConfirmations).toBe(5);

    expect(isReadyToCertify(recordConfirmation(single, "form-a", true))).toBe(true);
  });

  it("is deterministic for identical inputs", () => {
    const tracker = startConfirmationTracker(150, 2);
    expect(recordConfirmation(tracker, "form-a", true)).toEqual(recordConfirmation(tracker, "form-a", true));
  });
});
