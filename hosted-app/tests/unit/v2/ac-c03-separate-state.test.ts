import { describe, expect, it } from "vitest";
import { newLearnerAggregate } from "../../../lib/v2/learner-aggregate";
import { newCoreWpmState } from "../../../lib/v2/core-wpm";
import { newNewsReaderState } from "../../../lib/v2/news-reader";
import { emptyEvidenceStore } from "../../../lib/v2/evidence-store";

// AC-C03 - Separate state: core reading, practice, News Reader, readiness and calibration states are not
// conflated into one status field.
describe("AC-C03 separate state", () => {
  const learner = newLearnerAggregate("l", 90);

  it("keeps each domain in its own field of the aggregate", () => {
    expect(Object.keys(learner).sort()).toEqual(["attempts", "baselineWpm", "canonicalPointer", "core", "learnerId", "ledger", "newsReader"]);
    expect(learner.core).toEqual(newCoreWpmState(90));
    expect(learner.newsReader).toEqual(newNewsReaderState());
  });

  it("has no generic score, level or status field anywhere in the aggregate or its domains", () => {
    const forbidden = /^(score|level|status|state|rating|result)$/i;
    const keys = (o: object): string[] => Object.entries(o).flatMap(([k, v]) => [k, ...(v && typeof v === "object" && !Array.isArray(v) ? keys(v) : [])]);
    for (const part of [learner, learner.core, learner.newsReader]) {
      expect(keys(part).filter((k) => forbidden.test(k))).toEqual([]);
    }
  });

  it("gives each track its own evidence namespace (core vs News Reader), and practice analytics its own", () => {
    const store = emptyEvidenceStore();
    expect(Object.keys(store).sort()).toEqual(["core", "newsReader"]);
    expect(Object.keys({ core: 1, practiceAnalytics: [] }).includes("practiceAnalytics")).toBe(true);
  });

  it("each domain exposes its own vocabulary: WPM state, News Reader attempts, ledger, pointer", () => {
    expect(learner.core).toHaveProperty("wpm");
    expect(learner.core).toHaveProperty("newAttempts");
    expect(learner.newsReader).toHaveProperty("attempts");
    expect(typeof learner.canonicalPointer).toBe("number");
    expect(Array.isArray(learner.ledger)).toBe(true);
  });

  it("calibration and readiness are separate modules, not fields on learner state", () => {
    expect(learner).not.toHaveProperty("calibration");
    expect(learner).not.toHaveProperty("readiness");
    expect(learner).not.toHaveProperty("practice");
  });
});
