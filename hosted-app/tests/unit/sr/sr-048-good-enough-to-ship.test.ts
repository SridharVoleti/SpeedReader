import { describe, expect, it } from "vitest";
import { buildQaPrompt, runQa, needsRework } from "../../../lib/sr/pipeline/qa";
import { newPipeline, submitCreatorOutput, recordQa, canStartRole } from "../../../lib/sr/pipeline/gates";
import { role2, role2Payload, words, approved, UPSTREAM } from "./helpers/artifacts";

const qa2 = (payload: Record<string, unknown>) => runQa(2, role2(payload), approved(1), { 1: UPSTREAM[1] });
const styled = () => ({ ...role2Payload(), text: words(80).replace("w1 ", "w1  ") }); // double space: cosmetic only

describe("SR-048 good enough to ship", () => {
  it("QA prompt separates BLOCKER from NON_BLOCKING and says to PASS and stop on zero blockers", () => {
    const p = buildQaPrompt(2);
    expect(p).toMatch(/BLOCKER/);
    expect(p).toMatch(/NON_BLOCKING/);
    expect(p).toMatch(/PASS and stop/i);
    expect(p).toMatch(/theoretical perfection|do not demand perfection/i);
  });
  it("a minor stylistic issue is recorded as NON_BLOCKING and the verdict is still PASS", () => {
    const r = qa2(styled());
    expect(r.verdict).toBe("PASS");
    expect(r.blockers).toEqual([]);
    expect(r.nonBlocking).toHaveLength(1);
    expect(r.nonBlocking[0]).toMatchObject({ severity: "NON_BLOCKING", violated_rule: "STYLE_DOUBLE_SPACE", owner_role: 2 });
  });
  it("non-blocking issues never cause rework", () => {
    expect(needsRework(qa2(styled()))).toBe(false);
  });
  it("a real blocker still fails, and rework is driven by blockers only", () => {
    const r = qa2({ ...styled(), wordCount: 12 });
    expect(r.verdict).toBe("FAIL");
    expect(needsRework(r)).toBe(true);
    expect(r.blockers.every((b) => b.severity === "BLOCKER")).toBe(true);
    expect(r.nonBlocking.every((b) => b.severity === "NON_BLOCKING")).toBe(true);
  });
  it("a PASS with only non-blocking notes opens the next stage immediately", () => {
    const report = qa2(styled());
    let p = submitCreatorOutput(newPipeline(), 1, { hash: "h1", selfCheck: true });
    p = recordQa(p, 1, { verdict: "PASS", qaActor: "q", blockers: 0 });
    p = submitCreatorOutput(p, 2, { hash: "h2", selfCheck: true });
    p = recordQa(p, 2, { verdict: report.verdict, qaActor: "q", blockers: report.blockers.length });
    expect(canStartRole(p, 3).ok).toBe(true);
  });
  it("non-blocking findings are not mixed into the blocker list", () => {
    expect(qa2(styled()).blockers.map((b) => b.violated_rule)).not.toContain("STYLE_DOUBLE_SPACE");
  });
});
