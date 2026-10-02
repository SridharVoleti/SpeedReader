import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import {
  NEWS_READER_PURPOSES, newNewsReaderState, newsReaderGatesCoreProgression, recordNewsReaderAttempt, type NewsReaderAttempt
} from "../../../lib/v2/news-reader";
import { newCoreWpmState } from "../../../lib/v2/core-wpm";

const attempt = (id: string, extra: Partial<NewsReaderAttempt> = {}): NewsReaderAttempt => ({
  attemptId: id, passageId: "P001", readNumber: 1, metrics: { clarity: 0.4 }, technicalState: "OK", recordedAt: "2026-10-03T10:00:00Z", ...extra
});

// FR-034 - Parallel track [FROZEN]
describe("FR-034 News Reader is a separate parallel track", () => {
  it("develops the nine oral-communication purposes", () => {
    expect(NEWS_READER_PURPOSES).toEqual([
      "oral-reading", "pronunciation", "clarity", "phrasing", "meaningful-pauses", "emphasis", "intonation", "confidence", "expressive-oral-communication"
    ]);
  });

  it("is declared as not a gate for core progression", () => {
    expect(newsReaderGatesCoreProgression()).toBe(false);
  });

  it("keeps its own state namespace: recording an attempt cannot touch core state", () => {
    const core = newCoreWpmState(90);
    const coreBefore = JSON.stringify(core);
    let nr = newNewsReaderState();
    for (let i = 0; i < 5; i += 1) nr = recordNewsReaderAttempt(nr, attempt(`n${i}`, { metrics: { clarity: 0, pronunciation: 0 } }));
    expect(nr.attempts).toHaveLength(5);
    expect(JSON.stringify(core)).toBe(coreBefore);
  });

  it("is statically isolated: the News Reader module imports nothing from the core WPM engine or progression", () => {
    const source = readFileSync(resolve(__dirname, "../../../lib/v2/news-reader.ts"), "utf8");
    const imports = source.split("\n").filter((l) => /^\s*import\s/.test(l));
    expect(imports).toEqual([]);
    expect(source).not.toMatch(/core-wpm|first-five|attempt-types|comprehension-score|stamina/);
  });

  it("stores unavailable-microphone attempts without any score or penalty", () => {
    const nr = recordNewsReaderAttempt(newNewsReaderState(), attempt("m1", { technicalState: "MIC_UNAVAILABLE", metrics: {} }));
    expect(nr.attempts[0]).toMatchObject({ technicalState: "MIC_UNAVAILABLE", metrics: {} });
  });

  it("rejects out-of-range oral metrics and is idempotent per attempt id", () => {
    expect(() => recordNewsReaderAttempt(newNewsReaderState(), attempt("x", { metrics: { clarity: 1.5 } }))).toThrow(RangeError);
    const once = recordNewsReaderAttempt(newNewsReaderState(), attempt("dup"));
    expect(recordNewsReaderAttempt(once, attempt("dup"))).toBe(once);
  });

  it("freezes stored attempts (historical attempts are immutable)", () => {
    const nr = recordNewsReaderAttempt(newNewsReaderState(), attempt("f1"));
    expect(Object.isFrozen(nr.attempts[0])).toBe(true);
    expect(() => {
      "use strict";
      (nr.attempts[0] as { passageId: string }).passageId = "other";
    }).toThrow();
  });
});
