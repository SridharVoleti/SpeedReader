import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { chunkSentences, createNarrator, pickNarrationVoice, toSpokenText, voiceGender, type SynthLike, type VoiceLike } from "../../lib/narrator";

// Text-to-speech on every screen: behaviours ported from the cross-browser/mobile audio fix.

type FakeUtterance = { text: string; voice: unknown; lang: string; rate: number; pitch: number; volume: number; onend: (() => void) | null; onerror: ((e: { error?: string }) => void) | null };

function fakeSynth(voices: VoiceLike[]) {
  const spoken: FakeUtterance[] = [];
  const synth = {
    speak: vi.fn((u: FakeUtterance) => { spoken.push(u); }),
    cancel: vi.fn(),
    resume: vi.fn(),
    getVoices: vi.fn(() => voices)
  };
  const make = (text: string): FakeUtterance => ({ text, voice: null, lang: "", rate: 1, pitch: 1, volume: 1, onend: null, onerror: null });
  return { synth: synth as unknown as SynthLike, spoken, raw: synth, make };
}

describe("voice selection", () => {
  const voices: VoiceLike[] = [
    { name: "Microsoft Heera Desktop", lang: "en-IN", localService: true },
    { name: "Google US English", lang: "en-US", localService: false },
    { name: "Microsoft Neerja Online (Natural) - English (India)", lang: "en-IN", localService: false },
    { name: "Hindi", lang: "hi-IN" }
  ];
  it("locks to Neerja when the browser exposes it", () => {
    expect(pickNarrationVoice(voices)?.name).toMatch(/Neerja/);
  });
  it("prefers natural/online and Indian English, ignores non-English, returns null when empty", () => {
    // a known female Indian-English voice beats a voice of unknown gender (female-first policy)
    expect(pickNarrationVoice(voices.slice(0, 2))?.name).toBe("Microsoft Heera Desktop");
    expect(pickNarrationVoice(voices.slice(1, 2))?.name).toBe("Google US English");
    expect(pickNarrationVoice([{ name: "Hindi", lang: "hi-IN" }])).toBeNull();
    expect(pickNarrationVoice([])).toBeNull();
    expect(pickNarrationVoice(null)).toBeNull();
  });
});

describe("female news-reader voice (FR-037 Amendment A1)", () => {
  it("classifies voices by well-known names", () => {
    expect(voiceGender({ name: "Microsoft Neerja Online (Natural)", lang: "en-IN" })).toBe("female");
    expect(voiceGender({ name: "Google UK English Female", lang: "en-GB" })).toBe("female");
    expect(voiceGender({ name: "Microsoft Prabhat Online", lang: "en-IN" })).toBe("male");
    expect(voiceGender({ name: "Alexa", lang: "en-US" })).toBe("unknown");
  });
  it("never selects a male voice, even when it is the highest-quality or only English voice", () => {
    const male = { name: "Microsoft Prabhat Online (Natural)", lang: "en-IN", localService: false };
    const female = { name: "Microsoft Heera Desktop", lang: "en-IN", localService: true };
    expect(pickNarrationVoice([male, female])).toBe(female);
    expect(pickNarrationVoice([male])).toBeNull();
    expect(pickNarrationVoice([male, { name: "Google UK English Female", lang: "en-GB", localService: false }])?.name).toMatch(/Female/);
  });
});

describe("spoken text", () => {
  it("strips decorative glyphs and expands screen jargon", () => {
    expect(toSpokenText("⚡ 12/36 Levels cleared ★")).toBe("12 of 36 Levels cleared");
    expect(toSpokenText("Reach 100 WPM")).toBe("Reach 100 words per minute");
    expect(toSpokenText("Score 75%")).toBe("Score 75 percent");
  });
  it("chunks long text into sentence-sized pieces within the limit", () => {
    const long = Array.from({ length: 30 }, (_, i) => `Sentence number ${i} is here.`).join(" ");
    const chunks = chunkSentences(long, 120);
    expect(chunks.length).toBeGreaterThan(1);
    chunks.forEach((c) => expect(c.length).toBeLessThanOrEqual(120));
    expect(chunks.join(" ")).toBe(long);
    const noPunctuation = chunkSentences("word ".repeat(100), 50);
    noPunctuation.forEach((c) => expect(c.length).toBeLessThanOrEqual(50));
    expect(chunkSentences("   ")).toEqual([]);
  });
});

