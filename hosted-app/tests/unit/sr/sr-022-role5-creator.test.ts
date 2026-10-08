import { describe, expect, it } from "vitest";
import { buildCreatorPrompt, checkCreatorOutput } from "../../../lib/sr/pipeline/creator";
import { envelope, role5, role5Payload, approved } from "./helpers/artifacts";

describe("SR-022 Role 5: Best Possible Comprehension creator", () => {
  it("prompt is role-specific", () => {
    const p = buildCreatorPrompt(5);
    expect(p).toMatch(/Role 5: Best Possible Comprehension/);
    expect(p).toMatch(/BPC/);
    expect(p).toMatch(/Roles 2, 4/);
  });
  it("complete, bounded output passes", () => expect(checkCreatorOutput(5, role5(), approved(2, 4))).toEqual({ ok: true, problems: [] }));
  it("incomplete / unbounded flagged", () => {
    expect(checkCreatorOutput(5, envelope(5, "BPC", {}, approved(2, 4)), approved(2, 4)).problems.join()).toMatch(/missing/);
    expect(checkCreatorOutput(5, role5({ ...role5Payload(), items: [] }), approved(2, 4)).problems.join()).toMatch(/unexpected field/);
  });
  it("needs both upstream approvals in provenance", () => {
    expect(checkCreatorOutput(5, envelope(5, "BPC", role5Payload(), approved(2)), approved(2, 4)).problems.join()).toMatch(/role 4/);
  });
});
