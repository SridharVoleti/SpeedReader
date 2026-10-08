import { describe, expect, it } from "vitest";
import { buildCreatorPrompt, checkCreatorOutput } from "../../../lib/sr/pipeline/creator";
import { envelope, role6, role6Payload, approved } from "./helpers/artifacts";

describe("SR-024 Role 6: Scoring Contract creator", () => {
  it("prompt is role-specific", () => {
    const p = buildCreatorPrompt(6);
    expect(p).toMatch(/Role 6: Scoring Contract/);
    expect(p).toMatch(/SCORING_CONTRACT/);
    expect(p).toMatch(/Roles 3, 4/);
  });
  it("complete, bounded output passes", () => expect(checkCreatorOutput(6, role6(), approved(3, 4))).toEqual({ ok: true, problems: [] }));
  it("incomplete / unbounded flagged", () => {
    expect(checkCreatorOutput(6, envelope(6, "SCORING_CONTRACT", {}, approved(3, 4)), approved(3, 4)).problems.join()).toMatch(/missing/);
    expect(checkCreatorOutput(6, role6({ ...role6Payload(), outcomes: [] }), approved(3, 4)).problems.join()).toMatch(/unexpected field/);
  });
  it("provenance must name both approved inputs", () => {
    expect(checkCreatorOutput(6, envelope(6, "SCORING_CONTRACT", role6Payload(), approved(3)), approved(3, 4)).ok).toBe(false);
  });
});
