import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { advanceFromWorld1, type ReadinessEvidence } from "../../../lib/v2/world1-completion";
import { RS_IDS } from "../../../lib/world1-framework";
import { newNewsReaderState, recordNewsReaderAttempt } from "../../../lib/v2/news-reader";

const allReady = (): ReadinessEvidence[] => RS_IDS.map((rsId) => ({ rsId, confirmed: true, formId: `form-${rsId}-v1` }));
const lowOral = recordNewsReaderAttempt(newNewsReaderState(), {
  attemptId: "n1", passageId: "P001", readNumber: 1, metrics: { clarity: 0, pronunciation: 0, confidence: 0 }, technicalState: "OK", recordedAt: "2026-10-03T10:00:00Z"
});
const noMic = recordNewsReaderAttempt(newNewsReaderState(), {
  attemptId: "n2", passageId: "P001", readNumber: 1, metrics: {}, technicalState: "MIC_UNAVAILABLE", recordedAt: "2026-10-03T10:00:00Z"
});

// FR-043 - News Reader does not block World progression [FROZEN]
describe("FR-043 News Reader does not block World progression", () => {
  const facts = { canonicalPointer: 1501, readiness: allReady() };

  it("a learner who satisfied the core World 1 requirements advances, whatever their News Reader state", () => {
    for (const newsReaderMastery of [undefined, newNewsReaderState(), lowOral, noMic, "NOT_STARTED", { score: 0 }]) {
      expect(advanceFromWorld1({ ...facts, newsReaderMastery })).toEqual({ advance: true, toWorld: 2 });
    }
  });

  it("strong News Reader performance cannot advance a learner whose core requirements are unmet", () => {
    expect(advanceFromWorld1({ canonicalPointer: 1501, readiness: [], newsReaderMastery: { score: 1 } })).toEqual({
      advance: false, reason: "SEQUENCE_COMPLETE_READINESS_PENDING"
    });
    expect(advanceFromWorld1({ canonicalPointer: 400, readiness: allReady(), newsReaderMastery: { score: 1 } })).toEqual({ advance: false, reason: "IN_PROGRESS" });
  });

  it("the advance decision never reads News Reader state", () => {
    const source = readFileSync(resolve(__dirname, "../../../lib/v2/world1-completion.ts"), "utf8");
    const fn = source.slice(source.indexOf("export function advanceFromWorld1"));
    expect(fn).not.toMatch(/facts\.newsReaderMastery/);
  });
});
