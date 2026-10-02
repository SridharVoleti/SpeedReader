import { describe, expect, it } from "vitest";
import {
  assertComprehensionEvidence, comprehensionEvidenceForPassage, emptyEvidenceStore, oralEvidenceForPassage, recordCoreEvidence, recordNewsReaderEvidence
} from "../../../lib/v2/evidence-store";
import type { InternalAttemptRecord } from "../../../lib/v2/passage-completion";
import type { NewsReaderAttempt } from "../../../lib/v2/news-reader";

const core = (id: string, score: number): InternalAttemptRecord => ({
  attemptId: id, attemptType: "NEW_PROGRESSION", score, classification: score >= 0.75 ? "GREEN" : "NOT_GREEN", countedTowardEvidence: true, calibrationVersion: "c1"
});
const oral = (id: string, passageId: string, clarity: number): NewsReaderAttempt => ({
  attemptId: id, passageId, readNumber: 1, metrics: { clarity }, technicalState: "OK", recordedAt: "2026-10-03T10:00:00Z"
});

// FR-036 - Shared content, separate state [FROZEN]
describe("FR-036 shared content, separate state", () => {
  it("lets both tracks use the same canonical passage while storing evidence separately", () => {
    let store = emptyEvidenceStore();
    store = recordCoreEvidence(store, "P001", core("c1", 0.9));
    store = recordNewsReaderEvidence(store, oral("n1", "P001", 0.2));
    expect(comprehensionEvidenceForPassage(store, "P001").map((a) => a.attemptId)).toEqual(["c1"]);
    expect(oralEvidenceForPassage(store, "P001").map((a) => a.attemptId)).toEqual(["n1"]);
  });

  it("each track has its own metrics: comprehension scores on one side, oral metrics on the other", () => {
    let store = emptyEvidenceStore();
    store = recordCoreEvidence(store, "P001", core("c1", 0.9));
    store = recordNewsReaderEvidence(store, oral("n1", "P001", 0.2));
    expect(Object.keys(comprehensionEvidenceForPassage(store, "P001")[0])).toContain("score");
    expect(Object.keys(oralEvidenceForPassage(store, "P001")[0])).toContain("metrics");
    expect(Object.keys(oralEvidenceForPassage(store, "P001")[0])).not.toContain("score");
  });

  it("News Reader results are never returned as comprehension evidence, however many exist", () => {
    let store = emptyEvidenceStore();
    for (let i = 0; i < 10; i += 1) store = recordNewsReaderEvidence(store, oral(`n${i}`, "P001", 1));
    expect(comprehensionEvidenceForPassage(store, "P001")).toEqual([]);
  });

  it("refuses a News Reader attempt at any comprehension-evidence entry point", () => {
    expect(() => assertComprehensionEvidence({ attemptType: "NEWS_READER" })).toThrow(/cannot be substituted/);
    expect(() => assertComprehensionEvidence(oral("n1", "P001", 1))).toThrow(/cannot be substituted/);
    expect(() => assertComprehensionEvidence({ attemptType: "NEW_PROGRESSION" })).not.toThrow();
  });

  it("recording in one track leaves the other namespace untouched (persistent updates)", () => {
    const s0 = emptyEvidenceStore();
    const s1 = recordCoreEvidence(s0, "P001", core("c1", 0.9));
    const s2 = recordNewsReaderEvidence(s1, oral("n1", "P001", 0.5));
    expect(s1.newsReader).toBe(s0.newsReader);
    expect(s2.core).toBe(s1.core);
    expect(s0.core.size).toBe(0);
  });

  it("an unrelated passage has no cross-track leakage", () => {
    let store = emptyEvidenceStore();
    store = recordNewsReaderEvidence(store, oral("n1", "P002", 1));
    expect(comprehensionEvidenceForPassage(store, "P001")).toEqual([]);
    expect(oralEvidenceForPassage(store, "P001")).toEqual([]);
  });
});
