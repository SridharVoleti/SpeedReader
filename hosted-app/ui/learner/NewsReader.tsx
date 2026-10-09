"use client";

// News Reader (APP-NR-001..010): a parallel, optional oral-communication activity on a story the learner has already
// read. Listen to the reference voice (145 WPM, female, read-along highlight), then read aloud twice. It never
// affects speed, progress or the next story; a missing microphone or an unclear recording is just a different way to
// finish, never a problem for the learner.

import { useEffect, useMemo, useRef, useState } from "react";
import { api, friendlyProblem, type Token } from "./api";
import { browserSpeech, createNarrator, type Narrator, type NarrationSegment } from "../../lib/narrator";
import { adaptRate, expectedMs, initialRate, READ_ALONG_WPM, sentenceSegments, updateMsPerWord, wordIndexAtChar, wordSchedule, wordsStartedBy, type ReadAlongSegment } from "../../lib/read-along-voice";
import { requestMicrophoneFor } from "../../lib/v2/capabilities";
import styles from "./learner.module.css";

type Coaching = { status: "INCOMPLETE" | "UNSCORED" | "COMPLETE"; coaching?: string };
type Stage = "pick" | "listen" | "read" | "done";
type RecognitionLike = {
  lang: string; continuous: boolean; interimResults: boolean;
  onresult: ((e: { results: ArrayLike<ArrayLike<{ transcript: string; confidence: number }>> }) => void) | null;
  onerror: (() => void) | null; onend: (() => void) | null; start(): void; stop(): void;
};

