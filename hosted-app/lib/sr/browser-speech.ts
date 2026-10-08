// SR-009 - Speech uses only the browser's built-in speech recognition and text-to-speech, detected at runtime with graceful fallbacks. No paid speech service is used.

import { hasSpeechSynthesis } from "../narrator";

export type SpeechSupport = { stt: boolean; tts: boolean; sttApi: "SpeechRecognition" | "webkitSpeechRecognition" | null };

export const PAID_SPEECH_DEPENDENCIES: readonly string[] = Object.freeze([]);

export function detectSpeechSupport(win: Record<string, unknown>): SpeechSupport {
  const sttApi = win.SpeechRecognition ? "SpeechRecognition" : win.webkitSpeechRecognition ? "webkitSpeechRecognition" : null;
  return { stt: sttApi !== null, tts: hasSpeechSynthesis(win), sttApi };
}

export function speechPlan(s: SpeechSupport) {
  return { input: s.stt ? ("BROWSER_STT" as const) : ("TYPED_TEXT" as const), output: s.tts ? ("BROWSER_TTS" as const) : ("ON_SCREEN_TEXT" as const), blocking: false as const };
}
