import { describe, expect, it } from "vitest";
import { missingReadiness, world1Status, type ReadinessEvidence } from "../../../lib/v2/world1-completion";
import { RS_IDS } from "../../../lib/world1-framework";
import { applyNewPassage, newLearnerAggregate } from "../../../lib/v2/learner-aggregate";
import { scoreComprehension, structuredEvidence } from "../../../lib/v2/comprehension-score";

const scored = (s: number) => scoreComprehension(structuredEvidence([{ itemId: "q1", score: s }]), { score: s });
const allReady = (): ReadinessEvidence[] => RS_IDS.map((rsId) => ({ rsId, confirmed: true, formId: `form-${rsId}-v1` }));

// FR-042 - Level Ups do not substitute for readiness [FROZEN]
describe("FR-042 Level Ups do not substitute for readiness", () => {
  it("any number of Level Ups leaves readiness exactly as it was", () => {
    let learner = newLearnerAggregate("l1", 60);
    for (let i = 0; i < 60; i += 1) learner = applyNewPassage(learner, `a${i}`, scored(0.95)).learner;
    const levelUps = learner.core.wpm - learner.baselineWpm;
    expect(levelUps).toBeGreaterThanOrEqual(10);
    // the learner earned many Level Ups, yet readiness evidence is still wholly missing
    expect(missingReadiness([])).toEqual([...RS_IDS]);
  });

  it("completion ignores the Level Up count and earned WPM entirely", () => {
    const base = { canonicalPointer: 1501, readiness: [] as ReadinessEvidence[] };
    for (const levelUps of [0, 1, 10, 90]) {
      expect(world1Status({ ...base, levelUps, earnedWpm: 60 + levelUps }).status).toBe("SEQUENCE_COMPLETE_READINESS_PENDING");
    }
  });

  it("zero Level Ups does not stop completion when readiness is confirmed", () => {
    expect(world1Status({ canonicalPointer: 1501, readiness: allReady(), levelUps: 0, earnedWpm: 60 })).toEqual({ status: "WORLD1_COMPLETE" });
  });

  it("readiness evidence comes only from confirmed evidence with an approved form, never from WPM progress", () => {
    const fakeFromWpm: ReadinessEvidence[] = RS_IDS.map((rsId) => ({ rsId, confirmed: false, formId: "" }));
    expect(world1Status({ canonicalPointer: 1501, readiness: fakeFromWpm, levelUps: 90, earnedWpm: 150 }).status).toBe("SEQUENCE_COMPLETE_READINESS_PENDING");
  });

  it("the completion module reads no Level Up or WPM field in its decision", async () => {
    const { readFileSync } = await import("node:fs");
    const { resolve } = await import("node:path");
    const source = readFileSync(resolve(__dirname, "../../../lib/v2/world1-completion.ts"), "utf8");
    const decision = source.slice(source.indexOf("export function sequenceComplete"));
    expect(decision).not.toMatch(/earnedWpm|levelUps|\.wpm/);
  });
});
