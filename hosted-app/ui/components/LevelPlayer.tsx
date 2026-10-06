"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { chunkWords } from "../../lib/chunking";
import { levels, ProgressionLevel } from "../../lib/progression";
import { planReadingTiming, recordActualDuration, ReadingTimingRecord } from "../../lib/reading-timing";
import { PassageData, ScoreResult, scoreComprehension } from "../../lib/scoring";
import { browserSpeech, createNarrator, type Narrator, type NarrationSegment } from "../../lib/narrator";
import { adaptRate, expectedMs, initialRate, READ_ALONG_WPM, sentenceSegments, updateMsPerWord, wordIndexAtChar, wordSchedule, wordsStartedBy, type ReadAlongSegment } from "../../lib/read-along-voice";
import styles from "../page.module.css";

type Phase = "intro" | "reading" | "readAlong" | "quiz" | "results";

// Read-along is a fluency demo, not a timed drill: every passage plays at the same natural
// newscaster pace (READ_ALONG_WPM = 145) regardless of the level's training WPM, with brief
// pauses at punctuation. A voice reads each sentence aloud and the highlight follows it.

function readAlongDelay(word: string, baseMs: number) {
  if (/[.!?]$/.test(word)) return baseMs * 1.8;
  if (/[,;:]$/.test(word)) return baseMs * 1.4;
  return baseMs;
}

// Minimal shape of the browser's (non-standard, unprefixed-or-webkit) SpeechRecognition API -
// there's no lib.dom.d.ts type for it yet.
type SpeechRecognitionResultLike = {
  readonly isFinal: boolean;
  readonly 0: { readonly transcript: string };
};

type SpeechRecognitionEventLike = {
  readonly resultIndex: number;
  readonly results: ArrayLike<SpeechRecognitionResultLike>;
};

type SpeechRecognitionLike = {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  onresult: ((event: SpeechRecognitionEventLike) => void) | null;
  onend: (() => void) | null;
  onerror: (() => void) | null;
  start: () => void;
  stop: () => void;
};

type SpeechRecognitionConstructor = new () => SpeechRecognitionLike;

function getSpeechRecognitionConstructor(): SpeechRecognitionConstructor | null {
  if (typeof window === "undefined") return null;
  const globalWindow = window as unknown as {
    SpeechRecognition?: SpeechRecognitionConstructor;
    webkitSpeechRecognition?: SpeechRecognitionConstructor;
  };
  return globalWindow.SpeechRecognition ?? globalWindow.webkitSpeechRecognition ?? null;
}

type Props = {
  level: ProgressionLevel;
  worldName: string;
  passage: PassageData;
  hasNextLevel: boolean;
  /** BabySteps interaction principle: always display active learner context. Undefined for a
   *  standalone (non-BabySteps) visit, where there's no learner identity to show. */
  learnerName?: string;
  onRecord: (score: number, readingTiming: ReadingTimingRecord | null) => void;
  onAdvance: () => void;
  onExit: () => void;
};

function msPerChunk(wpm: number, wordsPerChunk: number) {
  return Math.floor((60_000 / wpm) * wordsPerChunk);
}

function playCompletionSound() {
  if (window.localStorage.getItem("speedreader-sound-effects") === "false") return;
  try {
    const context = new AudioContext();
    [523.25, 659.25, 783.99].forEach((frequency, index) => {
      const oscillator = context.createOscillator();
      const gain = context.createGain();
      const start = context.currentTime + index * 0.12;
      oscillator.type = "sine";
      oscillator.frequency.value = frequency;
      gain.gain.setValueAtTime(0.0001, start);
      gain.gain.exponentialRampToValueAtTime(0.08, start + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, start + 0.22);
      oscillator.connect(gain).connect(context.destination);
      oscillator.start(start);
      oscillator.stop(start + 0.23);
    });
    window.setTimeout(() => void context.close(), 900);
  } catch { /* Audio may be unavailable or blocked by the browser. */ }
}

