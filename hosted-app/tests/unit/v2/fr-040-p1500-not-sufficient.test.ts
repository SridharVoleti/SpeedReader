import { describe, expect, it } from "vitest";
import { missingReadiness, sequenceComplete, world1Status, type ReadinessEvidence } from "../../../lib/v2/world1-completion";
import { RS_IDS } from "../../../lib/world1-framework";

const allReady = (): ReadinessEvidence[] => RS_IDS.map((rsId) => ({ rsId, confirmed: true, formId: `form-${rsId}-v1` }));

// FR-040 - Passage 1500 is not sufficient by itself [FROZEN] (AC-P26)
describe("FR-040 passage 1500 is not sufficient by itself", () => {
  it("completing P1500 completes the canonical sequence only", () => {
    expect(sequenceComplete(1500)).toBe(false); // P1500 is the next passage, not yet completed
    expect(sequenceComplete(1501)).toBe(true);
  });

  it("reaching P1500 without required readiness evidence does not certify World 1 mastery (AC-P26)", () => {
    const r = world1Status({ canonicalPointer: 1501, readiness: [] });
    expect(r.status).toBe("SEQUENCE_COMPLETE_READINESS_PENDING");
    if (r.status === "SEQUENCE_COMPLETE_READINESS_PENDING") expect(r.missingReadiness).toEqual([...RS_IDS]);
  });

  it("partial readiness is not enough: every canonical competency must be confirmed", () => {
    const readiness = allReady().slice(0, 14);
    const r = world1Status({ canonicalPointer: 1501, readiness });
    expect(r.status).toBe("SEQUENCE_COMPLETE_READINESS_PENDING");
    if (r.status === "SEQUENCE_COMPLETE_READINESS_PENDING") expect(r.missingReadiness).toEqual(["RS15"]);
  });

  it("unconfirmed evidence or evidence with no approved form does not count", () => {
    const readiness = allReady();
    readiness[3] = { ...readiness[3], confirmed: false };
    readiness[7] = { ...readiness[7], formId: "" };
    expect(missingReadiness(readiness)).toEqual(["RS04", "RS08"]);
  });

  it("completes World 1 only when the sequence is done AND all readiness is confirmed", () => {
    expect(world1Status({ canonicalPointer: 1501, readiness: allReady() })).toEqual({ status: "WORLD1_COMPLETE" });
  });

  it("full readiness without finishing the sequence is still in progress", () => {
    expect(world1Status({ canonicalPointer: 900, readiness: allReady() })).toEqual({ status: "IN_PROGRESS", passagesRemaining: 601 });
  });

  it("a learner who has not started has all 1500 passages remaining", () => {
    expect(world1Status({ canonicalPointer: 1, readiness: [] })).toEqual({ status: "IN_PROGRESS", passagesRemaining: 1500 });
  });
});
