// Text-to-speech narration engine for every SpeedReader screen.
// Ported from the cross-browser/mobile audio fix in
// requirements/COURSE_1_..._CROSS_BROWSER_MOBILE_AUDIO_FIX_TEST.html:
//  - Neerja / neural / en-IN voice ranking, with a graceful fall-back to the device default
//  - never block Start because getVoices() is empty (mobile engines fill it lazily)
//  - first speak() stays inside the user's tap on touch devices (iOS/Android autoplay rules)
//  - Pause = cancel + keep the queue index (native pause()/resume() is unreliable); Resume restarts
//    the current segment
//  - one automatic retry after an 'interrupted' / 'canceled' browser error
//  - short sentence-level chunks so Chrome's ~15 s long-utterance cut-off never truncates speech
// FR-037 (Amendment A1): the News Reader reference is this same engine at 145 WPM with a female voice,
// so the voice policy below is female-first for the whole app, exactly like the Course 1 reference.

export type VoiceLike = { name: string; lang: string; localService?: boolean };

export function normalizeWhitespace(text: string): string {
  return String(text ?? "")
    .replace(/ /g, " ")
    .replace(/[ \t]+/g, " ")
    .replace(/\s*\n\s*/g, " ")
    .trim();
}

// Decorative glyphs (icons, stars, arrows, emoji) are read aloud as nonsense by most engines.
const DECORATIVE = /[←-⯿ϟ×\u{1F000}-\u{1FAFF}️]/gu;

const SPOKEN_TERMS: [RegExp, string][] = [
  [/\bWPM\b/g, "words per minute"],
  [/\bBPC\b/g, "B P C"],
  [/\bASR\b/g, "A S R"],
  [/\bUAT\b/g, "U A T"],
  [/\bAPI\b/g, "A P I"],
  [/\bUI\b/g, "U I"],
  [/\bPASS\b/g, "pass"],
  [/\bFAIL\b/g, "fail"],
  [/\bGREEN\b/g, "green"]
];

/** Turns on-screen text into text an engine reads well (acronyms, "3/36", icon glyphs). */
export function toSpokenText(text: string): string {
  let out = String(text ?? "").replace(DECORATIVE, " ");
  for (const [pattern, replacement] of SPOKEN_TERMS) out = out.replace(pattern, replacement);
  out = out.replace(/(\d+)\s*\/\s*(\d+)/g, "$1 of $2").replace(/\s*%/g, " percent").replace(/…/g, ".");
  return normalizeWhitespace(out).replace(/\s+([,.;:!?])/g, "$1");
}

/** Splits into sentence-sized pieces of at most `maxLength` characters. */
export function chunkSentences(text: string, maxLength = 180): string[] {
  const clean = normalizeWhitespace(text);
  if (!clean) return [];
  const sentences = clean.match(/[^.!?;:]+[.!?;:]?|.+$/g) ?? [clean];
  const chunks: string[] = [];
  let current = "";
  const push = () => {
    if (current.trim()) chunks.push(current.trim());
    current = "";
  };
  for (const sentence of sentences) {
    const part = sentence.trim();
    if (!part) continue;
    if ((current + " " + part).trim().length <= maxLength) {
      current = (current + " " + part).trim();
      continue;
    }
    push();
    if (part.length <= maxLength) {
      current = part;
      continue;
    }
    for (const word of part.split(/\s+/)) {
      if (current && (current + " " + word).length > maxLength) {
        push();
        current = word;
      } else {
        current = (current + " " + word).trim();
      }
    }
  }
  push();
  return chunks;
}

// Browsers expose no gender field, so it is inferred from the well-known voice names.
const FEMALE_NAMES = ["neerja", "neeraja", "heera", "swara", "zira", "hazel", "susan", "aria", "jenny", "emma", "libby", "sonia", "catherine", "linda", "samantha", "karen", "moira", "tessa", "veena", "victoria", "fiona", "serena", "allison", "ava", "kalpana", "lekha", "female", "woman"];
const MALE_NAMES = ["ravi", "prabhat", "hemant", "madhur", "david", "mark", "george", "james", "richard", "guy", "ryan", "daniel", "alex", "fred", "oliver", "rishi", "thomas", "tom", "male", "man"];

