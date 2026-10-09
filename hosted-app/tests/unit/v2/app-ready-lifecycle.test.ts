import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  ATTEMPT_OUTCOMES, ATTEMPT_ROLES, applyReadinessAttempt, completeRemediation, dueForRevalidation, expectedRole,
  isReadinessConfirmed, newReadinessStream, nextForm, type AttemptOutcome, type AttemptRole, type ProtectedRole, type ReadinessAttempt, type ReadinessStream
} from "../../../lib/v2/readiness-lifecycle";

let n = 0;
const att = (role: AttemptRole, outcome: AttemptOutcome, over: Partial<ReadinessAttempt> = {}): ReadinessAttempt => {
  n += 1;
  return { registryPassageId: "REG-RS03-P7", formFamilyId: "FAM-RS03", assessmentFormId: `form-${n}`, deliveryEventId: `ev-${n}`, attemptId: `at-${n}`, role, outcome, at: `2026-10-0${(n % 9) + 1}T10:00:00Z`, ...over };
};
const ok = (s: ReadinessStream, a: ReadinessAttempt) => {
  const r = applyReadinessAttempt(s, a);
  if (!r.ok) throw new Error(r.error);
  return r.stream;
};
const fresh = () => newReadinessStream("kid", "RS03");

describe("APP-READY-003/004 ontology", () => {
  it("supports the five outcomes and six roles", () => {
    expect([...ATTEMPT_OUTCOMES]).toEqual(["PASS", "FAIL", "TECHNICAL_INVALID", "INSUFFICIENT_EVIDENCE", "INVALID_FORM"]);
    expect([...ATTEMPT_ROLES]).toEqual(["PRIMARY", "NEW_CYCLE_PRIMARY", "CONFIRMATION", "NEW_CYCLE_CONFIRMATION", "TECHNICAL_REPLACEMENT", "REVALIDATION"]);
  });
  it("technical, evidence and form invalidity are not learner failure", () => {
    for (const o of ["TECHNICAL_INVALID", "INSUFFICIENT_EVIDENCE", "INVALID_FORM"] as const) {
      const r = applyReadinessAttempt(fresh(), att("PRIMARY", o));
      expect(r).toMatchObject({ ok: true, learnerFailure: false });
    }
    expect(applyReadinessAttempt(fresh(), att("PRIMARY", "FAIL"))).toMatchObject({ ok: true, learnerFailure: true });
  });
});

describe("APP-READY-005 initial confirmation cannot be skipped", () => {
  it("a PRIMARY pass moves to CONFIRMATION, not CONFIRMED", () => {
    const s = ok(fresh(), att("PRIMARY", "PASS"));
    expect(s.phase).toBe("CONFIRMATION_DUE");
    expect(isReadinessConfirmed(s)).toBe(false);
  });
  it("only a CONFIRMATION pass closes the stream and sets the anchor", () => {
    const s = ok(ok(fresh(), att("PRIMARY", "PASS")), att("CONFIRMATION", "PASS", { at: "2026-10-09T10:00:00Z" }));
    expect(s).toMatchObject({ phase: "CONFIRMED", confirmedAt: "2026-10-09T10:00:00Z" });
    expect(isReadinessConfirmed(s)).toBe(true);
  });
  it("a CONFIRMATION attempt cannot be submitted first, and roles must match the due slot", () => {
    expect(applyReadinessAttempt(fresh(), att("CONFIRMATION", "PASS"))).toMatchObject({ ok: false, error: expect.stringMatching(/expected role PRIMARY/) });
    expect(applyReadinessAttempt(fresh(), att("REVALIDATION", "PASS")).ok).toBe(false);
  });
});

