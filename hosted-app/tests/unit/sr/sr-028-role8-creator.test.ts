import { describe, expect, it } from "vitest";
import { buildCreatorPrompt, checkCreatorOutput } from "../../../lib/sr/pipeline/creator";
import { envelope, role8, role8Payload, approved } from "./helpers/artifacts";

const all = approved(1, 2, 3, 4, 5, 6, 7);
describe("SR-028 Role 8: Final JSON Assembly creator", () => {
  it("prompt is role-specific and requires all seven approved upstream artifacts", () => {
    const p = buildCreatorPrompt(8);
    expect(p).toMatch(/Role 8: Final JSON Assembly/);
    expect(p).toMatch(/FINAL_PACKAGE/);
    expect(p).toMatch(/Roles 1, 2, 3, 4, 5, 6, 7/);
    expect(p).toMatch(/do not (certify|self-certify)/i);
  });
  it("complete, bounded output passes", () => expect(checkCreatorOutput(8, role8(), all)).toEqual({ ok: true, problems: [] }));
  it("incomplete / unbounded flagged", () => {
    expect(checkCreatorOutput(8, envelope(8, "FINAL_PACKAGE", {}, all), all).problems.join()).toMatch(/missing/);
    expect(checkCreatorOutput(8, role8({ ...role8Payload(), newContent: "x" }), all).problems.join()).toMatch(/unexpected field/);
  });
  it("assembly missing any approved input is flagged", () => {
    const bad = envelope(8, "FINAL_PACKAGE", role8Payload(), approved(1, 2, 3, 4, 5, 6));
    expect(checkCreatorOutput(8, bad, all).problems.join()).toMatch(/role 7/);
  });
});
