import { describe, expect, it } from "vitest";
import { buildCreatorPrompt, checkCreatorOutput } from "../../../lib/sr/pipeline/creator";
import { envelope, role4, role4Payload, approved } from "./helpers/artifacts";

describe("SR-020 Role 4: Meaning Units creator", () => {
  it("prompt is role-specific", () => {
    const p = buildCreatorPrompt(4);
    expect(p).toMatch(/Role 4: Meaning Units/);
    expect(p).toMatch(/MEANING_UNITS/);
    expect(p).toMatch(/Roles 2/);
    expect(p).toMatch(/do not (certify|self-certify)/i);
  });
  it("complete, bounded output passes", () => expect(checkCreatorOutput(4, role4(), approved(2))).toEqual({ ok: true, problems: [] }));
  it("incomplete / unbounded flagged", () => {
    expect(checkCreatorOutput(4, envelope(4, "MEANING_UNITS", {}, approved(2)), approved(2)).problems.join()).toMatch(/missing/);
    expect(checkCreatorOutput(4, role4({ ...role4Payload(), bpc: "x" }), approved(2)).problems.join()).toMatch(/unexpected field/);
  });
  it("must record provenance from the approved passage", () => {
    expect(checkCreatorOutput(4, envelope(4, "MEANING_UNITS", role4Payload(), []), approved(2)).ok).toBe(false);
  });
});
