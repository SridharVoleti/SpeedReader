import { describe, expect, it } from "vitest";
import { runQa } from "../../../lib/sr/pipeline/qa";
import { role4, role4Payload, approved, UPSTREAM } from "./helpers/artifacts";

const qa = (p: Record<string, unknown>) => runQa(4, role4(p), approved(2), { 2: UPSTREAM[2] });
const rules = (p: Record<string, unknown>) => qa(p).blockers.map((b) => b.violated_rule);
describe("SR-021 Role 4 QA: Meaning Units", () => {
  it("valid units pass", () => expect(qa(role4Payload())).toMatchObject({ verdict: "PASS", blockers: [] }));
  it("units must be quoted from the approved passage", () => {
    const p = role4Payload(); p.units[0] = { ...p.units[0], text: "invented words not in passage" };
    expect(qa(p).blockers[0]).toMatchObject({ violated_rule: "MU_TEXT_IN_PASSAGE", owner_role: 4 });
  });
  it("unit ids must be unique and every unit must carry a fact id", () => {
    const p = role4Payload(); p.units[1] = { ...p.units[1], muId: "MU1" };
    expect(rules(p)).toContain("MU_ID_UNIQUE");
    const q = role4Payload(); q.units[2] = { ...q.units[2], factIds: [] };
    expect(rules(q)).toContain("MU_HAS_FACT");
  });
  it("needs at least one unit", () => expect(rules({ passageId: "W1-0007", units: [] })).toContain("MU_HAS_FACT"));
  it("passage id must match", () => expect(rules({ ...role4Payload(), passageId: "W1-0001" })).toContain("PASSAGE_ID_MATCH"));
});
