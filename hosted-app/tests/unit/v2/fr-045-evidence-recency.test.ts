import { describe, expect, it } from "vitest";
import {
  RECENCY_POLICY_V1,
  applyRecency,
  evidenceRecency,
  revalidationOutcome,
  validateRecencyPolicy,
  type DatedReadiness,
  type EvidenceVersions,
  type RecencyPolicy
} from "../../../lib/v2/evidence-recency";
import { THRESHOLD_REGISTRY } from "../../../lib/v2/threshold-lifecycle";
import { world1Status } from "../../../lib/v2/world1-completion";
import { RS_IDS } from "../../../lib/world1-framework";

const NOW = "2026-10-03T12:00:00Z";
const daysBefore = (n: number, from = NOW) => new Date(Date.parse(from) - n * 86_400_000).toISOString();
const fresh = (rsId: (typeof RS_IDS)[number], over: Partial<DatedReadiness> = {}): DatedReadiness => ({
  rsId, confirmed: true, formId: `form-${rsId}-v1`, gatheredAt: "2026-09-30T12:00:00Z", sessionsSince: 5, ...over
});
const V: EvidenceVersions = { scoring: "s1", threshold: "t1", tokenizer: "k1", evidenceRules: "e1" };

// FR-045 / APP-RECENCY-001..008 - Evidence recency
describe("FR-045 evidence recency", () => {
  it("has a recency rule: the shipped policy is finite, versioned, audited and PROVISIONAL_PILOT (APP-RECENCY-001/003)", () => {
    expect(validateRecencyPolicy(RECENCY_POLICY_V1)).toEqual([]);
    expect(RECENCY_POLICY_V1).toMatchObject({ status: "PROVISIONAL_PILOT", maxAgeDays: 56, maxSessionsSince: 16, inactiveDays: 14 });
    expect(RECENCY_POLICY_V1.version).toMatch(/recency/);
  });

  it("the historical 28-day inactivity default is absent (AC-A14) and the values live in the threshold registry", () => {
    expect(RECENCY_POLICY_V1.inactiveDays).not.toBe(28);
    const keys = Object.fromEntries(THRESHOLD_REGISTRY.map((t) => [t.key, t.value]));
    expect(keys["recency-max-age-days"]).toBe(56);
    expect(keys["recency-max-sessions"]).toBe(16);
    expect(keys["recency-inactive-days"]).toBe(14);
  });

  it("recent evidence is current and carries a full audit record (APP-RECENCY-008)", () => {
    const v = evidenceRecency({ gatheredAt: "2026-09-30T12:00:00Z", sessionsSince: 5 }, NOW);
    expect(v).toMatchObject({ current: true, reasons: [], triggers: [], firstTrigger: null, revalidation: "NONE", policyVersion: RECENCY_POLICY_V1.version });
    expect(v.audit).toEqual({
      anchorAt: "2026-09-30T12:00:00Z", evaluatedAt: NOW, timeZone: "UTC",
      anchorLocalDate: "2026-09-30", evaluationLocalDate: "2026-10-03",
      completedCalendarDays: 2, sessionsSince: 5, completedInactiveDays: 2
    });
  });

  describe("inactivity 13/14/15 complete-day boundary (AC-A14)", () => {
    // last activity N+1 local dates ago => N complete inactive days
    const at = (completeDays: number) => evidenceRecency({ gatheredAt: daysBefore(2), lastActivityAt: daysBefore(completeDays + 1), sessionsSince: 0 }, NOW);
    it("13 complete days is not due", () => expect(at(13).current).toBe(true));
    it("14 complete days is due", () => {
      const v = at(14);
      expect(v.current).toBe(false);
      expect(v.firstTrigger).toBe("INACTIVITY");
      expect(v.reasons).toEqual(["INACTIVE_14D_REACHES_14D"]);
    });
    it("15 complete days is due", () => expect(at(15).triggers).toEqual(["INACTIVITY"]));
  });

  describe("session boundary 16/17 (APP-RECENCY-003)", () => {
    const s = (n: number) => evidenceRecency({ gatheredAt: daysBefore(3), sessionsSince: n }, NOW);
    it("16 subsequent sessions is still current", () => expect(s(16).current).toBe(true));
    it("17 subsequent sessions is due", () => expect(s(17)).toMatchObject({ current: false, firstTrigger: "SESSION_COUNT", reasons: ["SESSIONS_17_EXCEEDS_16"] }));
  });

  describe("calendar boundary 56/57 completed days (APP-RECENCY-003)", () => {
    // anchor N+1 local dates ago => N completed calendar days; activity kept recent so only the age clock can fire
    const a = (completeDays: number) => evidenceRecency({ gatheredAt: daysBefore(completeDays + 1), lastActivityAt: daysBefore(1), sessionsSince: 0 }, NOW);
    it("56 completed days is still current", () => expect(a(56).current).toBe(true));
    it("57 completed days is due", () => expect(a(57)).toMatchObject({ current: false, firstTrigger: "CALENDAR_AGE", reasons: ["AGE_57D_EXCEEDS_56D"] }));
  });

  it("each clock fires independently and every fired clock is listed with the precedence trigger stored (AC-A15)", () => {
    const only = (over: Partial<Parameters<typeof evidenceRecency>[0]>) => evidenceRecency({ gatheredAt: daysBefore(3), lastActivityAt: daysBefore(1), sessionsSince: 0, ...over }, NOW).triggers;
    expect(only({ gatheredAt: daysBefore(90), lastActivityAt: daysBefore(1) })).toEqual(["CALENDAR_AGE"]);
    expect(only({ sessionsSince: 40 })).toEqual(["SESSION_COUNT"]);
    expect(only({ lastActivityAt: daysBefore(30) })).toEqual(["INACTIVITY"]);
    const all = evidenceRecency({ gatheredAt: daysBefore(90), lastActivityAt: daysBefore(30), sessionsSince: 40 }, NOW);
    expect(all.triggers).toEqual(["CALENDAR_AGE", "SESSION_COUNT", "INACTIVITY"]);
    expect(all.firstTrigger).toBe("CALENDAR_AGE");
  });

  it("uses the learner-local calendar date, not the UTC date (APP-RECENCY-008 date basis)", () => {
    // 2026-10-03T20:00Z is already 2026-10-04 in Singapore; last activity 2026-09-19T20:00Z is 2026-09-20 there.
    const now = "2026-10-03T20:00:00Z";
    const base = { gatheredAt: "2026-09-19T20:00:00Z", sessionsSince: 0 };
    const sgt = evidenceRecency({ ...base, timeZone: "Asia/Singapore" }, now);
    const utc = evidenceRecency(base, now);
    expect(sgt.audit).toMatchObject({ anchorLocalDate: "2026-09-20", evaluationLocalDate: "2026-10-04", completedInactiveDays: 13 });
    expect(utc.audit).toMatchObject({ anchorLocalDate: "2026-09-19", evaluationLocalDate: "2026-10-03", completedInactiveDays: 13 });
    const next = evidenceRecency({ ...base, timeZone: "Asia/Singapore" }, "2026-10-04T20:00:00Z");
    expect(next.triggers).toContain("INACTIVITY");
  });

  describe("version invalidation has precedence (APP-RECENCY-006 / AC-A16)", () => {
    it("invalidates even when no clock has fired and demands a new compatible cycle", () => {
      const v = evidenceRecency({ gatheredAt: daysBefore(1), sessionsSince: 0, versions: V }, NOW, RECENCY_POLICY_V1, { ...V, tokenizer: "k2" });
      expect(v).toMatchObject({ current: false, firstTrigger: "VERSION_INVALIDATED", revalidation: "NEW_COMPATIBLE_CYCLE", reasons: ["VERSION_INVALIDATED_tokenizer"] });
    });
    it("takes precedence over a clock trigger", () => {
      const v = evidenceRecency({ gatheredAt: daysBefore(90), lastActivityAt: daysBefore(1), sessionsSince: 0, versions: V }, NOW, RECENCY_POLICY_V1, { ...V, scoring: "s2", threshold: "t2" });
      expect(v.firstTrigger).toBe("VERSION_INVALIDATED");
      expect(v.triggers).toEqual(["VERSION_INVALIDATED", "CALENDAR_AGE"]);
      expect(v.reasons[0]).toBe("VERSION_INVALIDATED_scoring+threshold");
    });
    it("matching versions do not invalidate", () => {
      expect(evidenceRecency({ gatheredAt: daysBefore(1), sessionsSince: 0, versions: V }, NOW, RECENCY_POLICY_V1, V).current).toBe(true);
    });
  });

  describe("revalidation outcomes (APP-RECENCY-007)", () => {
    it("valid pass renews evidence with a new anchor", () =>
      expect(revalidationOutcome("CALENDAR_AGE", "VALID_PASS")).toEqual({ state: "CURRENT_NEW_ANCHOR", replaceEvidenceOrForm: false }));
    it("valid failure goes to remediation then a full new cycle", () =>
      expect(revalidationOutcome("INACTIVITY", "VALID_FAILURE").state).toBe("REMEDIATION_THEN_NEW_CYCLE"));
    it.each(["TECHNICAL_INVALID", "INSUFFICIENT_EVIDENCE", "INVALID_FORM"] as const)("%s keeps revalidation pending and replaces evidence/form", (attempt) =>
      expect(revalidationOutcome("SESSION_COUNT", attempt)).toEqual({ state: "REVALIDATION_PENDING", replaceEvidenceOrForm: true }));
    it("a version-invalidated stream can never be renewed by a single-form pass", () =>
      expect(revalidationOutcome("VERSION_INVALIDATED", "VALID_PASS").state).toBe("NEW_COMPATIBLE_CYCLE_REQUIRED"));
  });

  it("refuses a policy with no finite threshold, no version or no audit record", () => {
    const base: RecencyPolicy = { ...RECENCY_POLICY_V1 };
    expect(validateRecencyPolicy({ ...base, maxAgeDays: Infinity, maxSessionsSince: Infinity, inactiveDays: Infinity }).join()).toMatch(/indefinitely/);
    expect(validateRecencyPolicy({ ...base, version: "" })).toContain("recency policy needs a version");
    expect(validateRecencyPolicy({ ...base, audit: { changedAt: "", reason: "", changedBy: "" } })).toContain("recency policy needs an audit record");
    expect(() => evidenceRecency({ gatheredAt: NOW, sessionsSince: 0 }, NOW, { ...base, version: "" })).toThrow(/invalid recency policy/);
  });

  it("records which policy version judged the evidence (versioned and auditable)", () => {
    const alt: RecencyPolicy = { ...RECENCY_POLICY_V1, version: "recency-alt", maxAgeDays: 30 };
    const v = evidenceRecency({ gatheredAt: daysBefore(45), lastActivityAt: daysBefore(1), sessionsSince: 0 }, NOW, alt);
    expect(v.policyVersion).toBe("recency-alt");
    expect(v.current).toBe(false);
  });

  it("stale readiness evidence stops counting toward World 1 completion until revalidated; streams stay independent (APP-RECENCY-004)", () => {
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
