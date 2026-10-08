import { describe, expect, it } from "vitest";
import { buildCreatorPrompt, checkCreatorOutput } from "../../../lib/sr/pipeline/creator";
import { envelope, role1 } from "./helpers/artifacts";

describe("SR-014 Role 1: Passage Specification creator", () => {
  it("prompt is role-specific, names only its owned artifact and forbids self-certification", () => {
    const p = buildCreatorPrompt(1);
    expect(p).toMatch(/Role 1/);
    expect(p).toMatch(/Passage Specification/);
    expect(p).toMatch(/PASSAGE_SPEC/);
    expect(p).toMatch(/WIP/);
    expect(p).toMatch(/do not (certify|self-certify)/i);
    expect(p).not.toMatch(/Role 2:/);
  });
  it("complete, bounded output with provenance passes the creator check", () => {
    expect(checkCreatorOutput(1, role1(), [])).toEqual({ ok: true, problems: [] });
  });
  it("incomplete output is flagged", () => {
    const a = envelope(1, "PASSAGE_SPEC", { passageId: "W1-0001" });
    expect(checkCreatorOutput(1, a, []).problems.join()).toMatch(/missing/);
  });
  it("unbounded output (extra fields beyond the owned artifact) is flagged", () => {
    const a = role1();
    const bad = { ...a, payload: { ...a.payload, passageText: "Role 2's work" } };
    expect(checkCreatorOutput(1, bad, []).problems.join()).toMatch(/unexpected field/);
  });
  it("missing provenance is flagged", () => {
    const bad = { ...role1(), provenance: undefined } as never;
    expect(checkCreatorOutput(1, bad, []).problems.join()).toMatch(/provenance/);
  });
  it("output carrying a QA verdict (self-certification) is flagged", () => {
    const bad = { ...role1(), qaVerdict: "PASS" } as never;
    expect(checkCreatorOutput(1, bad, []).problems.join()).toMatch(/self-certif/);
  });
  it("wrong role or artifact type is flagged", () => {
    expect(checkCreatorOutput(1, envelope(2, "PASSAGE_TEXT", {}), []).ok).toBe(false);
  });
  it("output not stored under WIP is flagged", () => {
    const bad = { ...role1(), location: "pipeline/approved/role1.json" };
    expect(checkCreatorOutput(1, bad, []).problems.join()).toMatch(/WIP/);
  });
});
