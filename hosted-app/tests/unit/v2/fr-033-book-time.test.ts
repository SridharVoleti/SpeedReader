import { describe, expect, it } from "vitest";
import { completeNewPassage } from "../../../lib/v2/passage-completion";
import { scoreComprehension, structuredEvidence } from "../../../lib/v2/comprehension-score";
import { newCoreWpmState, type CoreWpmState } from "../../../lib/v2/core-wpm";
import { REFERENCE_BOOK_WORDS, bookTimeImpact, estimatedMinutes, formatDuration, toHoursMinutes } from "../../../lib/v2/book-time";

// FR-033 - Book-time impact [FROZEN] (AC-P20)
describe("FR-033 book-time impact", () => {
  it("uses a 50,000-word reference book and estimated_minutes = 50,000 / WPM", () => {
    expect(REFERENCE_BOOK_WORDS).toBe(50_000);
    expect(estimatedMinutes(100)).toBe(500);
    expect(estimatedMinutes(150)).toBeCloseTo(333.333, 3);
    expect(estimatedMinutes(200)).toBe(250);
  });

  it("converts to hours/minutes and formats them", () => {
    expect(toHoursMinutes(500)).toEqual({ hours: 8, minutes: 20 });
    expect(toHoursMinutes(59.6)).toEqual({ hours: 1, minutes: 0 });
    expect(formatDuration({ hours: 8, minutes: 20 })).toBe("8 hours 20 minutes");
    expect(formatDuration({ hours: 1, minutes: 1 })).toBe("1 hour 1 minute");
    expect(formatDuration({ hours: 2, minutes: 0 })).toBe("2 hours");
    expect(formatDuration({ hours: 0, minutes: 6 })).toBe("6 minutes");
  });

  it("shows previous -> new WPM, the time at the new WPM, and the time saved versus the previous WPM", () => {
    const i = bookTimeImpact(90, 91);
    expect(i.previousWpm).toBe(90);
    expect(i.newWpm).toBe(91);
    expect(i.estimatedAtNewWpm).toEqual({ hours: 9, minutes: 9 }); // 549.45 min
    expect(i.savedVsPrevious).toEqual({ hours: 0, minutes: 6 }); // 555.56 - 549.45
    expect(i.message).toContain("90 WPM → 91 WPM");
    expect(i.message).toContain("9 hours 9 minutes");
    expect(i.message).toContain("6 minutes less than at 90 WPM");
  });

  it("optionally reports cumulative time saved versus the original baseline", () => {
    const i = bookTimeImpact(100, 101, 60);
    expect(i.cumulativeSavedMinutesVsBaseline).toBeCloseTo(50000 / 60 - 50000 / 101, 6);
    expect(i.message).toContain("Since you started");
    expect(bookTimeImpact(100, 101).message).not.toContain("Since you started");
    // baseline at or above new WPM adds nothing
    expect(bookTimeImpact(100, 101, 101).cumulativeSavedMinutesVsBaseline).toBeUndefined();
  });

  it("always uses 'about'/'estimated' wording and never promises exact performance", () => {
    for (const [a, b] of [[60, 61], [90, 91], [149, 150]] as const) {
      const m = bookTimeImpact(a, b, 60).message;
      expect(m).toMatch(/estimated/);
      expect(m).toMatch(/about/);
      expect(m).not.toMatch(/exactly|guarantee|promise|will take/i);
      expect(m).toContain("50,000-word");
    }
  });

  it("rejects non-positive WPM and non-increasing Level Ups", () => {
    expect(() => estimatedMinutes(0)).toThrow(RangeError);
    expect(() => estimatedMinutes(-5)).toThrow(RangeError);
    expect(() => bookTimeImpact(90, 90)).toThrow(RangeError);
    expect(() => bookTimeImpact(90, 89)).toThrow(RangeError);
  });

  it("gives a consistent saving that shrinks as WPM rises (diminishing returns), always positive", () => {
    const early = bookTimeImpact(60, 61).savedMinutesVsPrevious;
    const late = bookTimeImpact(149, 150).savedMinutesVsPrevious;
    expect(early).toBeGreaterThan(late);
    expect(late).toBeGreaterThan(0);
  });

  it("is shown on each validated Level Up and only then", () => {
    const scored = (v: number) => scoreComprehension(structuredEvidence([{ itemId: "q1", score: v }]), { score: v });
    let core: CoreWpmState = newCoreWpmState(90);
    const shown: Array<boolean> = [];
    for (let i = 0; i < 10; i += 1) {
      const out = completeNewPassage(`a${i}`, scored(0.9), core, 90);
      core = out.coreAfter;
      shown.push(out.learner.bookTime !== undefined);
      if (out.learner.bookTime) {
        expect(out.learner.bookTime.previousWpm).toBe(core.wpm - 1);
        expect(out.learner.bookTime.newWpm).toBe(core.wpm);
        expect(out.learner.bookTime.cumulativeSavedMinutesVsBaseline).toBeGreaterThan(0);
      }
    }
    expect(shown).toEqual([false, false, false, false, true, false, false, false, false, true]);
    const unscored = completeNewPassage("u", scoreComprehension(structuredEvidence([{ itemId: "q", score: 1 }]), null), newCoreWpmState(90), 90);
    expect(unscored.learner.bookTime).toBeUndefined();
  });
});
