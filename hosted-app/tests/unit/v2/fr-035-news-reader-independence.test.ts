import { describe, expect, it } from "vitest";
import { applyNewPassage, newLearnerAggregate, type LearnerAggregate } from "../../../lib/v2/learner-aggregate";
import { newNewsReaderState, recordNewsReaderAttempt, type NewsReaderState } from "../../../lib/v2/news-reader";
import { scoreComprehension, structuredEvidence } from "../../../lib/v2/comprehension-score";

const scored = (s: number) => scoreComprehension(structuredEvidence([{ itemId: "q1", score: s }]), { score: s });

function newsReaderVariants(): Record<string, NewsReaderState> {
  const at = (id: string, clarity: number, tech: "OK" | "MIC_UNAVAILABLE" = "OK") =>
    recordNewsReaderAttempt(newNewsReaderState(), {
      attemptId: id, passageId: "P001", readNumber: 1, metrics: tech === "OK" ? { clarity, pronunciation: clarity, intonation: clarity, confidence: clarity } : {},
      technicalState: tech, recordedAt: "2026-10-03T10:00:00Z"
    });
  return { missing: newNewsReaderState(), low: at("low", 0), high: at("high", 1), mic: at("mic", 0, "MIC_UNAVAILABLE") };
}

function run(newsReader: NewsReaderState, results: number[]) {
  let learner: LearnerAggregate = { ...newLearnerAggregate("l1", 90), newsReader };
  const events: string[] = [];
  results.forEach((r, i) => {
    const out = applyNewPassage(learner, `a${i}`, scored(r));
    learner = out.learner;
    events.push(out.event);
  });
  return { learner, events };
}

// FR-035 - Independence from core progression [FROZEN] (AC-P23)
describe("FR-035 News Reader independence from core progression", () => {
  const sequences: Record<string, number[]> = {
    levelsUp: [0.9, 0.9, 0.9, 0.9, 0.9],
    outlierLevelsUp: [0.9, 0.9, 0.5, 0.9, 0.9],
    stalls: [0.5, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5],
    postFive: [0.5, 0.5, 0.5, 0.5, 0.5, 0.9, 0.9, 0.9]
  };

  it("missing, low, high or unavailable News Reader results never change core WPM, evidence, or events (AC-P23)", () => {
    for (const [name, results] of Object.entries(sequences)) {
      const baseline = run(newNewsReaderState(), results);
      for (const [variantName, nr] of Object.entries(newsReaderVariants())) {
        const r = run(nr, results);
        expect(r.learner.core, `${name}/${variantName} core`).toEqual(baseline.learner.core);
        expect(r.learner.canonicalPointer, `${name}/${variantName} pointer`).toBe(baseline.learner.canonicalPointer);
        expect(r.events, `${name}/${variantName} events`).toEqual(baseline.events);
        expect(r.learner.attempts, `${name}/${variantName} attempts`).toEqual(baseline.learner.attempts);
      }
    }
  });

  it("never blocks a core WPM Level Up, even with the worst possible oral performance", () => {
    const worst = newsReaderVariants().low;
    const r = run(worst, sequences.levelsUp);
    expect(r.learner.core.wpm).toBe(91);
    expect(r.events.at(-1)).toBe("LEVEL_UP");
  });

  it("never reduces earned WPM", () => {
    const r = run(newsReaderVariants().low, [...sequences.levelsUp, ...sequences.stalls]);
    expect(r.learner.core.wpm).toBeGreaterThanOrEqual(91);
  });

  it("never delays canonical passage progression because oral delivery is weak", () => {
    const r = run(newsReaderVariants().low, sequences.stalls);
    expect(r.learner.canonicalPointer).toBe(1 + sequences.stalls.length);
  });

  it("is not a GREEN light: strong oral performance cannot create a Level Up that comprehension did not earn", () => {
    const r = run(newsReaderVariants().high, sequences.stalls);
    expect(r.learner.core.wpm).toBe(90);
    expect(r.events).not.toContain("LEVEL_UP");
  });

  it("core processing leaves the News Reader domain untouched", () => {
    const nr = newsReaderVariants().high;
    const r = run(nr, sequences.levelsUp);
    expect(r.learner.newsReader).toBe(nr);
  });

  it("the decision service has no News Reader input: the aggregate function never reads it", async () => {
    const { readFileSync } = await import("node:fs");
    const { resolve } = await import("node:path");
    const source = readFileSync(resolve(__dirname, "../../../lib/v2/learner-aggregate.ts"), "utf8");
    const body = source.slice(source.indexOf("export function applyNewPassage"));
    expect(body).not.toMatch(/\.newsReader/);
  });
});
