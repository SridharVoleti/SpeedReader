import { describe, expect, it } from "vitest";
import { newPipeline, submitCreatorOutput, recordQa, canStartRole } from "../../../lib/sr/pipeline/gates";
import { applyCorrection, staleRoles } from "../../../lib/sr/pipeline/dag";
import { canonicalHash } from "../../../lib/sr/pipeline/hash";
import type { RoleId } from "../../../lib/sr/pipeline/roles";

const fullyApproved = () => {
  let p = newPipeline();
  for (const id of [1, 2, 3, 4, 5, 6, 7, 8] as RoleId[]) {
    p = submitCreatorOutput(p, id, { hash: `h${id}`, selfCheck: true });
    p = recordQa(p, id, { verdict: "PASS", qaActor: "q", blockers: 0 });
  }
  return p;
};
const qaStatus = (p: ReturnType<typeof newPipeline>, id: RoleId) => p.stages[id]?.qa?.verdict ?? "NONE";

describe("SR-031 dependency-aware invalidation", () => {
  it("canonical hash is stable across key order and differs on content change", () => {
    expect(canonicalHash({ a: 1, b: [1, 2] })).toBe(canonicalHash({ b: [1, 2], a: 1 }));
    expect(canonicalHash({ a: 1 })).not.toBe(canonicalHash({ a: 2 }));
    expect(canonicalHash({ a: 1 })).toMatch(/^[0-9a-f]{64}$/);
  });
  it("correcting Role 3 invalidates only its descendants (6, 7, 8)", () => {
    const p = applyCorrection(fullyApproved(), 3, "h3-fixed");
    expect(qaStatus(p, 3)).toBe("NONE");
    for (const id of [6, 7, 8] as RoleId[]) expect(qaStatus(p, id)).toBe("NONE");
  });
  it("unrelated QA PASS artifacts are retained (1, 2, 4, 5)", () => {
    const p = applyCorrection(fullyApproved(), 3, "h3-fixed");
    for (const id of [1, 2, 4, 5] as RoleId[]) expect(qaStatus(p, id)).toBe("PASS");
    expect(p.stages[4]!.hash).toBe("h4");
  });
  it("the corrected artifact carries its new hash and descendants' own hashes are kept for revalidation", () => {
    const p = applyCorrection(fullyApproved(), 3, "h3-fixed");
    expect(p.stages[3]!.hash).toBe("h3-fixed");
    expect(p.stages[6]!.hash).toBe("h6");
  });
  it("staleRoles lists exactly the roles needing revalidation", () => {
    expect(staleRoles(applyCorrection(fullyApproved(), 3, "h3-fixed"))).toEqual([3, 6, 7, 8]);
    expect(staleRoles(fullyApproved())).toEqual([]);
  });
  it("a no-op correction (same hash) invalidates nothing", () => {
    expect(staleRoles(applyCorrection(fullyApproved(), 3, "h3"))).toEqual([]);
  });
  it("stale descendants cannot be consumed until re-approved, and Role 6 is blocked until Role 3 is re-approved", () => {
    const p = applyCorrection(fullyApproved(), 3, "h3-fixed");
    expect(canStartRole(p, 6)).toMatchObject({ ok: false, blockedBy: [3] });
    const re = recordQa(p, 3, { verdict: "PASS", qaActor: "q", blockers: 0 });
    expect(canStartRole(re, 6).ok).toBe(true);
  });
});
