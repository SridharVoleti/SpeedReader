"use client";

// Issue #14 - the live learner journey for an approved SR package:
//   read -> answer 4 items (all committed before any reveal) -> explain in own words (browser speech or typed
//   fallback, editable transcript) -> feedback, news-reader replay, optional retry, revisit list, readiness shown
//   separately. Never blocks: speech failure or an unsupported browser only changes how the learner answers.

import { useEffect, useMemo, useRef, useState } from "react";
import { browserSpeech, createNarrator, type Narrator } from "../../lib/narrator";
import {
  createExplainSessionFromWindow, editText, receiveAsr, receiveAsrError, submissionPayload, submitExplanation, type ExplainSession
} from "../../lib/sr/runtime/explain-session";
import styles from "../page.module.css";

type View = { packageId: string; passageId: string; text: string; items: { itemId: string; stem: string; options: string[] }[]; revisit: string[] };
type Result = {
  firstAttempt: boolean;
  comprehension: { pass: boolean; correct: number; reason: string; items: { itemId: string; correct: boolean; correctIndex: number }[] };
  explanation: { states: Record<string, string>; credited: number; total: number; hints: string[]; reviewNeeded: boolean };
  feedback: { replay: { offered: boolean; text: string; wpm: number }; retryOptional: boolean };
  revisit: string[];
  readiness: { comprehension: string; oral: string };
};
type RecognitionLike = {
  lang: string; continuous: boolean; interimResults: boolean;
  onresult: ((e: { results: ArrayLike<ArrayLike<{ transcript: string; confidence: number }>> }) => void) | null;
  onerror: (() => void) | null; onend: (() => void) | null; start(): void; stop(): void;
};

function learnerId(): string {
  try {
    const k = "sr_learner_id";
    let v = window.localStorage.getItem(k);
    if (!v) { v = `L-${Math.random().toString(36).slice(2, 10)}`; window.localStorage.setItem(k, v); }
    return v;
  } catch { return "L-anonymous"; }
}