export type VoiceGender = "female" | "male" | "unknown";

export function voiceGender(voice: VoiceLike | null | undefined): VoiceGender {
  const name = String(voice?.name ?? "").toLowerCase();
  const words = name.split(/[^a-z]+/);
  // "female" contains "male", so test female first; match whole words to avoid e.g. "Alexa" vs "alex".
  if (FEMALE_NAMES.some((n) => words.includes(n))) return "female";
  if (MALE_NAMES.some((n) => words.includes(n))) return "male";
  return "unknown";
}

export function scoreVoice(voice: VoiceLike): number {
  const name = String(voice.name || "").toLowerCase();
  const lang = String(voice.lang || "").toLowerCase().replace("_", "-");
  let value = 0;
  if (name.includes("neerja") || name.includes("neeraja")) value += 10000;
  if (name.includes("natural")) value += 2600;
  if (name.includes("neural")) value += 2400;
  if (name.includes("online")) value += 1800;
  if (name.includes("premium")) value += 1600;
  if (name.includes("enhanced")) value += 1400;
  if (name.includes("google")) value += 900;
  if (voice.localService === false) value += 300;
  if (lang.startsWith("en-in")) value += 1200;
  else if (lang.startsWith("en-gb")) value += 650;
  else if (lang.startsWith("en-us")) value += 600;
  else if (lang.startsWith("en")) value += 350;
  if (name.includes("desktop")) value -= 1200;
  if (name.includes("heera")) value -= 500;
  const gender = voiceGender(voice);
  if (gender === "female") value += 5000;
  else if (gender === "male") value -= 20000;
  return value;
}

/** Best English voice, or null (callers must still speak - the device default will respond). */
export function pickNarrationVoice<T extends VoiceLike>(voices: readonly T[] | null | undefined): T | null {
  if (!voices || voices.length === 0) return null;
  const english = voices.filter((v) => String(v.lang || "").toLowerCase().replace("_", "-").startsWith("en"));
  if (english.length === 0) return null;
  // Never choose a known male voice: with none available the device default speaks instead.
  const candidates = english.filter((v) => voiceGender(v) !== "male");
  if (candidates.length === 0) return null;
  return candidates.slice().sort((a, b) => scoreVoice(b) - scoreVoice(a))[0];
}

export function isNeerjaVoice(voice: VoiceLike | null): boolean {
  const name = String(voice?.name ?? "").toLowerCase();
  return name.includes("neerja") || name.includes("neeraja");
}

/** `speech` (when given) is spoken verbatim, so callers that map boundary offsets control the exact text. */
export type NarrationSegment = { text: string; id?: string; speech?: string };
export type NarratorStatus = "idle" | "speaking" | "paused";

type UtteranceLike = {
  voice: unknown;
  lang: string;
  rate: number;
  pitch: number;
  volume: number;
  onend: (() => void) | null;
  onerror: ((event: { error?: string }) => void) | null;
  onstart?: (() => void) | null;
  onboundary?: ((event: { charIndex?: number; name?: string }) => void) | null;
};

export type SynthLike = {
  speak(utterance: never): void;
  cancel(): void;
  resume(): void;
  getVoices(): VoiceLike[];
  addEventListener?(type: "voiceschanged", listener: () => void): void;
  removeEventListener?(type: "voiceschanged", listener: () => void): void;
};

