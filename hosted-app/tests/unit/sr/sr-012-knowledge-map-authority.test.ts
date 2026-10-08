import { describe, expect, it } from "vitest";
import { ROLES, READINESS_TRACE } from "../../../lib/sr/pipeline/roles";

describe("SR-012 Knowledge Map remains the authority", () => {
  it("there are exactly eight production roles and none authors a readiness lifecycle", () => {
    expect(ROLES).toHaveLength(8);
    expect(ROLES.map((r) => r.id)).toEqual([1, 2, 3, 4, 5, 6, 7, 8]);
    expect(ROLES.some((r) => /lifecycle|readiness/i.test(r.name + r.owns))).toBe(false);
  });
  it("no role generates readiness artifacts; readiness is runtime-only", () => {
    expect(ROLES.every((r) => r.owns !== "READINESS_LIFECYCLE")).toBe(true);
  });
  it("each runtime readiness behaviour cites its canonical Knowledge Map AC", () => {
    expect(READINESS_TRACE.length).toBeGreaterThan(0);
    for (const t of READINESS_TRACE) {
      expect(t.module).toMatch(/^hosted-app\/lib\//);
      expect(t.canonicalAc).toMatch(/^AC-\d{2}$/);
    }
    expect(READINESS_TRACE.map((t) => t.canonicalAc)).toEqual(expect.arrayContaining(["AC-36", "AC-42"]));
  });
});