export default function ExplainPage() {
  const [view, setView] = useState<View | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [answers, setAnswers] = useState<(number | null)[]>([]);
  const [session, setSession] = useState<ExplainSession | null>(null);
  const [listening, setListening] = useState(false);
  const [result, setResult] = useState<Result | null>(null);
  const [busy, setBusy] = useState(false);
  const recRef = useRef<RecognitionLike | null>(null);
  const narratorRef = useRef<Narrator | null>(null);
  const pkgId = useMemo(() => (typeof window === "undefined" ? "" : new URLSearchParams(window.location.search).get("pkg") ?? ""), []);

  useEffect(() => {
    if (!pkgId) { setError("No package selected (?pkg=PKG-W1-0001)."); return; }
    fetch(`/api/sr/package?id=${encodeURIComponent(pkgId)}&learnerId=${encodeURIComponent(learnerId())}`)
      .then(async (r) => (r.ok ? ((await r.json()) as View) : Promise.reject(new Error(((await r.json()) as { error: string }).error))))
      .then((v) => { setView(v); setAnswers(v.items.map(() => null)); setSession(createExplainSessionFromWindow(v.packageId, window as unknown as Record<string, unknown>)); })
      .catch((e: Error) => setError(e.message));
    return () => { recRef.current?.stop(); narratorRef.current?.dispose(); };
  }, [pkgId]);

  function startListening() {
    const w = window as unknown as { SpeechRecognition?: new () => RecognitionLike; webkitSpeechRecognition?: new () => RecognitionLike };
    const Ctor = w.SpeechRecognition ?? w.webkitSpeechRecognition;
    if (!Ctor || !session) return;
    const rec = new Ctor();
    rec.lang = "en-IN"; rec.continuous = false; rec.interimResults = false;
    let got = false;
    rec.onresult = (e) => {
      const alt = e.results[0]?.[0];
      got = true;
      setSession((s) => (s ? receiveAsr(s, alt?.transcript ?? "", alt?.confidence ?? 0) : s));
    };
    rec.onerror = () => { setListening(false); setSession((s) => (s ? receiveAsrError(s) : s)); };
    rec.onend = () => { setListening(false); if (!got) setSession((s) => (s && s.phase === "CAPTURE" ? receiveAsrError(s) : s)); };
    recRef.current = rec; setListening(true);
    try { rec.start(); } catch { setListening(false); setSession((s) => (s ? receiveAsrError(s) : s)); }
  }

  async function submit() {
    if (!view || !session || answers.some((a) => a === null)) return;
    setBusy(true);
    try {
      const done = submitExplanation(session);
      setSession(done);
      const r = await fetch("/api/sr/attempt", {
        method: "POST", headers: { "content-type": "application/json" },
        body: JSON.stringify({ learnerId: learnerId(), packageId: view.packageId, answers, explanation: submissionPayload(done) })
      });
      const body = (await r.json()) as Result & { error?: string };
      if (!r.ok) throw new Error(body.error ?? "submit failed");
      setResult(body);
    } catch (e) { setError((e as Error).message); }
    finally { setBusy(false); }
  }

  function replay() {
    if (!result) return;
    const speech = browserSpeech();
    if (!speech) return;
    narratorRef.current?.dispose();
    narratorRef.current = createNarrator({ ...speech });
    narratorRef.current.start([{ text: result.feedback.replay.text }]);
  }

  function retry() {
    if (!view) return;
    setResult(null); setAnswers(view.items.map(() => null));
    setSession(createExplainSessionFromWindow(view.packageId, window as unknown as Record<string, unknown>));
  }

  if (error) return <main className={styles.shell}><p role="alert" data-testid="sr-error">{error}</p></main>;
  if (!view || !session) return <main className={styles.shell}><p>Loading...</p></main>;

  const canSubmit = answers.every((a) => a !== null) && session.transcript.draft.trim().length > 0 && !busy && !result;
  return (
    <main className={styles.shell} data-testid="sr-explain">
      <h1>Read, answer, then explain</h1>
      <section aria-label="Passage" data-testid="sr-passage"><p>{view.text}</p></section>

      <section aria-label="Questions">
        {view.items.map((item, n) => (
          <fieldset key={item.itemId} data-testid={`sr-item-${item.itemId}`} disabled={!!result}>
            <legend>{item.stem}</legend>
            {item.options.map((o, k) => (
              <label key={k} style={{ display: "block" }}>
                <input type="radio" name={item.itemId} checked={answers[n] === k} onChange={() => setAnswers((a) => a.map((x, i) => (i === n ? k : x)))} /> {o}
                {result && result.comprehension.items[n].correctIndex === k ? " (correct)" : ""}
              </label>
            ))}
          </fieldset>
        ))}
      </section>

      <section aria-label="Explain in your own words">
        <h2>Tell me about the passage in your own words.</h2>
        {session.plan.input === "BROWSER_STT" && !session.typedFallback ? (
          <button type="button" className={styles.primaryButton} onClick={startListening} disabled={listening || !!result} data-testid="sr-speak">
            {listening ? "Listening..." : "Speak"}
          </button>
        ) : (
          <p data-testid="sr-typed-note">{session.typedFallback && session.transcript.asrFailed ? "We couldn't hear that - please type your answer." : "Speech isn't available here - please type your answer."}</p>
        )}
        <label>
          <span className={styles.stageHint}>Your answer (you can edit it)</span>
          <textarea data-testid="sr-transcript" rows={4} style={{ width: "100%" }} disabled={!!result} value={session.transcript.draft}
            onChange={(e) => setSession((s) => (s ? editText(s, e.target.value) : s))} />
        </label>
        <button type="button" className={styles.primaryButton} onClick={submit} disabled={!canSubmit} data-testid="sr-submit">Submit</button>
      </section>

      {result && (
        <section aria-label="Feedback" data-testid="sr-feedback">
          <h2>How it went</h2>
          <p data-testid="sr-comprehension">Questions: {result.comprehension.correct} of {view.items.length} right{result.firstAttempt ? " (first try)" : " (practice try)"}.</p>
          <p data-testid="sr-explained">You covered {result.explanation.credited} of {result.explanation.total} ideas.{result.explanation.reviewNeeded ? " Some of your wording needs a quick check - nothing is marked wrong." : ""}</p>
          {result.explanation.hints.length > 0 && (<ul data-testid="sr-hints">{result.explanation.hints.map((h) => <li key={h}>Remember: {h}</li>)}</ul>)}
          {result.feedback.replay.offered && (<button type="button" onClick={replay} data-testid="sr-replay">Hear it read like a news reader</button>)}
          {result.feedback.retryOptional && result.feedback.replay.offered && (<button type="button" onClick={retry} data-testid="sr-retry">Try again (optional)</button>)}
          <p data-testid="sr-readiness">Comprehension readiness: {result.readiness.comprehension.replace(/_/g, " ").toLowerCase()}. Oral reading readiness: {result.readiness.oral.replace(/_/g, " ").toLowerCase()}. These are tracked separately.</p>
          {result.revisit.length > 0 && (<p data-testid="sr-revisit">Worth a calm second look later: {result.revisit.join(", ")}. You can carry on with a new passage any time.</p>)}
          <a href="/" data-testid="sr-continue">Continue</a>
        </section>
      )}
    </main>
  );
}