describe("APP-READY-006 no retry lottery", () => {
  it("a valid failure requires remediation and offers no fresh form until then", () => {
    const failed = ok(fresh(), att("PRIMARY", "FAIL"));
    expect(failed.phase).toBe("REMEDIATION_REQUIRED");
    expect(expectedRole(failed)).toBeNull();
    expect(nextForm(failed, ["f-a", "f-b", "f-c"])).toBeNull();
    expect(applyReadinessAttempt(failed, att("PRIMARY", "PASS"))).toMatchObject({ ok: false });
    expect(applyReadinessAttempt(failed, att("NEW_CYCLE_PRIMARY", "PASS"))).toMatchObject({ ok: false });
  });
  it("after remediation a NEW cycle runs primary then confirmation, and all results stay in history", () => {
    let s = ok(fresh(), att("PRIMARY", "FAIL"));
    s = completeRemediation(s);
    expect(s).toMatchObject({ phase: "NEW_CYCLE_PRIMARY_DUE", cycle: 2 });
    s = ok(s, att("NEW_CYCLE_PRIMARY", "PASS"));
    expect(s.phase).toBe("NEW_CYCLE_CONFIRMATION_DUE");
    s = ok(s, att("NEW_CYCLE_CONFIRMATION", "PASS"));
    expect(s.phase).toBe("CONFIRMED");
    expect(s.history.map((h) => h.outcome)).toEqual(["FAIL", "PASS", "PASS"]);
  });
  it("a failed confirmation also needs remediation and a new cycle", () => {
    const s = ok(ok(fresh(), att("PRIMARY", "PASS")), att("CONFIRMATION", "FAIL"));
    expect(s.phase).toBe("REMEDIATION_REQUIRED");
  });
  it("remediation cannot be 'completed' when none is pending", () => {
    expect(() => completeRemediation(fresh())).toThrow(/not pending/);
  });
  it("a form can never be reused within a stream", () => {
    const s = ok(fresh(), att("PRIMARY", "TECHNICAL_INVALID", { assessmentFormId: "same" }));
    expect(applyReadinessAttempt(s, att("TECHNICAL_REPLACEMENT", "PASS", { replacesRole: "PRIMARY", assessmentFormId: "same" }))).toMatchObject({ ok: false, error: expect.stringMatching(/already used/) });
  });
  it("nextForm skips used forms and returns null when the approved group is exhausted", () => {
    const s = ok(fresh(), att("PRIMARY", "INVALID_FORM", { assessmentFormId: "f-a" }));
    expect(nextForm(s, ["f-a", "f-b"])).toBe("f-b");
    expect(nextForm(s, ["f-a"])).toBeNull();
  });
});

describe("APP-READY-007 technical replacement preserves lifecycle phase", () => {
  it.each(["TECHNICAL_INVALID", "INSUFFICIENT_EVIDENCE", "INVALID_FORM"] as const)("%s leaves the phase untouched and requires a same-role replacement", (outcome) => {
    const s = ok(ok(fresh(), att("PRIMARY", "PASS")), att("CONFIRMATION", outcome));
    expect(s.phase).toBe("CONFIRMATION_DUE");
    expect(s.pendingReplacement).toBe("CONFIRMATION");
    // the ordinary role is no longer accepted: the replacement must stand in for the protected slot
    expect(applyReadinessAttempt(s, att("CONFIRMATION", "PASS")).ok).toBe(false);
    const wrongSlot = applyReadinessAttempt(s, att("TECHNICAL_REPLACEMENT", "PASS", { replacesRole: "PRIMARY" }));
    expect(wrongSlot.ok).toBe(false);
    const done = ok(s, att("TECHNICAL_REPLACEMENT", "PASS", { replacesRole: "CONFIRMATION" }));
    expect(done.phase).toBe("CONFIRMED");
    expect(done.pendingReplacement).toBeNull();
  });
  it("a replacement that is itself technically invalid keeps the same pending slot", () => {
    let s = ok(fresh(), att("PRIMARY", "TECHNICAL_INVALID"));
    s = ok(s, att("TECHNICAL_REPLACEMENT", "INVALID_FORM", { replacesRole: "PRIMARY" }));
    expect(s).toMatchObject({ phase: "PRIMARY_DUE", pendingReplacement: "PRIMARY" });
    expect(s.history).toHaveLength(2);
  });
  it("a replacement that is a valid failure is a learner failure like any other", () => {
    const s = ok(fresh(), att("PRIMARY", "TECHNICAL_INVALID"));
    expect(applyReadinessAttempt(s, att("TECHNICAL_REPLACEMENT", "FAIL", { replacesRole: "PRIMARY" }))).toMatchObject({ ok: true, learnerFailure: true });
  });
});