export type NarratorOptions = {
  synth: SynthLike | null;
  createUtterance: (text: string) => UtteranceLike;
  rate?: number;
  /** Desktop engines sometimes need a beat after cancel(); touch devices must speak synchronously. */
  touchDevice?: boolean;
  /** Per-segment engine rate (read-along calibrates this to hit an exact words-per-minute). */
  rateFor?: (segment: NarrationSegment, index: number) => number;
  /** Silent gap between segments; read-along uses 0 so pacing stays at the target WPM. */
  gapMs?: number;
  /** If an utterance never ends (silent/broken engine) it is treated as finished after this long. */
  watchdogMs?: (segment: NarrationSegment) => number;
  onSegmentStart?: (segment: NarrationSegment, index: number, total: number) => void;
  /** The engine has actually begun producing sound (cloud voices lag the speak() call). */
  onSegmentSpoken?: (segment: NarrationSegment, index: number) => void;
  /** Word-boundary event: charIndex is an offset into the spoken text. */
  onBoundary?: (segment: NarrationSegment, charIndex: number) => void;
  /** If the engine never reports a start event, treat speech as started after this long. */
  startFallbackMs?: number;
  onSegmentEnd?: (segment: NarrationSegment, index: number, elapsedMs: number) => void;
  onStatus?: (status: NarratorStatus, message: string) => void;
  onDone?: () => void;
};

export type Narrator = {
  readonly supported: boolean;
  readonly voice: VoiceLike | null;
  start(segments: NarrationSegment[], fromIndex?: number): void;
  pause(): void;
  resume(): void;
  stop(message?: string): void;
  refreshVoice(): void;
  dispose(): void;
};

