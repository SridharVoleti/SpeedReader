import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

// Issue #27: the traceability ledger must not overstate readiness.
const text = readFileSync("hosted-app/requirements/V3_TRACEABILITY.md", "utf8");
const rows = text.split("\n").filter((l) => /^\| (APP|CLAUDE)-/.test(l)).map((l) => {
  const c = l.trim().replace(/^\|\s*|\s*\|$/g, "").split(" | ");
  return { id: c[0], status: c[2], modules: c[3], tests: c[4], notes: c.slice(5).join(" | ") };
});
const NON_RUNTIME = /^(APP-GOV-00[12]|APP-PLAT-00[45]|APP-INFRA-005|CLAUDE-00[1-5]|APP-PRIV-001|APP-COMP-014)$/;

describe("V3 traceability ledger (#27)", () => {
  it("covers all 194 requirements exactly once, using only the defined statuses", () => {
    expect(rows).toHaveLength(194);
    expect(new Set(rows.map((r) => r.id)).size).toBe(194);
    for (const r of rows) expect(["IMPLEMENTED_TESTED", "PARTIAL", "BLOCKED_EXTERNAL"], r.id).toContain(r.status);
  });

  it("the summary table is regenerated from the rows", () => {
    for (const s of ["IMPLEMENTED_TESTED", "PARTIAL", "BLOCKED_EXTERNAL"]) {
      const m = new RegExp(`\\| ${s} \\| (\\d+) \\|`).exec(text);
      expect(Number(m?.[1]), s).toBe(rows.filter((r) => r.status === s).length);
    }
  });

  it("no IMPLEMENTED_TESTED row admits that its writer, wiring, judge or schema is not in production", () => {
    const admission = /not wired|writer.*not|wiring pending|pending\b|unapplied|fixtures? only|not yet persisted|domain[- ]only/i;
    const contradictory = rows.filter((r) => r.status === "IMPLEMENTED_TESTED" && admission.test(r.notes)).map((r) => r.id);
    expect(contradictory).toEqual([]);
  });

  it("every complete code row cites at least one module and one test", () => {
    const thin = rows.filter((r) => r.status === "IMPLEMENTED_TESTED" && !NON_RUNTIME.test(r.id) && (!r.modules || !r.tests)).map((r) => r.id);
    expect(thin).toEqual([]);
  });

  it("records the exact reviewed commit and date", () => {
    expect(text).toMatch(/\*\*Reviewed commit:\*\* `[0-9a-f]{40}` on \d{4}-\d{2}-\d{2}/);
  });

  it("domain-only rows are never counted complete: the known unwired areas are PARTIAL or BLOCKED_EXTERNAL", () => {
    const status = (id: string) => rows.find((r) => r.id === id)!.status;
    for (const id of ["APP-COMP-008", "APP-READY-002", "APP-RECENCY-001", "APP-DB-008", "APP-DB-009", "APP-API-003"]) expect(status(id), id).toBe("PARTIAL");
    for (const id of ["APP-KM-004", "APP-KM-006", "APP-INFRA-003", "APP-NFR-005", "APP-PLAT-003"]) expect(status(id), id).toBe("BLOCKED_EXTERNAL");
    // and the wired evidence domains are complete (#20, #23)
    for (const id of ["APP-DB-003", "APP-DB-004", "APP-DB-005", "APP-DB-006", "APP-DB-007", "APP-DB-010"]) expect(status(id), id).toBe("IMPLEMENTED_TESTED");
  });
});

describe("device identity is described honestly (#35)", () => {
  it("the ledger and the client code call the device id best-effort, not a security identity", () => {
    expect(text).toMatch(/best-effort device signal, issue #35/);
    expect(readFileSync("hosted-app/ui/learner/api.ts", "utf8")).toMatch(/NOT a security identity/);
  });
});
