import { describe, expect, it } from "vitest";
import { runQa } from "../../../lib/sr/pipeline/qa";
import { setPropositionJudge } from "../../../lib/sr/pipeline/verifiers";
import { role4, role4Payload, approved, UPSTREAM } from "./helpers/artifacts";

const qa = (p: Record<string, unknown>) => runQa(4, role4(p), approved(2), { 2: UPSTREAM[2] });
const rules = (p: Record<string, unknown>) => qa(p).blockers.map((b) => b.violated_rule);
describe("SR-021 Role 4 QA: Meaning Units", () => {
  it("valid units pass", () => expect(qa(role4Payload())).toMatchObject({ verdict: "PASS", blockers: [] }));
  it("a faithful paraphrase passes without being a verbatim substring (fixture MU2)", () => {
    expect(role4Payload().units[1].text.includes("A faithful")).toBe(true);
    expect(qa(role4Payload()).verdict).toBe("PASS");
  });
  it("an unsupported proposition fails separately from a missing evidence reference", () => {
    const p = role4Payload(); p.units[0] = { ...p.units[0], text: "invented words not in passage" };
    expect(qa(p).blockers[0]).toMatchObject({ violated_rule: "MU_PROPOSITION_SUPPORTED", owner_role: 4 });
    const q = role4Payload(); q.units[0] = { ...q.units[0], evidence: { span: "not in passage at all" } };
    expect(qa(q).blockers[0]).toMatchObject({ violated_rule: "MU_EVIDENCE_REF", owner_role: 4 });
    const r = role4Payload(); r.units[0] = { ...r.units[0], evidence: { sentences: [9] } };
    expect(rules(r)).toContain("MU_EVIDENCE_REF");
    const t = role4Payload(); delete (t.units[0] as { evidence?: unknown }).evidence;
    expect(rules(t)).toContain("MU_EVIDENCE_REF");
  });
  it("fact ids are preserved verbatim and not repeated inside a unit", () => {
    const p = role4Payload(); p.units[0] = { ...p.units[0], factIds: ["F1", "F1"] };
    expect(rules(p)).toContain("MU_FACT_ID_UNIQUE");
  });
  it("fails closed with no proposition judge registered", () => {
    setPropositionJudge(null);
    try { expect(rules(role4Payload())).toContain("INDEPENDENT_VERIFIER_MISSING"); } finally { setPropositionJudge(() => "ENTAILED"); }
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