export function createNarrator(options: NarratorOptions): Narrator {
  const { synth, createUtterance } = options;
  const rate = options.rate ?? 1;
  let voice: VoiceLike | null = null;
  let queue: NarrationSegment[] = [];
  let index = 0;
  let token = 0;
  let paused = false;
  let active = false;
  let retryIndex = -1;
  let retryCount = 0;

  const emit = (status: NarratorStatus, message: string) => options.onStatus?.(status, message);

  function refreshVoice() {
    if (!synth) return;
    try {
      voice = pickNarrationVoice(synth.getVoices());
    } catch {
      voice = null;
    }
  }

  function speakNext(myToken: number) {
    if (!synth || myToken !== token || !active) return;
    if (index >= queue.length) {
      active = false;
      queue = [];
      index = 0;
      emit("idle", "Finished reading this screen.");
      options.onDone?.();
      return;
    }
    const segment = queue[index];
    options.onSegmentStart?.(segment, index, queue.length);
    const utterance = createUtterance(segment.speech ?? toSpokenText(segment.text));
    if (voice) {
      utterance.voice = voice;
      utterance.lang = voice.lang || "en-IN";
    } else {
      // Mobile engines can speak with an empty voice list - never block on it.
      utterance.lang = "en-IN";
    }
    utterance.rate = options.rateFor ? options.rateFor(segment, index) : rate;
    utterance.pitch = 1;
    utterance.volume = 1;
    let startedAt = Date.now();
    const segmentIndex = index;
    let finished = false;
    let spoken = false;
    let startTimer: ReturnType<typeof setTimeout> | undefined;
    const markSpoken = () => {
      if (spoken || finished || myToken !== token) return;
      spoken = true;
      if (startTimer !== undefined) clearTimeout(startTimer);
      startedAt = Date.now(); // pace is measured from real speech, not from the speak() request
      options.onSegmentSpoken?.(segment, segmentIndex);
    };
    utterance.onstart = markSpoken;
    utterance.onboundary = (event) => {
      if (myToken !== token || typeof event?.charIndex !== "number") return;
      if (event.name && event.name !== "word") return;
      markSpoken();
      options.onBoundary?.(segment, event.charIndex);
    };
    let watchdog: ReturnType<typeof setTimeout> | undefined;
    const finish = () => {
      if (finished || myToken !== token) return;
      finished = true;
      if (watchdog !== undefined) clearTimeout(watchdog);
      if (startTimer !== undefined) clearTimeout(startTimer);
      retryIndex = -1;
      retryCount = 0;
      options.onSegmentEnd?.(segment, segmentIndex, Date.now() - startedAt);
      index += 1;
      setTimeout(() => speakNext(myToken), options.gapMs ?? 90);
    };
    utterance.onend = finish;
    if (options.watchdogMs) watchdog = setTimeout(finish, options.watchdogMs(segment));
    if (options.onSegmentSpoken) startTimer = setTimeout(markSpoken, options.startFallbackMs ?? 1800);
    utterance.onerror = (event) => {
      if (myToken !== token) return;
      finished = true;
      if (watchdog !== undefined) clearTimeout(watchdog);
      if (startTimer !== undefined) clearTimeout(startTimer);
      const recoverable = event?.error === "interrupted" || event?.error === "canceled";
      if (recoverable && !paused) {
        if (retryIndex !== index) {
          retryIndex = index;
          retryCount = 0;
        }
        if (retryCount < 1) {
          retryCount += 1;
          emit("speaking", "Restoring the current sentence after a brief browser interruption.");
          setTimeout(() => speakNext(myToken), 260);
          return;
        }
      }
      active = false;
      emit("idle", event?.error === "not-allowed"
        ? "Your browser blocked audio. Tap Listen again to start."
        : `Reading stopped because the browser reported: ${event?.error ?? "an error"}.`);
    };
    synth.speak(utterance as never);
  }

  const onVoicesChanged = () => refreshVoice();
  synth?.addEventListener?.("voiceschanged", onVoicesChanged);
  refreshVoice();

  return {
    get supported() {
      return synth !== null;
    },
    get voice() {
      return voice;
    },
    refreshVoice,
    start(segments, fromIndex = 0) {
      if (!synth) {
        emit("idle", "Read aloud is not supported by this browser.");
        return;
      }
      refreshVoice();
      try { synth.resume(); } catch { /* some mobile engines initialise only after a user gesture */ }
      token += 1;
      synth.cancel();
      queue = segments.filter((s) => toSpokenText(s.text).length > 0);
      index = Math.max(0, Math.min(fromIndex, Math.max(0, queue.length - 1)));
      paused = false;
      retryIndex = -1;
      retryCount = 0;
      if (queue.length === 0) {
        active = false;
        emit("idle", "There is nothing to read on this screen.");
        return;
      }
      active = true;
      emit("speaking", isNeerjaVoice(voice)
        ? "Reading with Microsoft Neerja."
        : voice && voiceGender(voice) === "female" ? `Reading with the female voice “${voice.name}”.`
        : voice ? "Reading with the best English voice in this browser (no named female voice was found)."
        : "Reading with this device's English speech engine.");
      const myToken = token;
      // Touch devices: keep the first speak() inside the tap's call stack.
      if (options.touchDevice) speakNext(myToken);
      else setTimeout(() => speakNext(myToken), 60);
    },
    pause() {
      if (!synth || !active || paused) return;
      paused = true;
      token += 1;
      synth.cancel();
      emit("paused", "Paused. Resume restarts the current sentence.");
    },
    resume() {
      if (!synth || !active || !paused) return;
      refreshVoice();
      paused = false;
      token += 1;
      synth.cancel();
      emit("speaking", "Reading resumed.");
      const myToken = token;
      if (options.touchDevice) speakNext(myToken);
      else setTimeout(() => speakNext(myToken), 60);
    },
    stop(message = "Stopped.") {
      if (!synth) return;
      if (!active && !paused) { emit("idle", message); return; } // never cancel speech we don't own
      token += 1;
      active = false;
      paused = false;
      queue = [];
      index = 0;
      synth.cancel();
      emit("idle", message);
    },
    dispose() {
      token += 1;
      active = false;
      synth?.removeEventListener?.("voiceschanged", onVoicesChanged);
      try { synth?.cancel(); } catch { /* ignore */ }
    }
  };
}

/** Browser wiring shared by every narrating component; null when speech synthesis is unavailable. */
export function browserSpeech(): Pick<NarratorOptions, "synth" | "createUtterance" | "touchDevice"> | null {
  if (typeof window === "undefined" || !("speechSynthesis" in window)) return null;
  return {
    synth: window.speechSynthesis as never,
    createUtterance: (text) => new SpeechSynthesisUtterance(text) as never,
    touchDevice: "ontouchstart" in window || (navigator.maxTouchPoints || 0) > 0
  };
}