describe("APP-READY-002 identity separation", () => {
  it("requires every separate identifier and refuses canonical-position consumption", () => {
    for (const k of ["registryPassageId", "formFamilyId", "assessmentFormId", "deliveryEventId", "attemptId"] as const) {
      expect(applyReadinessAttempt(fresh(), att("PRIMARY", "PASS", { [k]: "" })).ok, k).toBe(false);
    }
    const sneaky = { ...att("PRIMARY", "PASS"), canonicalSequence: 12 } as unknown as ReadinessAttempt;
    expect(applyReadinessAttempt(fresh(), sneaky)).toMatchObject({ ok: false, error: expect.stringMatching(/canonical/) });
  });
  it("rejects a duplicate attempt id (idempotent delivery)", () => {
    const s = ok(fresh(), att("PRIMARY", "PASS", { attemptId: "dup" }));
    expect(applyReadinessAttempt(s, att("CONFIRMATION", "PASS", { attemptId: "dup" }))).toMatchObject({ ok: false, error: expect.stringMatching(/already recorded/) });
  });
});

describe("APP-RECENCY-007 / APP-RECENCY-006 revalidation through the lifecycle", () => {
  const confirmed = () => ok(ok(fresh(), att("PRIMARY", "PASS")), att("CONFIRMATION", "PASS"));
  it("a clock trigger asks for one REVALIDATION form; a pass renews the anchor", () => {
    const due = dueForRevalidation(confirmed(), "INACTIVITY");
    expect(due).toMatchObject({ phase: "REVALIDATION_DUE", revalidationTrigger: "INACTIVITY" });
    const s = ok(due, att("REVALIDATION", "PASS", { at: "2026-12-01T10:00:00Z" }));
    expect(s).toMatchObject({ phase: "CONFIRMED", confirmedAt: "2026-12-01T10:00:00Z", revalidationTrigger: null });
  });
  it("a valid revalidation failure goes to remediation then a full new cycle", () => {
    const s = ok(dueForRevalidation(confirmed(), "CALENDAR_AGE"), att("REVALIDATION", "FAIL"));
    expect(s.phase).toBe("REMEDIATION_REQUIRED");
    expect(completeRemediation(s).phase).toBe("NEW_CYCLE_PRIMARY_DUE");
  });
  it("technical invalidity keeps revalidation pending with a same-role replacement", () => {
    const s = ok(dueForRevalidation(confirmed(), "SESSION_COUNT"), att("REVALIDATION", "TECHNICAL_INVALID"));
    expect(s).toMatchObject({ phase: "REVALIDATION_DUE", pendingReplacement: "REVALIDATION" });
  });
  it("version invalidation needs a new compatible cycle - never the one-form shortcut", () => {
    const s = dueForRevalidation(confirmed(), "VERSION_INVALIDATED");
    expect(s).toMatchObject({ phase: "NEW_CYCLE_PRIMARY_DUE", confirmedAt: null });
    expect(isReadinessConfirmed(s)).toBe(false);
    expect(applyReadinessAttempt(s, att("REVALIDATION", "PASS")).ok).toBe(false);
  });
  it("a trigger on a stream that is not confirmed changes nothing", () => {
    const f = fresh();
    expect(dueForRevalidation(f, "INACTIVITY")).toBe(f);
  });
});

describe("APP-READY-008 core progression precedence", () => {
  it("the lifecycle imports nothing from core WPM progression or News Reader and is never an input to them", () => {
    const src = readFileSync("hosted-app/lib/v2/readiness-lifecycle.ts", "utf8");
    const imports = [...src.matchAll(/from\s+"([^"]+)"/g)].map((m) => m[1]);
    expect(imports).toEqual(["./evidence-recency"]);
    for (const core of ["core-wpm.ts", "first-five.ts", "learner-aggregate.ts", "news-reader.ts"]) {
      expect(readFileSync(`hosted-app/lib/v2/${core}`, "utf8")).not.toMatch(/readiness-lifecycle/);
    }
  });
  it("protected-role type has no replacement role", () => {
    const p: ProtectedRole[] = ["PRIMARY", "NEW_CYCLE_PRIMARY", "CONFIRMATION", "NEW_CYCLE_CONFIRMATION", "REVALIDATION"];
    expect(p).not.toContain("TECHNICAL_REPLACEMENT" as never);
  });
});
