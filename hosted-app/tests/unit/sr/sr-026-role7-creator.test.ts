import { describe, expect, it } from "vitest";
import { buildCreatorPrompt, checkCreatorOutput } from "../../../lib/sr/pipeline/creator";
import { envelope, role7, role7Payload, approved } from "./helpers/artifacts";

describe("SR-026 Role 7: Attempt Outcome Contract creator", () => {
  it("prompt is role-specific", () => {
    const p = buildCreatorPrompt(7);
    expect(p).toMatch(/Role 7: Attempt Outcome Contract/);
    expect(p).toMatch(/ATTEMPT_CONTRACT/);
    expect(p).toMatch(/Roles 6/);
  });
  it("complete, bounded output passes", () => expect(checkCreatorOutput(7, role7(), approved(6))).toEqual({ ok: true, problems: [] }));
  it("incomplete / unbounded flagged", () => {
    expect(checkCreatorOutput(7, envelope(7, "ATTEMPT_CONTRACT", {}, approved(6)), approved(6)).problems.join()).toMatch(/missing/);
    expect(checkCreatorOutput(7, role7({ ...role7Payload(), passThreshold: 60 }), approved(6)).problems.join()).toMatch(/unexpected field/);
  });
  it("provenance required", () => {
    expect(checkCreatorOutput(7, envelope(7, "ATTEMPT_CONTRACT", role7Payload(), []), approved(6)).ok).toBe(false);
  });
});
