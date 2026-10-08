import { describe, expect, it } from "vitest";
import { newAttemptLog, revealBpc, startNextAttempt } from "../../../lib/sr/model-answer-support";

describe("SR-004 BPC is the only comprehension support", () => {
  it("BPC is withheld until the attempt has been submitted", () => {
    const log = newAttemptLog("p1");
    expect(revealBpc(log, { submitted: false, bpcApproved: true }).ok).toBe(false);
  });
  it("after an attempt it is shown and the exposure is logged", () => {
    const r = revealBpc(newAttemptLog("p1"), { submitted: true, bpcApproved: true });
    expect(r.ok).toBe(true);
    expect(r.log.exposures).toHaveLength(1);
  });
  it("unapproved BPC is never shown", () => {
    expect(revealBpc(newAttemptLog("p1"), { submitted: true, bpcApproved: false }).ok).toBe(false);
  });
  it("later attempts on the passage are tagged assisted, not first-independent", () => {
    const r = revealBpc(newAttemptLog("p1"), { submitted: true, bpcApproved: true });
    const next = startNextAttempt(r.log);
    expect(next.attemptRole).toBe("ASSISTED");
    expect(next.assisted).toBe(true);
    expect(startNextAttempt(newAttemptLog("p1")).attemptRole).toBe("FIRST_INDEPENDENT");
  });
});
