import { describe, expect, it } from "vitest";
import { buildQaPrompt, runQa } from "../../../lib/sr/pipeline/qa";
import { role2, role2Payload, words, approved, UPSTREAM } from "./helpers/artifacts";

const qa = (a: ReturnType<typeof role2>) => runQa(2, a, approved(1), { 1: UPSTREAM[1] });
describe("SR-017 Role 2 QA: Passage Authoring", () => {
  it("prompt is stage-specific and non-repairing", () => {
    expect(buildQaPrompt(2)).toMatch(/QA for Role 2: Passage Authoring/);
    expect(buildQaPrompt(2)).toMatch(/do not repair/i);
  });
  it("valid passage passes", () => expect(qa(role2())).toMatchObject({ verdict: "PASS", blockers: [] }));
  it("passage id must match the approved spec", () => {
    const r = qa(role2({ ...role2Payload(), passageId: "W1-0999" }));
    expect(r.blockers.map((b) => b.violated_rule)).toContain("PASSAGE_ID_MATCH");
  });
  it("declared word count must equal the real count", () => {
    const r = qa(role2({ ...role2Payload(), wordCount: 79 }));
    expect(r.blockers[0]).toMatchObject({ violated_rule: "WORD_COUNT_ACCURATE", owner_role: 2 });
  });
  it("length outside tolerance of the spec target is a blocker, in-tolerance is fine", () => {
    expect(qa(role2({ ...role2Payload(), text: words(40), wordCount: 40 })).blockers.map((b) => b.violated_rule)).toContain("LENGTH_TOLERANCE");
    expect(qa(role2({ ...role2Payload(), text: words(86), wordCount: 86 })).verdict).toBe("PASS");
  });
  it("QA does not modify the passage", () => {
    const a = role2({ ...role2Payload(), wordCount: 1 });
    const s = JSON.stringify(a);
    qa(a);
    expect(JSON.stringify(a)).toBe(s);
  });
});
