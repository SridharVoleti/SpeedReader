import { describe, expect, it } from "vitest";
import { buildCreatorPrompt } from "../../../lib/sr/pipeline/creator";
import { buildQaPrompt, runQa } from "../../../lib/sr/pipeline/qa";
import { DEFECT_FIELDS } from "../../../lib/sr/pipeline/defects";
import { descendants, type RoleId } from "../../../lib/sr/pipeline/roles";
import { role6, role6Payload, role7, role7Payload, items4, approved, UPSTREAM } from "./helpers/artifacts";

const ROLE_IDS: RoleId[] = [1, 2, 3, 4, 5, 6, 7, 8];
describe("SR-030 direct owner routing with a common defect record", () => {
  it("the common record has exactly the six agreed fields", () => {
    expect([...DEFECT_FIELDS]).toEqual(["defect_id", "violated_rule", "evidence", "owner_role", "return_to_role", "affected_dependencies"]);
  });
  it("the record is injected into all 16 role and QA prompts", () => {
    const prompts = [...ROLE_IDS.map(buildCreatorPrompt), ...ROLE_IDS.map(buildQaPrompt)];
    expect(prompts).toHaveLength(16);
    for (const p of prompts) for (const f of DEFECT_FIELDS) expect(p).toContain(f);
  });
  it("descendants come from the dependency graph", () => {
    expect(descendants(3)).toEqual([6, 7, 8]);
    expect(descendants(1)).toEqual([2, 3, 4, 5, 6, 7, 8]);
    expect(descendants(8)).toEqual([]);
  });
  it("a same-stage defect returns to its own role with its descendants listed", () => {
    const r = runQa(7, role7({ ...role7Payload(), outcomes: [] }), approved(6), { 6: UPSTREAM[6] });
    expect(r.blockers[0]).toMatchObject({ owner_role: 7, return_to_role: 7, affected_dependencies: [8] });
  });
  it("a cross-stage defect goes directly to the originating owner, not just the preceding role", () => {
    // Role 6 QA discovers the approved assessment itself has no primary item: root cause is Role 3.
    const assessment = { passageId: "W1-0007", items: items4().map((i) => ({ ...i, primary: false })) };
    const r = runQa(6, role6(role6Payload()), approved(3, 4), { 3: assessment, 4: UPSTREAM[4] });
    const d = r.blockers.find((b) => b.violated_rule === "PRIMARY_ITEM_MATCH")!;
    expect(d.owner_role).toBe(3);
    expect(d.return_to_role).toBe(3);
    expect(d.affected_dependencies).toEqual([6, 7, 8]);
  });
  it("every defect in a report carries all six fields", () => {
    const r = runQa(7, role7({ ...role7Payload(), passageId: "x", outcomes: [] }), approved(6), { 6: UPSTREAM[6] });
    for (const d of r.blockers) for (const f of DEFECT_FIELDS) expect(d).toHaveProperty(f);
  });
});
