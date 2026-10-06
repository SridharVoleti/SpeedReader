import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { adaptRate, clampRate, expectedMs, initialRate, MAX_RATE, MIN_RATE, READ_ALONG_WPM, sentenceSegments } from "../../lib/read-along-voice";
import { createNarrator, type SynthLike } from "../../lib/narrator";

// "Read along like a news reader" - the voice is paced at 145 words per minute.
describe("read-along pacing", () => {
  it("targets 145 WPM", () => {
    expect(READ_ALONG_WPM).toBe(145);
    expect(expectedMs(145)).toBe(60000);
    expect(initialRate()).toBeCloseTo(145 / 165, 5);
  });

  it("splits into sentences covering every word exactly once, in order", () => {
    const words = "Ravi went home. He ate dinner! Did he sleep? Yes".split(" ");
    const segs = sentenceSegments(words);
    expect(segs.map((s) => s.text)).toEqual(["Ravi went home.", "He ate dinner!", "Did he sleep?", "Yes"]);
    expect(segs.map((s) => [s.startWord, s.endWord])).toEqual([[0, 2], [3, 5], [6, 8], [9, 9]]);
    const long = Array.from({ length: 70 }, (_, i) => `w${i}`);
    const chunks = sentenceSegments(long);
    expect(chunks.every((c) => c.endWord - c.startWord < 28)).toBe(true);
    expect(chunks.flatMap((c) => c.text.split(" "))).toEqual(long);
  });

  it("slows the voice when it is too fast, speeds it up when too slow, and converges on 145", () => {
    expect(adaptRate(1, 20, 20 * (60000 / 200))).toBeLessThan(1); // spoke at 200 WPM
    expect(adaptRate(1, 20, 20 * (60000 / 100))).toBeGreaterThan(1); // spoke at 100 WPM
    // a simulated voice that speaks 175 WPM at rate 1.0
    let rate = initialRate();
    let measured = 0;
    for (let i = 0; i < 8; i++) {
      measured = 175 * rate;
      rate = adaptRate(rate, 20, (20 * 60000) / measured);
    }
    expect(175 * rate).toBeGreaterThan(140);
    expect(175 * rate).toBeLessThan(150);
  });

  it("ignores noisy tiny sentences and clamps the rate", () => {
    expect(adaptRate(0.9, 2, 300)).toBe(0.9);
    expect(clampRate(9)).toBe(MAX_RATE);
    expect(clampRate(0.01)).toBe(MIN_RATE);
  });
});

describe("narrator read-along hooks", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  function setup(extra: object = {}) {
    const spoken: { text: string; rate: number; onend: (() => void) | null }[] = [];
    const synth = { speak: (u: never) => { spoken.push(u); }, cancel: vi.fn(), resume: vi.fn(), getVoices: () => [] } as unknown as SynthLike;
    const make = (text: string) => ({ text, voice: null, lang: "", rate: 1, pitch: 1, volume: 1, onend: null, onerror: null });
    return { spoken, narrator: createNarrator({ synth, createUtterance: make as never, touchDevice: true, gapMs: 0, ...extra }) };
  }

  it("uses the per-segment rate and reports elapsed time to the calibrator", () => {
    const ends: number[] = [];
    const { spoken, narrator } = setup({ rateFor: () => 0.88, onSegmentEnd: (_s: unknown, _i: number, ms: number) => ends.push(ms) });
    narrator.start([{ text: "One two three four." }, { text: "Five six." }]);
    expect(spoken[0].rate).toBe(0.88);
    vi.advanceTimersByTime(1500);
    spoken[0].onend?.();
    vi.advanceTimersByTime(0);
    expect(ends).toEqual([1500]);
    expect(spoken).toHaveLength(2); // gapMs 0 -> next sentence immediately
  });

  it("moves on when a silent engine never fires onend (watchdog), exactly once", () => {
    const onDone = vi.fn();
    const { spoken, narrator } = setup({ watchdogMs: () => 1000, onDone });
    narrator.start([{ text: "Silent one." }, { text: "Silent two." }]);
    vi.advanceTimersByTime(1001);
    expect(spoken).toHaveLength(2);
    spoken[0].onend?.(); // late genuine event must not double-advance
    vi.advanceTimersByTime(1001);
    expect(onDone).toHaveBeenCalledTimes(1);
  });

  it("stop() does not cancel speech when this narrator is not speaking", () => {
    const cancel = vi.fn();
    const synth = { speak: vi.fn(), cancel, resume: vi.fn(), getVoices: () => [] } as unknown as SynthLike;
    const n = createNarrator({ synth, createUtterance: (() => ({})) as never });
    n.stop();
    expect(cancel).not.toHaveBeenCalled();
  });
});
