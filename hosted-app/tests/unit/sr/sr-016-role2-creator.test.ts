import { describe, expect, it } from "vitest";
import { buildCreatorPrompt, checkCreatorOutput } from "../../../lib/sr/pipeline/creator";
import { envelope, role2, role2Payload, approved } from "./helpers/artifacts";

describe("SR-016 Role 2: Passage Authoring creator", () => {
  it("prompt is role-specific and requires approved Role 1 input", () => {
    const p = buildCreatorPrompt(2);
    expect(p).toMatch(/Role 2: Passage Authoring/);
    expect(p).toMatch(/PASSAGE_TEXT/);
    expect(p).toMatch(/Roles 1/);
    expect(p).toMatch(/WIP/);
    expect(p).toMatch(/do not (certify|self-certify)/i);
  });
  it("complete, bounded output with provenance passes", () => {
    expect(checkCreatorOutput(2, role2(), approved(1))).toEqual({ ok: true, problems: [] });
  });
  it("incomplete and unbounded output are flagged", () => {
    expect(checkCreatorOutput(2, envelope(2, "PASSAGE_TEXT", { passageId: "x" }, approved(1)), approved(1)).problems.join()).toMatch(/missing/);
    expect(checkCreatorOutput(2, role2({ ...role2Payload(), items: [] }), approved(1)).problems.join()).toMatch(/unexpected field/);
  });
  it("provenance must cite the approved upstream hash, not stale/WIP input", () => {
    const bad = envelope(2, "PASSAGE_TEXT", role2Payload(), [{ role: 1, hash: "some-wip-hash" }]);
    expect(checkCreatorOutput(2, bad, approved(1)).problems.join()).toMatch(/approved input from role 1/);
  });
  it("a creator that submits without any upstream provenance is flagged", () => {
    expect(checkCreatorOutput(2, envelope(2, "PASSAGE_TEXT", role2Payload(), []), approved(1)).ok).toBe(false);
  });
});