export default function LevelPlayer({
  level,
  worldName,
  passage,
  hasNextLevel,
  learnerName,
  onRecord,
  onAdvance,
  onExit
}: Props) {
  const [phase, setPhase] = useState<Phase>("intro");
  const [chunkIndex, setChunkIndex] = useState(0);
  const [answer, setAnswer] = useState("");
  const [result, setResult] = useState<ScoreResult | null>(null);
  const [readAlongIndex, setReadAlongIndex] = useState(0);
  const [readAlongPlaying, setReadAlongPlaying] = useState(false);
  const narratorRef = useRef<Narrator | null>(null);
  const readAlongRateRef = useRef(initialRate());
  // The voice is the clock. activeSegRef is the sentence being spoken; speechStartRef is set only
  // when the engine really starts producing sound (cloud voices lag the speak() call), so the
  // highlight never runs ahead of the voice. Word-boundary events pin the exact word; without them
  // the highlight is interpolated from that real start using this voice's measured speed.
  const activeSegRef = useRef<ReadAlongSegment | null>(null);
  const speechStartRef = useRef<number | null>(null);
  const scheduleRef = useRef<number[]>([]);
  const boundarySeenRef = useRef(false);
  const msPerWordRef = useRef(60000 / READ_ALONG_WPM);
  const [speechTick, setSpeechTick] = useState(0);
  // "timer" = no usable voice, fall back to the silent fixed-pace highlighter.
  const [voiceMode, setVoiceMode] = useState<"voice" | "timer">("timer");
  const [isListening, setIsListening] = useState(false);
  const [speechSupported, setSpeechSupported] = useState(false);
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);
  const answerBeforeListeningRef = useRef("");
  const readingStartedAtRef = useRef<number | null>(null);
  const [readingTiming, setReadingTiming] = useState<ReadingTimingRecord | null>(null);

  const words = useMemo(() => passage.content.split(/\s+/), [passage.content]);
  // SR-R1-002: chunkWords guarantees every source token is presented exactly once, in source
  // order - no omission/duplication - regardless of chunk size.
  const chunks = useMemo(() => chunkWords(words, level.wordsPerChunk), [words, level.wordsPerChunk]);
  // SR-R1-001: planned timing is a pure function of word count/target WPM/chunk size, so the
  // same passage/WPM/chunks combination always plans identically.
  const timingPlan = useMemo(
    () => planReadingTiming(words.length, level.wpm, level.wordsPerChunk),
    [words.length, level.wpm, level.wordsPerChunk]
  );
  const totalChunks = chunks.length;

  useEffect(() => {
    if (phase !== "reading") return;
    if (chunkIndex >= totalChunks) {
      if (readingStartedAtRef.current !== null) {
        setReadingTiming(recordActualDuration(timingPlan, readingStartedAtRef.current, Date.now()));
        readingStartedAtRef.current = null;
      }
      setPhase("quiz");
      return;
    }
    const timer = window.setTimeout(
      () => setChunkIndex((value) => value + 1),
      timingPlan.ms_per_chunk
    );
    return () => window.clearTimeout(timer);
  }, [phase, chunkIndex, totalChunks, timingPlan]);

  const readAlongSegments = useMemo(() => sentenceSegments(words), [words]);

  // One narrator for the lifetime of the player. Created on mount (not on tap) so that the tap
  // handler can call start() synchronously, as mobile autoplay rules require.
  useEffect(() => {
    const speech = browserSpeech();
    if (!speech) return;
    const narrator = createNarrator({
      ...speech,
      gapMs: 0,
      rateFor: () => readAlongRateRef.current,
      watchdogMs: (segment) => expectedMs((segment as ReadAlongSegment).text.split(/\s+/).length) * 1.8 + 2500,
      startFallbackMs: 1500,
      onSegmentStart: (segment) => {
        const seg = segment as NarrationSegment & ReadAlongSegment;
        activeSegRef.current = seg;
        speechStartRef.current = null;
        boundarySeenRef.current = false;
        setReadAlongIndex(seg.startWord);
      },
      onSegmentSpoken: (segment) => {
        const seg = segment as NarrationSegment & ReadAlongSegment;
        const count = seg.endWord - seg.startWord + 1;
        scheduleRef.current = wordSchedule(words.slice(seg.startWord, seg.endWord + 1), count * msPerWordRef.current);
        speechStartRef.current = performance.now();
        setSpeechTick((tick) => tick + 1);
      },
      onBoundary: (segment, charIndex) => {
        const seg = segment as NarrationSegment & ReadAlongSegment;
        boundarySeenRef.current = true;
        setReadAlongIndex(Math.min(seg.endWord, seg.startWord + wordIndexAtChar(seg.wordOffsets, charIndex)));
      },
      onSegmentEnd: (segment, _index, speechMs) => {
        const seg = segment as NarrationSegment & ReadAlongSegment;
        const count = seg.endWord - seg.startWord + 1;
        readAlongRateRef.current = adaptRate(readAlongRateRef.current, count, speechMs);
        msPerWordRef.current = updateMsPerWord(msPerWordRef.current, count, speechMs);
      },
      onStatus: (status) => {
        // Engine error / blocked audio: fall back to the silent highlighter rather than stall.
        if (status === "idle") setVoiceMode("timer");
      },
      onDone: () => {
        activeSegRef.current = null;
        setReadAlongIndex(Number.MAX_SAFE_INTEGER);
        setReadAlongPlaying(false);
      }
    });
    narratorRef.current = narrator;
    return () => {
      narrator.dispose();
      narratorRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Voice mode, no word-boundary events from this voice: interpolate from the real speech start.
  useEffect(() => {
    if (phase !== "readAlong" || !readAlongPlaying || voiceMode !== "voice") return;
    const interval = window.setInterval(() => {
      const seg = activeSegRef.current;
      const startedAt = speechStartRef.current;
      if (!seg || startedAt === null || boundarySeenRef.current) return;
      const started = wordsStartedBy(scheduleRef.current, performance.now() - startedAt);
      const index = Math.min(seg.endWord, seg.startWord + Math.max(0, started - 1));
      setReadAlongIndex((value) => (value >= seg.startWord && value < index ? index : value));
    }, 40);
    return () => window.clearInterval(interval);
  }, [phase, readAlongPlaying, voiceMode, speechTick]);

  // Timer mode (speech unsupported or failed): the original fixed-pace highlighter.
  useEffect(() => {
    if (phase !== "readAlong" || !readAlongPlaying || voiceMode !== "timer") return;
    if (readAlongIndex >= words.length) {
      setReadAlongPlaying(false);
      return;
    }
    const timer = window.setTimeout(
      () => setReadAlongIndex((value) => value + 1),
      readAlongDelay(words[readAlongIndex], msPerChunk(READ_ALONG_WPM, 1))
    );
    return () => window.clearTimeout(timer);
  }, [phase, readAlongPlaying, voiceMode, readAlongIndex, words]);

  useEffect(() => {
    setSpeechSupported(getSpeechRecognitionConstructor() !== null);
  }, []);

  // Leaving the comprehension check (submit, retry, or exit) should always release the
  // microphone rather than leave it listening in the background.
  useEffect(() => {
    if (phase !== "quiz") {
      recognitionRef.current?.stop();
    }
  }, [phase]);

  useEffect(() => {
    return () => {
      recognitionRef.current?.stop();
    };
  }, []);

  function toggleListening() {
    if (isListening) {
      recognitionRef.current?.stop();
      return;
    }

    const SpeechRecognitionCtor = getSpeechRecognitionConstructor();
    if (!SpeechRecognitionCtor) return;

    const recognition = new SpeechRecognitionCtor();
    recognition.lang = "en-US";
    recognition.continuous = true;
    recognition.interimResults = true;
    answerBeforeListeningRef.current = answer.trim().length > 0 ? `${answer.trim()} ` : "";

    let finalTranscript = "";
    recognition.onresult = (event) => {
      let interim = "";
      for (let i = event.resultIndex; i < event.results.length; i += 1) {
        const result = event.results[i];
        const transcript = result[0].transcript;
        if (result.isFinal) {
          finalTranscript += `${transcript.trim()} `;
        } else {
          interim += transcript;
        }
      }
      setAnswer(`${answerBeforeListeningRef.current}${finalTranscript}${interim}`);
    };
    recognition.onend = () => setIsListening(false);
    recognition.onerror = () => setIsListening(false);

    recognitionRef.current = recognition;
    recognition.start();
    setIsListening(true);
  }

  function startReading() {
    narratorRef.current?.stop();
    setChunkIndex(0);
    readingStartedAtRef.current = Date.now();
    setPhase("reading");
  }

  // Everything below runs inside the learner's tap, so the first speak() is allowed on mobile.
  function speakReadAlong() {
    readAlongRateRef.current = initialRate();
    msPerWordRef.current = 60000 / READ_ALONG_WPM;
    activeSegRef.current = null;
    speechStartRef.current = null;
    setVoiceMode(narratorRef.current?.supported ? "voice" : "timer");
    narratorRef.current?.start(readAlongSegments);
  }

  function startReadAlong() {
    setReadAlongIndex(0);
    setReadAlongPlaying(true);
    setPhase("readAlong");
    speakReadAlong();
  }

  function toggleReadAlongPlaying() {
    if (readAlongPlaying) narratorRef.current?.pause();
    else narratorRef.current?.resume(); // restarts the current sentence; the highlight rewinds with it
    setReadAlongPlaying((value) => !value);
  }

  function restartReadAlong() {
    setReadAlongIndex(0);
    setReadAlongPlaying(true);
    speakReadAlong();
  }

  function exitReadAlong() {
    narratorRef.current?.stop();
    setReadAlongPlaying(false);
    setPhase("intro");
  }

  function submitAnswer() {
    recognitionRef.current?.stop();
    const scored = scoreComprehension(passage, answer, level.passThreshold);
    if (scored.passed) playCompletionSound();
    setResult(scored);
    onRecord(scored.score, readingTiming);
    setPhase("results");
  }

  function retryLevel() {
    setChunkIndex(0);
    setAnswer("");
    setResult(null);
    setReadingTiming(null);
    setPhase("intro");
  }

  const activeChunkIndex = Math.min(chunkIndex, chunks.length - 1);
  const highlightStart = activeChunkIndex * level.wordsPerChunk;
  const highlightEnd = highlightStart + (chunks[activeChunkIndex]?.length ?? 0);
  const activeChunk = (chunks[activeChunkIndex] ?? []).join(" ");
  const readingProgress = Math.min(100, Math.round((chunkIndex / totalChunks) * 100));

  return (
    <div className={styles.player} data-testid="level-player">
      {phase !== "results" && <header className={styles.playerHeader}>
        <button className={styles.backButton} onClick={onExit} aria-label="Back to level map">
          ← Map
        </button>
        <div className={styles.playerTitle}>
          <p className={styles.kicker}>
            World {level.world} • {worldName}
          </p>
          <h2>
            Level {level.id} — {level.wordsPerChunk}{" "}
            {level.wordsPerChunk === 1 ? "word" : "words"} at {level.wpm} WPM
          </h2>
        </div>
        {learnerName && (
          <span className={styles.learnerBadge} data-testid="learner-badge">
            {learnerName}
          </span>
        )}
      </header>}

      {phase === "intro" && (
        <section className={styles.stageCard}>
          <p className={styles.kicker}>Today&apos;s passage</p>
          <h3>{passage.title}</h3>
          <p className={styles.stageHint}>
            The passage will play once, highlighting {level.wordsPerChunk}{" "}
            {level.wordsPerChunk === 1 ? "word" : "words"} at a time at {level.wpm} words per
            minute. Read carefully — a comprehension check follows, and you need{" "}
            {level.passThreshold} points to unlock the next level.
          </p>
          <div className={styles.actions}>
            <button className={styles.primaryButton} onClick={startReading}>
              Start reading
            </button>
            <button
              className={styles.secondaryButton}
              data-testid="read-along-start"
              onClick={startReadAlong}
            >
              Read along like a news reader
            </button>
          </div>
        </section>
      )}

      {phase === "readAlong" && (
        <section className={styles.stageCard} data-testid="read-along" data-narration-lock="read-along">
          <p className={styles.kicker}>Read along</p>
          <h3>{passage.title}</h3>
          <p className={styles.stageHint} data-testid="read-along-voice-note">
            A female news-reader voice at {READ_ALONG_WPM} words per minute.
          </p>
          <div className={styles.reader} data-testid="reader" data-narrate-skip>
            <div className={styles.contextLine} aria-hidden="true">
              {words.map((word, index) => (
                <span
                  key={`read-along-${word}-${index}`}
                  className={index === readAlongIndex ? styles.visibleWord : styles.readWord}
                >
                  {word}
                </span>
              ))}
            </div>
            <span
              className={styles.screenReaderOnly}
              aria-live="polite"
              data-testid="read-along-active-word"
            >
              {words[Math.min(readAlongIndex, words.length - 1)]}
            </span>
          </div>
          <div className={styles.progressTrack} aria-hidden="true">
            <div
              className={styles.progressFill}
              style={{ width: `${Math.min(100, Math.round((readAlongIndex / words.length) * 100))}%` }}
            />
          </div>
          {readAlongIndex < words.length ? (
            <>
              <p className={styles.stageHint}>
                Read each highlighted word aloud as it lights up, like a news anchor following a
                teleprompter. Keep going even if you fall a little behind — the highlight won&apos;t
                wait.
              </p>
              <div className={styles.actions}>
                <button
                  className={styles.primaryButton}
                  data-testid="read-along-toggle"
                  onClick={toggleReadAlongPlaying}
                >
                  {readAlongPlaying ? "Pause" : "Resume"}
                </button>
                <button
                  className={styles.secondaryButton}
                  data-testid="read-along-restart"
                  onClick={restartReadAlong}
                >
                  Restart
                </button>
                <button className={styles.secondaryButton} onClick={exitReadAlong}>
                  Exit read along
                </button>
              </div>
            </>
          ) : (
            <>
              <p className={styles.stageHint} data-testid="read-along-done">
                Nice reading! Try it again for more fluency, or move on to the timed level.
              </p>
              <div className={styles.actions}>
                <button className={styles.primaryButton} onClick={startReading}>
                  Start timed level
                </button>
                <button
                  className={styles.secondaryButton}
                  data-testid="read-along-restart"
                  onClick={restartReadAlong}
                >
                  Read along again
                </button>
                <button className={styles.secondaryButton} onClick={exitReadAlong}>
                  Back
                </button>
              </div>
            </>
          )}
        </section>
      )}

      {phase === "reading" && (
        <section className={styles.stageCard} data-narration-lock="timed-reading" data-narrate-skip>
          <div className={styles.reader} data-testid="reader">
            <div className={styles.contextLine} aria-hidden="true">
              {words.map((word, index) => {
                const className =
                  index >= highlightStart && index < highlightEnd
                    ? styles.visibleWord
                    : index < highlightStart
                      ? styles.readWord
                      : styles.blurredWord;
                return (
                  <span key={`${word}-${index}`} className={className}>
                    {word}
                  </span>
                );
              })}
            </div>
            <span className={styles.screenReaderOnly} data-testid="active-chunk">
              {activeChunk}
            </span>
          </div>
          <div className={styles.progressTrack} aria-hidden="true">
            <div className={styles.progressFill} style={{ width: `${readingProgress}%` }} />
          </div>
          <p className={styles.stageHint}>
            {level.wpm} WPM • chunk {Math.min(chunkIndex + 1, totalChunks)} of {totalChunks}
          </p>
        </section>
      )}

      {phase === "quiz" && (
        <section className={styles.stageCard}>
          <p className={styles.kicker}>Comprehension check</p>
          <h3>What do you remember from “{passage.title}”?</h3>
          <p className={styles.stageHint}>
            Write the main idea and the important details in your own words (at least{" "}
            {passage.comprehension.minimumResponseWords} words).
          </p>
          <div className={styles.speechRow}>
            {speechSupported ? (
              <button
                type="button"
                className={isListening ? styles.primaryButton : styles.secondaryButton}
                data-testid="speech-to-text-toggle"
                data-narration-stop
                aria-pressed={isListening}
                onClick={toggleListening}
              >
                {isListening ? "⏹ Stop talking" : "🎤 Speak your answer"}
              </button>
            ) : (
              <p className={styles.stageHint} data-testid="speech-unsupported-hint">
                Speech input isn&apos;t available in this browser — you can still type your
                answer below.
              </p>
            )}
            {isListening && (
              <span
                className={styles.listeningBadge}
                data-testid="listening-indicator"
                aria-live="polite"
              >
                <span className={styles.listeningDot} aria-hidden="true" />
                Listening…
              </span>
            )}
          </div>
          <textarea
            className={styles.quizInput}
            data-testid="quiz-answer"
            rows={6}
            value={answer}
            placeholder="Type what happened in the passage..."
            onChange={(event) => setAnswer(event.target.value)}
          />
          <div className={styles.actions}>
            <button
              className={styles.primaryButton}
              data-testid="quiz-submit"
              disabled={answer.trim().length === 0}
              onClick={submitAnswer}
            >
              Submit answer
            </button>
            <button className={styles.secondaryButton} onClick={retryLevel}>
              Read again
            </button>
          </div>
        </section>
      )}

      {phase === "results" && result && (
        <section className={styles.resultPage} data-testid="level-results">
          <div className={styles.resultHero}>
            <button type="button" className={styles.resultClose} onClick={onExit} aria-label="Back to map">×</button>
            <p className={styles.resultEyebrow}>⚡ {result.passed ? "Level complete" : "Keep going"}</p>
            <div className={styles.resultStars} aria-label="Stars earned">
              {[70, 80, 90].map((threshold) => <span key={threshold} className={result.score >= threshold ? styles.starOnBig : styles.starOffBig} aria-hidden="true">{result.score >= threshold ? "★" : "☆"}</span>)}
            </div>
            <h1>{result.passed ? `Level ${level.id} clear!` : `Level ${level.id} — try again`}</h1>
            <p>{result.passed ? `You cleared ${worldName} at a target of ${level.wpm} WPM.` : `Reach ${level.passThreshold} comprehension points to unlock the next level.`}</p>
          </div>
          <div className={styles.resultMetrics}>
            <div><span aria-hidden="true">ϟ</span><strong>{readingTiming?.actual_duration_ms ? Math.round(readingTiming.word_count * 60000 / readingTiming.actual_duration_ms) : level.wpm} WPM</strong><small>Your speed</small></div>
            <div><span aria-hidden="true">✓</span><strong className={styles.resultScore}><span data-testid="result-score">{result.score}</span> / 100</strong><small>Comprehension</small></div>
            <div><span aria-hidden="true">★</span><strong>+{[70, 80, 90].filter((threshold) => result.score >= threshold).length}</strong><small>Stars earned</small></div>
          </div>
          <p className={styles.resultWorldMeta}>{worldName} · Level {level.step} of 6</p>
          {result.passed && hasNextLevel && <div className={styles.upNext}><div><small>Up next</small><strong>Level {level.id + 1}</strong></div><span>{level.step === 6 ? 100 : levels.find((next) => next.id === level.id + 1)?.wpm} <small>WPM target</small></span></div>}
          <dl className={styles.breakdown}>
            <Item label="Detail (length)" value={result.lengthPoints} max={15} />
            <Item label="Key facts" value={result.keywordPoints} max={30} />
            <Item label="Main ideas" value={result.conceptPoints} max={35} />
            <Item label="Own words" value={result.originalityPoints} max={10} />
            <Item label="Clarity" value={result.coherencePoints} max={10} />
          </dl>
          <ul className={styles.feedbackList}>
            {result.feedback.map((note) => (
              <li key={note}>{note}</li>
            ))}
          </ul>
          <div className={styles.actions}>
            {result.passed && hasNextLevel && (
              <button
                className={styles.primaryButton}
                data-testid="next-level"
                onClick={onAdvance}
              >
                Next level →
              </button>
            )}
            <button className={styles.secondaryButton} onClick={retryLevel}>
              {result.passed ? "Improve score" : "Try again"}
            </button>
            <button className={styles.secondaryButton} onClick={onExit}>
              Back to map
            </button>
          </div>
        </section>
      )}
    </div>
  );
}

function Item({ label, value, max }: { label: string; value: number; max: number }) {
  return (
    <div className={styles.breakdownItem}>
      <dt>{label}</dt>
      <dd>
        {value}/{max}
      </dd>
    </div>
  );
}