export default function NewsReader({ onExit, onProblem }: { onExit: () => void; onProblem: (m: string) => void }) {
  const [stage, setStage] = useState<Stage>("pick");
  const [stories, setStories] = useState<{ passageId: string }[] | null>(null);
  const [tokens, setTokens] = useState<Token[]>([]);
  const [passageId, setPassageId] = useState("");
  const [highlight, setHighlight] = useState(-1);
  const [narrating, setNarrating] = useState(false);
  const [readNumber, setReadNumber] = useState<1 | 2>(1);
  const [recording, setRecording] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const runKey = useRef(`${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`);
  const narratorRef = useRef<Narrator | null>(null);
  const recRef = useRef<RecognitionLike | null>(null);
  const heard = useRef<{ text: string[]; conf: number[] }>({ text: [], conf: [] });

  const words = useMemo(() => tokens.map((t) => t.text), [tokens]);
  const segments = useMemo(() => sentenceSegments(words), [words]);
  const activeSeg = useRef<(NarrationSegment & ReadAlongSegment) | null>(null);
  const speechStart = useRef<number | null>(null);
  const boundarySeen = useRef(false);
  const schedule = useRef<number[]>([]);
  const rateRef = useRef(initialRate());
  const msPerWord = useRef(60_000 / READ_ALONG_WPM);
  const [tick, setTick] = useState(0);
  const [voiceMode, setVoiceMode] = useState<"voice" | "timer">("voice");

  useEffect(() => {
    void api<{ passages: { passageId: string }[] }>("GET", "news-reader/passages").then((r) => (r.ok ? setStories(r.data.passages) : onProblem(friendlyProblem(r))));
    return () => { narratorRef.current?.dispose(); recRef.current?.stop(); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // reference narrator: created once words are known; start() is called synchronously from the tap (mobile autoplay rules)
  useEffect(() => {
    if (words.length === 0) return;
    const speech = browserSpeech();
    if (!speech) { setVoiceMode("timer"); return; }
    const narrator = createNarrator({
      ...speech,
      gapMs: 0,
      rateFor: () => rateRef.current,
      watchdogMs: (segment) => expectedMs((segment as ReadAlongSegment).text.split(/\s+/).length) * 1.8 + 2500,
      startFallbackMs: 1500,
      onSegmentStart: (segment) => { const seg = segment as NarrationSegment & ReadAlongSegment; activeSeg.current = seg; speechStart.current = null; boundarySeen.current = false; setHighlight(seg.startWord); },
      onSegmentSpoken: (segment) => {
        const seg = segment as NarrationSegment & ReadAlongSegment;
        schedule.current = wordSchedule(words.slice(seg.startWord, seg.endWord + 1), (seg.endWord - seg.startWord + 1) * msPerWord.current);
        speechStart.current = performance.now();
        setTick((t) => t + 1);
      },
      onBoundary: (segment, charIndex) => { const seg = segment as NarrationSegment & ReadAlongSegment; boundarySeen.current = true; setHighlight(Math.min(seg.endWord, seg.startWord + wordIndexAtChar(seg.wordOffsets, charIndex))); },
      onSegmentEnd: (segment, _i, speechMs) => { const seg = segment as NarrationSegment & ReadAlongSegment; const n = seg.endWord - seg.startWord + 1; rateRef.current = adaptRate(rateRef.current, n, speechMs); msPerWord.current = updateMsPerWord(msPerWord.current, n, speechMs); },
      onStatus: (status) => { if (status === "idle") setVoiceMode("timer"); },
      onDone: () => { activeSeg.current = null; setHighlight(-1); setNarrating(false); }
    });
    narratorRef.current = narrator;
    return () => { narrator.dispose(); narratorRef.current = null; };
  }, [words]);

  // no word-boundary events from this voice: interpolate from the real speech start
  useEffect(() => {
    if (!narrating || voiceMode !== "voice") return;
    const i = window.setInterval(() => {
      const seg = activeSeg.current; const t0 = speechStart.current;
      if (!seg || t0 === null || boundarySeen.current) return;
      const idx = Math.min(seg.endWord, seg.startWord + Math.max(0, wordsStartedBy(schedule.current, performance.now() - t0) - 1));
      setHighlight((v) => (v >= seg.startWord && v < idx ? idx : v));
    }, 40);
    return () => window.clearInterval(i);
  }, [narrating, voiceMode, tick]);

  // silent fallback at the reference pace when speech is unsupported or blocked
  useEffect(() => {
    if (!narrating || voiceMode !== "timer") return;
    if (highlight >= words.length - 1) { setNarrating(false); setHighlight(-1); return; }
    const t = window.setTimeout(() => setHighlight((v) => v + 1), 60_000 / READ_ALONG_WPM);
    return () => window.clearTimeout(t);
  }, [narrating, voiceMode, highlight, words.length]);

  async function pick(id: string) {
    setBusy(true);
    const r = await api<{ passage: { passageId: string; tokens: Token[] } }>("POST", "news-reader/start", { passageId: id });
    setBusy(false);
    if (!r.ok) return onProblem(friendlyProblem(r));
    setPassageId(id); setTokens(r.data.passage.tokens); setHighlight(-1); setStage("listen");
  }

  function listen() {
    setHighlight(0);
    setNarrating(true);
    const n = narratorRef.current;
    if (n?.supported) { setVoiceMode("voice"); n.start(segments as unknown as NarrationSegment[]); }
    else setVoiceMode("timer");
  }

  function stopListening() { narratorRef.current?.stop(); setNarrating(false); setHighlight(-1); }

  async function submitRead(capture: { micState: "OK" | "MIC_UNAVAILABLE" | "CAPTURE_FAILED"; transcript?: string; confidence?: number }) {
    setBusy(true);
    const r = await api<{ technicalState: string; coaching: Coaching }>("POST", "news-reader/read", { passageId, readNumber, key: `${runKey.current}-${readNumber}`, ...capture });
    setBusy(false);
    if (!r.ok) return onProblem(friendlyProblem(r));
    if (r.data.coaching.status === "COMPLETE" && r.data.coaching.coaching) setMessage(r.data.coaching.coaching);
    else if (r.data.technicalState !== "OK") setMessage("Thanks for reading! Practising out loud is always a good thing.");
    else setMessage(null);
    if (readNumber === 1) { setReadNumber(2); setNote(null); }
    else setStage("done");
  }

  async function startRecording() {
    setNote(null);
    const mic = await requestMicrophoneFor("NEWS_READER", navigator as never);
    const w = window as unknown as Record<string, new () => RecognitionLike>;
    const Rec = w["SpeechRecognition"] ?? w["webkitSpeechRecognition"];
    if (mic.state !== "GRANTED" || !Rec) { setNote("No problem - we can skip recording this time."); return; }
    heard.current = { text: [], conf: [] };
    const rec = new Rec();
    rec.lang = "en-IN"; rec.continuous = true; rec.interimResults = false;
    rec.onresult = (e) => { for (let i = 0; i < e.results.length; i += 1) { const best = e.results[i]?.[0]; if (best) { heard.current.text[i] = best.transcript; heard.current.conf[i] = best.confidence; } } };
    rec.onerror = () => { setRecording(false); setNote("We could not hear that clearly. You can try again or skip this one."); };
    rec.onend = () => setRecording(false);
    recRef.current = rec; setRecording(true); rec.start();
  }

  function finishRecording() {
    recRef.current?.stop();
    setRecording(false);
    const text = heard.current.text.filter(Boolean).join(" ").trim();
    const confs = heard.current.conf.filter((c) => typeof c === "number" && c > 0);
    void submitRead(text ? { micState: "OK", transcript: text, confidence: confs.length ? confs.reduce((a, b) => a + b, 0) / confs.length : undefined } : { micState: "CAPTURE_FAILED" });
  }

  const showText = (
    <p className={styles.nrText} data-testid="nr-text" aria-label="The story">
      {tokens.map((t, i) => <span key={t.index} className={i === highlight ? styles.nrActive : undefined} data-active={i === highlight ? "true" : undefined}>{t.text}{" "}</span>)}
    </p>
  );

  if (stage === "pick") {
    return (
      <section className={styles.card} data-testid="nr-pick">
        <h2>Reading aloud</h2>
        <p>Pick a story you already know. First listen to a newsreader, then read it out loud yourself.</p>
        {stories === null && <p role="status">Looking for your stories...</p>}
        {stories?.length === 0 && <p>Read a story first, then come back here to practise reading it out loud.</p>}
        <div className={styles.row}>
          {stories?.map((s, i) => <button key={s.passageId} type="button" className={styles.secondary} disabled={busy} onClick={() => void pick(s.passageId)} data-testid={`nr-pick-${i}`}>Story {i + 1}</button>)}
        </div>
        <div className={styles.row}><button type="button" className={styles.secondary} onClick={onExit} data-testid="nr-back">Back</button></div>
      </section>
    );
  }

  if (stage === "listen") {
    return (
      <section className={styles.card}>
        <h2>Listen first</h2>
        {showText}
        <div className={styles.row}>
          {!narrating
            ? <button type="button" className={styles.primary} onClick={listen} data-testid="nr-listen">Listen to the newsreader</button>
            : <button type="button" className={styles.secondary} onClick={stopListening} data-testid="nr-stop">Stop</button>}
          <button type="button" className={styles.secondary} onClick={() => { stopListening(); setStage("read"); }} data-testid="nr-ready">I am ready to read</button>
        </div>
      </section>
    );
  }

  if (stage === "read") {
    return (
      <section className={styles.card} data-testid="nr-read">
        <h2>{readNumber === 1 ? "Your turn" : "Once more, with feeling"}</h2>
        <p>{readNumber === 1 ? "Read the story out loud, clearly, like a newsreader." : "Read it again. A little practice makes it smoother!"}</p>
        {showText}
        <div className={styles.row}>
          {!recording
            ? <button type="button" className={styles.primary} onClick={() => void startRecording()} disabled={busy} data-testid="nr-record">Start reading aloud</button>
            : <button type="button" className={styles.primary} onClick={finishRecording} data-testid="nr-finish">I am done</button>}
          <button type="button" className={styles.secondary} onClick={() => void submitRead({ micState: "MIC_UNAVAILABLE" })} disabled={busy || recording} data-testid="nr-skip">Skip recording</button>
        </div>
        {note && <p className={styles.note} role="status" data-testid="nr-note">{note}</p>}
      </section>
    );
  }

  return (
    <section className={styles.card} data-testid="nr-done">
      <div className={styles.celebrate} aria-hidden="true">🎙️</div>
      <h2>Nice reading out loud!</h2>
      {message && <p data-testid="nr-coaching">{message}</p>}
      <div className={styles.row}><button type="button" className={styles.primary} onClick={onExit} data-testid="nr-exit">Back to my stories</button></div>
    </section>
  );
}
