// APP-NFR-002/003/004 - Runtime capability detection, on-demand microphone permission and graceful degradation.
//
// Pure and injectable (window/navigator are passed in) so behaviour is testable without a browser. A missing or
// denied capability is a CAPABILITY/TECHNICAL condition: it never lowers earned WPM, never counts as learner failure
// and never blocks core reading. Microphone permission is requested only for an activity that needs speech.

export type Capabilities = {
  microphone: boolean;
  speechRecognition: boolean;
  speechSynthesis: boolean;
  voices: number;
  audioPlayback: boolean;
};

type Win = Record<string, unknown>;
type Nav = { mediaDevices?: { getUserMedia?: unknown } } | undefined;

export function detectCapabilities(win: Win, nav: Nav): Capabilities {
  const synth = win["speechSynthesis"] as { getVoices?: () => unknown[] } | undefined;
  let voices = 0;
  try { voices = synth?.getVoices?.().length ?? 0; } catch { voices = 0; }
  return {
    microphone: typeof nav?.mediaDevices?.getUserMedia === "function",
    speechRecognition: Boolean(win["SpeechRecognition"] ?? win["webkitSpeechRecognition"]),
    speechSynthesis: Boolean(synth),
    voices,
    audioPlayback: typeof win["Audio"] === "function" || typeof win["HTMLAudioElement"] === "function"
  };
}

/** Activities that genuinely need the microphone. Core reading is deliberately absent. */
export const SPEECH_ACTIVITIES = ["SPOKEN_COMPREHENSION", "NEWS_READER"] as const;
export type Activity = "CORE_READING" | "STRUCTURED_QUESTIONS" | "FAMILIAR_PRACTICE" | "BPC" | (typeof SPEECH_ACTIVITIES)[number];

export type MicOutcome =
  | { state: "GRANTED"; learnerFailure: false }
  | { state: "DENIED"; learnerFailure: false; fallback: "TYPE_ANSWER" }
  | { state: "UNAVAILABLE"; learnerFailure: false; fallback: "TYPE_ANSWER" }
  | { state: "NOT_REQUESTED"; learnerFailure: false };

/** Map a getUserMedia rejection to a capability state. */
export function classifyMicError(error: unknown): "DENIED" | "UNAVAILABLE" {
  const name = typeof error === "object" && error !== null && "name" in error ? String((error as { name: unknown }).name) : "";
  return name === "NotAllowedError" || name === "PermissionDeniedError" || name === "SecurityError" ? "DENIED" : "UNAVAILABLE";
}

type MicNav = { mediaDevices?: { getUserMedia?: (c: { audio: boolean }) => Promise<{ getTracks?: () => { stop: () => void }[] }> } } | undefined;

/**
 * Ask for the microphone ONLY when the activity needs speech. Any other activity never touches getUserMedia.
 * Denial/absence returns a typed fallback, never an exception and never a failure.
 */
export async function requestMicrophoneFor(activity: Activity, nav: MicNav): Promise<MicOutcome> {
  if (!(SPEECH_ACTIVITIES as readonly string[]).includes(activity)) return { state: "NOT_REQUESTED", learnerFailure: false };
  const get = nav?.mediaDevices?.getUserMedia;
  if (typeof get !== "function") return { state: "UNAVAILABLE", learnerFailure: false, fallback: "TYPE_ANSWER" };
  try {
    const stream = await get.call(nav!.mediaDevices, { audio: true });
    stream?.getTracks?.().forEach((t) => t.stop()); // permission probe only; the recorder opens its own stream
    return { state: "GRANTED", learnerFailure: false };
  } catch (e) {
    return { state: classifyMicError(e), learnerFailure: false, fallback: "TYPE_ANSWER" };
  }
}

export type DegradationPlan = {
  /** Core reading state (WPM, pointer, evidence) is preserved whatever is missing. */
  corePreserved: true;
  spokenInput: "MICROPHONE_STT" | "TYPED";
  readAloud: "SPEECH_SYNTHESIS" | "ON_SCREEN_TEXT";
  referenceAudio: "AUDIO_ELEMENT" | "TTS_ONLY" | "TEXT_ONLY";
  notes: string[];
};

export function degradationPlan(c: Capabilities): DegradationPlan {
  const notes: string[] = [];
  const spokenInput = c.microphone && c.speechRecognition ? "MICROPHONE_STT" : "TYPED";
  if (spokenInput === "TYPED") notes.push("spoken answers fall back to typing; no penalty");
  const readAloud = c.speechSynthesis && c.voices > 0 ? "SPEECH_SYNTHESIS" : "ON_SCREEN_TEXT";
  if (readAloud === "ON_SCREEN_TEXT") notes.push("read-aloud falls back to on-screen text");
  const referenceAudio = c.audioPlayback ? "AUDIO_ELEMENT" : readAloud === "SPEECH_SYNTHESIS" ? "TTS_ONLY" : "TEXT_ONLY";
  return { corePreserved: true, spokenInput, readAloud, referenceAudio, notes };
}
