import { describe, expect, it } from "vitest";
import { RECENCY_POLICY_V1, applyRecency, evidenceRecency, validateRecencyPolicy, type DatedReadiness, type RecencyPolicy } from "../../../lib/v2/evidence-recency";
import { world1Status } from "../../../lib/v2/world1-completion";
import { RS_IDS } from "../../../lib/world1-framework";

const NOW = "2026-10-03T00:00:00Z";
const fresh = (rsId: (typeof RS_IDS)[number], over: Partial<DatedReadiness> = {}): DatedReadiness => ({
  rsId, confirmed: true, formId: `form-${rsId}-v1`, gatheredAt: "2026-09-20T00:00:00Z", sessionsSince: 5, ...over
});

// FR-045 - Evidence recency [FROZEN PRINCIPLE / PROVISIONAL_PILOT PARAMETER]
describe("FR-045 evidence recency", () => {
  it("has a recency rule: the shipped policy is finite, versioned, audited and PROVISIONAL_PILOT", () => {
    expect(validateRecencyPolicy(RECENCY_POLICY_V1)).toEqual([]);
    expect(RECENCY_POLICY_V1.status).toBe("PROVISIONAL_PILOT");
    expect(Number.isFinite(RECENCY_POLICY_V1.maxAgeDays)).toBe(true);
    expect(RECENCY_POLICY_V1.version).toMatch(/recency/);
  });

  it("recent evidence is current", () => {
    expect(evidenceRecency({ gatheredAt: "2026-09-20T00:00:00Z", sessionsSince: 5 }, NOW)).toEqual({ current: true, reasons: [], policyVersion: RECENCY_POLICY_V1.version });
  });

  it("very old evidence is not valid indefinitely (calendar threshold)", () => {
    const v = evidenceRecency({ gatheredAt: "2025-01-01T00:00:00Z", sessionsSince: 0 }, NOW);
    expect(v.current).toBe(false);
    expect(v.reasons[0]).toMatch(/^AGE_\d+D_EXCEEDS_180D$/);
  });

  it("evidence made stale by inactivity/session count is also not current", () => {
    const v = evidenceRecency({ gatheredAt: "2026-09-30T00:00:00Z", sessionsSince: 500 }, NOW);
    expect(v).toMatchObject({ current: false, reasons: ["SESSIONS_500_EXCEEDS_120"] });
  });

  it("is exact at the boundary", () => {
    const edge = evidenceRecency({ gatheredAt: "2026-04-06T00:00:00Z", sessionsSince: 120 }, NOW); // 180 days
    expect(edge.current).toBe(true);
    expect(evidenceRecency({ gatheredAt: "2026-04-05T00:00:00Z", sessionsSince: 120 }, NOW).current).toBe(false);
  });

  it("refuses a policy with no finite threshold, no version or no audit record", () => {
    const base: RecencyPolicy = { ...RECENCY_POLICY_V1 };
    expect(validateRecencyPolicy({ ...base, maxAgeDays: Infinity, maxSessionsSince: Infinity }).join()).toMatch(/indefinitely/);
    expect(validateRecencyPolicy({ ...base, version: "" })).toContain("recency policy needs a version");
    expect(validateRecencyPolicy({ ...base, audit: { changedAt: "", reason: "", changedBy: "" } })).toContain("recency policy needs an audit record");
    expect(() => evidenceRecency({ gatheredAt: NOW, sessionsSince: 0 }, NOW, { ...base, version: "" })).toThrow(/invalid recency policy/);
  });

  it("records which policy version judged the evidence (versioned and auditable)", () => {
    const alt: RecencyPolicy = { ...RECENCY_POLICY_V1, version: "recency-alt", maxAgeDays: 30 };
    const v = evidenceRecency({ gatheredAt: "2026-08-01T00:00:00Z", sessionsSince: 0 }, NOW, alt);
    expect(v.policyVersion).toBe("recency-alt");
    expect(v.current).toBe(false);
  });

  it("stale readiness evidence stops counting toward World 1 completion until revalidated", () => {
    const readiness = RS_IDS.map((rs) => fresh(rs));
    expect(world1Status({ canonicalPointer: 1501, readiness: applyRecency(readiness, NOW) })).toEqual({ status: "WORLD1_COMPLETE" });
    readiness[5] = fresh("RS06", { gatheredAt: "2025-01-01T00:00:00Z" });
    const after = world1Status({ canonicalPointer: 1501, readiness: applyRecency(readiness, NOW) });
    expect(after).toEqual({ status: "SEQUENCE_COMPLETE_READINESS_PENDING", missingReadiness: ["RS06"] });
  });

  it("rejects timestamps in the future or unparseable", () => {
    expect(() => evidenceRecency({ gatheredAt: "2027-01-01T00:00:00Z", sessionsSince: 0 }, NOW)).toThrow(RangeError);
    expect(() => evidenceRecency({ gatheredAt: "not-a-date", sessionsSince: 0 }, NOW)).toThrow(RangeError);
  });
});