describe("narrator", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it("speaks synchronously inside the tap on touch devices, even with an empty voice list", () => {
    const f = fakeSynth([]);
    const n = createNarrator({ synth: f.synth, createUtterance: f.make as never, touchDevice: true });
    n.start([{ text: "Hello there." }]);
    expect(f.spoken).toHaveLength(1); // no timer needed
    expect(f.spoken[0].lang).toBe("en-IN");
    expect(f.raw.resume).toHaveBeenCalled();
  });

  it("applies the ranked voice and reads every segment in order, reporting done", () => {
    const f = fakeSynth([{ name: "Microsoft Neerja Online", lang: "en-IN" }]);
    const onDone = vi.fn();
    const starts: number[] = [];
    const n = createNarrator({ synth: f.synth, createUtterance: f.make as never, touchDevice: true, onDone, onSegmentStart: (_s, i) => starts.push(i) });
    n.start([{ text: "One." }, { text: "Two." }]);
    expect((f.spoken[0].voice as VoiceLike).name).toMatch(/Neerja/);
    f.spoken[0].onend?.();
    vi.advanceTimersByTime(100);
    expect(f.spoken[1].text).toBe("Two.");
    f.spoken[1].onend?.();
    vi.advanceTimersByTime(100);
    expect(starts).toEqual([0, 1]);
    expect(onDone).toHaveBeenCalledTimes(1);
  });

  it("pause cancels and resume restarts the current segment; stale callbacks are ignored", () => {
    const f = fakeSynth([]);
    const statuses: string[] = [];
    const n = createNarrator({ synth: f.synth, createUtterance: f.make as never, touchDevice: true, onStatus: (s) => statuses.push(s) });
    n.start([{ text: "One." }, { text: "Two." }]);
    const first = f.spoken[0];
    n.pause();
    first.onend?.(); // late event from the cancelled utterance must not advance
    vi.advanceTimersByTime(500);
    expect(f.spoken).toHaveLength(1);
    n.resume();
    expect(f.spoken).toHaveLength(2);
    expect(f.spoken[1].text).toBe("One.");
    expect(statuses).toEqual(["speaking", "paused", "speaking"]);
  });

  it("retries once after an interrupted error, then reports a clear message", () => {
    const f = fakeSynth([]);
    const messages: string[] = [];
    const n = createNarrator({ synth: f.synth, createUtterance: f.make as never, touchDevice: true, onStatus: (_s, m) => messages.push(m) });
    n.start([{ text: "One." }]);
    f.spoken[0].onerror?.({ error: "interrupted" });
    vi.advanceTimersByTime(300);
    expect(f.spoken).toHaveLength(2);
    f.spoken[1].onerror?.({ error: "interrupted" });
    vi.advanceTimersByTime(300);
    expect(f.spoken).toHaveLength(2);
    expect(messages[messages.length - 1]).toMatch(/interrupted/);
  });

  it("explains a blocked-audio error and stop() clears the queue", () => {
    const f = fakeSynth([]);
    const messages: string[] = [];
    const n = createNarrator({ synth: f.synth, createUtterance: f.make as never, touchDevice: true, onStatus: (_s, m) => messages.push(m) });
    n.start([{ text: "One." }]);
    f.spoken[0].onerror?.({ error: "not-allowed" });
    expect(messages[messages.length - 1]).toMatch(/blocked audio/);
    n.stop();
    n.resume(); // no-op after stop
    expect(f.spoken).toHaveLength(1);
  });

  it("degrades gracefully without speechSynthesis and skips empty/decorative-only segments", () => {
    const none = createNarrator({ synth: null, createUtterance: (() => ({})) as never });
    expect(none.supported).toBe(false);
    expect(() => none.start([{ text: "x" }])).not.toThrow();
    const f = fakeSynth([]);
    const messages: string[] = [];
    const n = createNarrator({ synth: f.synth, createUtterance: f.make as never, touchDevice: true, onStatus: (_s, m) => messages.push(m) });
    n.start([{ text: "★ ⚡" }, { text: "   " }]);
    expect(f.spoken).toHaveLength(0);
    expect(messages[messages.length - 1]).toMatch(/nothing to read/);
  });
});
