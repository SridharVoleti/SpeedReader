import { describe, expect, it } from "vitest";
import { buildQaPrompt, runQa } from "../../../lib/sr/pipeline/qa";
import { role8, role8Payload, approved, UPSTREAM } from "./helpers/artifacts";

const all = approved(1, 2, 3, 4, 5, 6, 7);
const qa = (p: Record<string, unknown>) => runQa(8, role8(p), all, UPSTREAM);
const rules = (p: Record<string, unknown>) => qa(p).blockers.map((b) => b.violated_rule);
describe("SR-029 Role 8 QA: Final JSON Assembly", () => {
  it("prompt is stage-specific", () => expect(buildQaPrompt(8)).toMatch(/QA for Role 8: Final JSON Assembly/));
  it("an assembly referencing every approved hash passes", () => expect(qa(role8Payload())).toMatchObject({ verdict: "PASS", blockers: [] }));
  it("a missing reference is a blocker", () => {
    const refs: Record<string, string> = { ...role8Payload().refs };
    delete refs["5"];
    expect(rules({ ...role8Payload(), refs })).toContain("ALL_REFS_PRESENT");
  });
  it("a stale hash is a blocker owned by Role 8 with evidence", () => {
    const r = qa({ ...role8Payload(), refs: { ...role8Payload().refs, 3: "old-hash" } });
    expect(r.blockers[0]).toMatchObject({ violated_rule: "REF_HASH_MATCHES_APPROVED", owner_role: 8 });
    expect(r.blockers[0].evidence).toMatch(/role 3/);
  });
  it("passage id must match upstream", () => expect(rules({ ...role8Payload(), passageId: "W1-0001" })).toContain("PASSAGE_ID_MATCH"));
});
