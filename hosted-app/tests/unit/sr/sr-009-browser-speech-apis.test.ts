import { describe, expect, it } from "vitest";
import { detectSpeechSupport, speechPlan, PAID_SPEECH_DEPENDENCIES } from "../../../lib/sr/browser-speech";

describe("SR-009 browser-native speech APIs with capability detection", () => {
  it("detects standard and webkit-prefixed recognition plus speechSynthesis", () => {
    expect(detectSpeechSupport({ SpeechRecognition: function () {}, speechSynthesis: {} })).toEqual({ stt: true, tts: true, sttApi: "SpeechRecognition" });
    expect(detectSpeechSupport({ webkitSpeechRecognition: function () {} })).toEqual({ stt: true, tts: false, sttApi: "webkitSpeechRecognition" });
  });
  it("reports no support for an empty browser", () => {
    expect(detectSpeechSupport({})).toEqual({ stt: false, tts: false, sttApi: null });
  });
  it("unsupported STT falls back to typing; unsupported TTS falls back to on-screen text", () => {
    expect(speechPlan({ stt: false, tts: false, sttApi: null })).toEqual({ input: "TYPED_TEXT", output: "ON_SCREEN_TEXT", blocking: false });
    expect(speechPlan({ stt: true, tts: true, sttApi: "SpeechRecognition" })).toEqual({ input: "BROWSER_STT", output: "BROWSER_TTS", blocking: false });
  });
  it("uses no paid speech dependency", () => {
    expect(PAID_SPEECH_DEPENDENCIES).toEqual([]);
  });
});
