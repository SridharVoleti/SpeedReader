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

import { sentenceSegments as segmentsOf, updateMsPerWord, wordIndexAtChar, wordSchedule, wordsStartedBy } from "../../lib/read-along-voice";

describe("read-along stays in sync with the voice", () => {
  it("maps a boundary charIndex back to the right word, even when acronyms are expanded", () => {
    const [seg] = segmentsOf("The API is ready now.".split(" "));
    expect(seg.speech).toBe("The A P I is ready now.");
    expect(seg.wordOffsets).toEqual([0, 4, 10, 13, 19]);
    expect(wordIndexAtChar(seg.wordOffsets, 0)).toBe(0);
    expect(wordIndexAtChar(seg.wordOffsets, 6)).toBe(1); // inside "A P I"
    expect(wordIndexAtChar(seg.wordOffsets, 13)).toBe(3);
    expect(wordIndexAtChar(seg.wordOffsets, 999)).toBe(4);
  });

  it("schedules every word in order, ending inside the measured speech duration", () => {
    const words = "Ravi walked slowly, then he ran home.".split(" ");
    const schedule = wordSchedule(words, 3000);
    expect(schedule[0]).toBe(0);
    expect(schedule.every((t, i) => i === 0 || t > schedule[i - 1])).toBe(true);
    expect(schedule[schedule.length - 1]).toBeLessThan(3000);
    // nothing has started before the voice produced sound; the last word waits until near the end
    expect(wordsStartedBy(schedule, -1)).toBe(0);
    expect(wordsStartedBy(schedule, 0)).toBe(1);
    expect(wordsStartedBy(schedule, 3000)).toBe(words.length);
    expect(wordsStartedBy(schedule, 1500)).toBeGreaterThan(2);
    expect(wordsStartedBy(schedule, 1500)).toBeLessThan(words.length - 1);
  });

  it("gives long words and punctuation more time than short plain words", () => {
    const [a, b, c] = wordSchedule(["a", "extraordinary,", "go"], 1000);
    expect(b - a).toBeLessThan(c - b);
  });

  it("learns this voice's real speed from measured speech", () => {
    expect(updateMsPerWord(413, 10, 6000)).toBeGreaterThan(413);
    expect(updateMsPerWord(413, 10, 3000)).toBeLessThan(413);
    expect(updateMsPerWord(413, 2, 100)).toBe(413);
  });
});

describe("narrator start/boundary events", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  function engine(extra: object) {
    const spoken: { text: string; onstart: (() => void) | null; onboundary: ((e: { charIndex: number; name?: string }) => void) | null; onend: (() => void) | null }[] = [];
    const synth = { speak: (u: never) => { spoken.push(u); }, cancel: vi.fn(), resume: vi.fn(), getVoices: () => [] } as unknown as SynthLike;
    const make = (text: string) => ({ text, voice: null, lang: "", rate: 1, pitch: 1, volume: 1, onend: null, onerror: null, onstart: null, onboundary: null });
    return { spoken, n: createNarrator({ synth, createUtterance: make as never, touchDevice: true, gapMs: 0, ...extra }) };
  }

  it("does not report speech as started until the engine says so, and measures pace from that moment", () => {
    const spokenAt: number[] = [];
    const paces: number[] = [];
    const { spoken, n } = engine({ onSegmentSpoken: () => spokenAt.push(Date.now()), onSegmentEnd: (_s: unknown, _i: number, ms: number) => paces.push(ms), startFallbackMs: 5000 });
    n.start([{ text: "One two three four.", speech: "One two three four." }]);
    vi.advanceTimersByTime(900); // cloud voice still warming up
    expect(spokenAt).toEqual([]);
    spoken[0].onstart?.();
    vi.advanceTimersByTime(2000);
    spoken[0].onend?.();
    expect(paces).toEqual([2000]); // the 900 ms start-up lag is not counted as speaking time
  });

  it("forwards word boundaries (and ignores sentence boundaries) and speaks the given speech text verbatim", () => {
    const seen: number[] = [];
    const { spoken, n } = engine({ onBoundary: (_s: unknown, c: number) => seen.push(c) });
    n.start([{ text: "The API", speech: "The A P I" }]);
    expect(spoken[0].text).toBe("The A P I");
    spoken[0].onboundary?.({ charIndex: 4, name: "word" });
    spoken[0].onboundary?.({ charIndex: 9, name: "sentence" });
    expect(seen).toEqual([4]);
  });

  it("falls back to 'started' when an engine never fires a start event, so the highlight cannot freeze", () => {
    const started = vi.fn();
    const { n } = engine({ onSegmentSpoken: started, startFallbackMs: 1500 });
    n.start([{ text: "Silent engine here." }]);
    vi.advanceTimersByTime(1499);
    expect(started).not.toHaveBeenCalled();
    vi.advanceTimersByTime(2);
    expect(started).toHaveBeenCalledTimes(1);
  });
});
