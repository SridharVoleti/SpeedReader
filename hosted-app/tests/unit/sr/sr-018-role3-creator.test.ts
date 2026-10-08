import { describe, expect, it } from "vitest";
import { buildCreatorPrompt, checkCreatorOutput } from "../../../lib/sr/pipeline/creator";
import { envelope, role3, role3Payload, approved } from "./helpers/artifacts";

describe("SR-018 Role 3: Assessment Authoring creator", () => {
  it("prompt is role-specific, owns ASSESSMENT, needs approved Roles 1, 2", () => {
    const p = buildCreatorPrompt(3);
    expect(p).toMatch(/Role 3: Assessment Authoring/);
    expect(p).toMatch(/ASSESSMENT/);
    expect(p).toMatch(/Roles 1, 2/);
    expect(p).toMatch(/do not (certify|self-certify)/i);
  });
  it("complete, bounded output with provenance passes", () => {
    expect(checkCreatorOutput(3, role3(), approved(1, 2))).toEqual({ ok: true, problems: [] });
  });
  it("incomplete / out-of-scope output is flagged", () => {
    expect(checkCreatorOutput(3, envelope(3, "ASSESSMENT", {}, approved(1, 2)), approved(1, 2)).problems.join()).toMatch(/missing/);
    expect(checkCreatorOutput(3, role3({ ...role3Payload(), passThreshold: 60 }), approved(1, 2)).problems.join()).toMatch(/unexpected field/);
  });
  it("missing one of the two approved inputs is flagged", () => {
    const bad = envelope(3, "ASSESSMENT", role3Payload(), approved(1));
    expect(checkCreatorOutput(3, bad, approved(1, 2)).problems.join()).toMatch(/input from role 2/);
  });
});
