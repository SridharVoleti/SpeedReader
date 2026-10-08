import { describe, expect, it } from "vitest";
import { INACTIVITY_POLICY, evidenceFreshness, certifyFromEvidence } from "../../../lib/sr/inactivity";

const D = (iso: string) => new Date(iso);
describe("SR-005 stale evidence after two weeks inactivity", () => {
  const last = D("2026-10-01T09:00:00Z");
  it("policy is provisional and names its boundary convention", () => {
    expect(INACTIVITY_POLICY).toMatchObject({ inactiveDays: 14, status: "PROVISIONAL_PILOT", boundary: "STALE_AT_COMPLETE_DAYS" });
  });
  it("13 complete days is fresh", () => {
    expect(evidenceFreshness(last, D("2026-10-14T09:00:00Z")).state).toBe("FRESH");
    expect(evidenceFreshness(last, D("2026-10-15T08:59:59Z")).state).toBe("FRESH");
  });
  it("exactly 14 complete days is stale under the default convention", () => {
    expect(evidenceFreshness(last, D("2026-10-15T09:00:00Z")).state).toBe("STALE");
  });
  it("the alternative convention (stale only after 14 days) is selectable", () => {
    const p = { ...INACTIVITY_POLICY, boundary: "STALE_AFTER_COMPLETE_DAYS" as const };
    expect(evidenceFreshness(last, D("2026-10-15T09:00:00Z"), p).state).toBe("FRESH");
    expect(evidenceFreshness(last, D("2026-10-15T09:00:01Z"), p).state).toBe("STALE");
  });
  it("reports complete inactive days", () => {
    expect(evidenceFreshness(last, D("2026-10-20T10:00:00Z")).completeDays).toBe(19);
  });
  it("no silent certification from stale evidence", () => {
    expect(certifyFromEvidence({ confirmed: true }, "STALE")).toEqual({ certified: false, reason: "STALE_EVIDENCE_REQUIRES_REVALIDATION" });
    expect(certifyFromEvidence({ confirmed: true }, "FRESH")).toEqual({ certified: true });
  });
  it("rejects a last-activity time in the future", () => {
    expect(() => evidenceFreshness(D("2026-11-01T00:00:00Z"), D("2026-10-01T00:00:00Z"))).toThrow();
  });
});
