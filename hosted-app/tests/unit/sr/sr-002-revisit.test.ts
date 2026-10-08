import { describe, expect, it } from "vitest";
import { emptyRevisitState, recordPassageOutcome, revisitCandidates, scheduleRevisit, completeRevisit } from "../../../lib/sr/revisit";

describe("SR-002 revisit struggled passages", () => {
  it("a struggled passage becomes revisit-eligible; a success does not", () => {
    let s = emptyRevisitState();
    s = recordPassageOutcome(s, "p1", "NOT_GREEN");
    s = recordPassageOutcome(s, "p2", "GREEN");
    expect(revisitCandidates(s)).toEqual(["p1"]);
  });
  it("scheduling a revisit does not remove the next new passage", () => {
    let s = recordPassageOutcome(emptyRevisitState(), "p1", "NOT_GREEN");
    const plan = scheduleRevisit(s, "p1", "p9");
    expect(plan.revisit).toBe("p1");
    expect(plan.nextNew).toBe("p9");
  });
  it("revisit result is confidence practice and never substitutes readiness evidence", () => {
    let s = recordPassageOutcome(emptyRevisitState(), "p1", "NOT_GREEN");
    const done = completeRevisit(s, "p1", "GREEN");
    expect(done.state.struggled).not.toContain("p1");
    expect(done.evidence.countsAsReadinessEvidence).toBe(false);
    expect(done.evidence.kind).toBe("CONFIDENCE_REVISIT");
  });
  it("cannot schedule a passage that never struggled", () => {
    expect(() => scheduleRevisit(emptyRevisitState(), "pX", "p2")).toThrow();
  });
  it("state is immutable", () => {
    const s0 = emptyRevisitState();
    recordPassageOutcome(s0, "p1", "NOT_GREEN");
    expect(s0.struggled).toEqual([]);
  });
});
