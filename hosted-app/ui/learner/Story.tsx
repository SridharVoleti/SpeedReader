"use client";

// One story, start to finish: read -> answer the questions -> (progress stories) tell it in your own words -> send.
// The browser sends raw answers only. Scores, correctness and thresholds live on the server and are never shown.

import { useMemo, useRef, useState } from "react";
import Reader from "./Reader";
import { api, friendlyProblem, type Feedback, type StoryView } from "./api";
import { detectCapabilities, degradationPlan, requestMicrophoneFor } from "../../lib/v2/capabilities";
import styles from "./learner.module.css";

export type StoryMode = "assessment" | "progress" | "practice";
export type StoryResult =
  | { mode: "assessment"; status: string }
  | { mode: "progress" | "practice"; feedback: Feedback; attemptId: string };

type Step = "read" | "questions" | "explain" | "sending";
type RecognitionLike = {
  lang: string; continuous: boolean; interimResults: boolean;
  onresult: ((e: { results: ArrayLike<ArrayLike<{ transcript: string; confidence: number }>> }) => void) | null;
  onerror: (() => void) | null; onend: (() => void) | null; start(): void; stop(): void;
};

export default function Story(props: {
  mode: StoryMode;
  wpm: number;
  story: StoryView;
  attemptKey: string;
  onResult: (r: StoryResult) => void;
  onProblem: (message: string) => void;
}) {
  const { mode, wpm, story, attemptKey, onResult, onProblem } = props;
  const [step, setStep] = useState<Step>("read");
  const [answers, setAnswers] = useState<(number | null)[]>(() => story.items.map(() => null));
  const [text, setText] = useState("");
  const [raw, setRaw] = useState<string | null>(null);
  const [confidence, setConfidence] = useState<number | null>(null);
  const [asrFailed, setAsrFailed] = useState(false);
  const [micNote, setMicNote] = useState<string | null>(null);
  const [listening, setListening] = useState(false);
  const startedAt = useRef(new Date().toISOString());
  const recRef = useRef<RecognitionLike | null>(null);

  const plan = useMemo(() => (typeof window === "undefined" ? null : degradationPlan(detectCapabilities(window as unknown as Record<string, unknown>, navigator))), []);
  const canSpeak = plan?.spokenInput === "MICROPHONE_STT";

  async function send(explanation?: Record<string, unknown>) {
    setStep("sending");
    if (mode === "assessment") {
      const r = await api<{ status: string }>("POST", "assessment/answer", { key: attemptKey, answers });
      if (!r.ok) return onProblem(friendlyProblem(r));
      return onResult({ mode, status: r.data.status });
    }
    if (mode === "practice") {
      const r = await api<{ feedback: Feedback }>("POST", "practice/submit", { attemptId: attemptKey, passageId: story.passageId });
      if (!r.ok) return onProblem(friendlyProblem(r));
      return onResult({ mode, feedback: r.data.feedback, attemptId: attemptKey });
    }
    const r = await api<{ feedback: Feedback }>("POST", "passage/submit", { attemptId: attemptKey, passageId: story.passageId, answers, explanation, startedAt: startedAt.current });
    if (!r.ok) return onProblem(friendlyProblem(r));
    return onResult({ mode, feedback: r.data.feedback, attemptId: attemptKey });
  }

  async function speak() {
    setMicNote(null);
    const mic = await requestMicrophoneFor("SPOKEN_COMPREHENSION", navigator as never);
    if (mic.state !== "GRANTED") { setMicNote("No problem - you can type your story instead."); return; }
    const w = window as unknown as Record<string, new () => RecognitionLike>;
    const Rec = w["SpeechRecognition"] ?? w["webkitSpeechRecognition"];
    if (!Rec) { setMicNote("No problem - you can type your story instead."); return; }
    const rec = new Rec();
    rec.lang = "en-IN"; rec.continuous = false; rec.interimResults = false;
    rec.onresult = (e) => {
      const best = e.results[0]?.[0];
      if (best) { setText(best.transcript); setRaw(best.transcript); setConfidence(best.confidence); setAsrFailed(false); }
    };
    rec.onerror = () => { setAsrFailed(true); setListening(false); setMicNote("We could not hear that. You can try again or type your story."); };
    rec.onend = () => setListening(false);
    recRef.current = rec;
    setListening(true);
    rec.start();
  }

  const allAnswered = answers.every((a) => a !== null);

  if (step === "read") {
    return (
      <>
        <Reader tokens={story.tokens} wpm={wpm} onComplete={() => setStep("questions")} />
        {mode === "practice" && <p className={styles.note}>This is a story you already know. Enjoy reading it again!</p>}
      </>
    );
  }

  if (step === "questions") {
    return (
      <section className={styles.card} aria-label="Questions about the story">
        <h2>What do you remember?</h2>
        {story.items.map((item, i) => (
          <fieldset key={item.itemId} className={styles.fieldset}>
            <legend className={styles.legend}>{item.stem}</legend>
            {item.options.map((opt, o) => (
              <label key={o} className={styles.option}>
                <input type="radio" name={item.itemId} checked={answers[i] === o} onChange={() => setAnswers((a) => a.map((x, k) => (k === i ? o : x)))} />
                <span>{opt}</span>
              </label>
            ))}
          </fieldset>
        ))}
        <div className={styles.row}>
          <button type="button" className={styles.primary} disabled={!allAnswered} data-testid="questions-next"
            onClick={() => (mode === "progress" ? setStep("explain") : send())}>
            {mode === "progress" ? "Next" : "Done"}
          </button>
        </div>
      </section>
    );
  }

  if (step === "explain") {
    const empty = text.trim() === "";
    return (
      <section className={styles.card} aria-label="Tell the story">
        <h2>Tell the story in your own words</h2>
        <p>Pretend you are telling a friend what happened.</p>
        <textarea className={styles.textarea} aria-label="Your story" data-testid="explain-text" value={text} onChange={(e) => setText(e.target.value)} />
        {canSpeak && (
          <div className={styles.row}>
            <button type="button" className={styles.secondary} onClick={speak} disabled={listening} data-testid="explain-speak">{listening ? "Listening..." : "Speak instead"}</button>
          </div>
        )}
        {micNote && <p className={styles.note} role="status">{micNote}</p>}
        {raw !== null && <p className={styles.note}>You can fix any words before you send it.</p>}
        <div className={styles.row}>
          <button type="button" className={styles.primary} disabled={empty && !asrFailed} data-testid="explain-send"
            onClick={() => send(empty && asrFailed ? { asrFailed: true, mode: "spoken" } : { text, mode: raw !== null ? "spoken" : "typed", raw: raw ?? undefined, asrConfidence: confidence ?? undefined })}>
            Send
          </button>
        </div>
      </section>
    );
  }

  return <section className={styles.card} role="status"><p>Sending...</p></section>;
}
