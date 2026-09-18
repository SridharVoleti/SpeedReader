"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { ProgressionLevel } from "../../lib/progression";
import { PassageData, ScoreResult, scoreComprehension } from "../../lib/scoring";
import styles from "../page.module.css";

type Phase = "intro" | "reading" | "readAlong" | "quiz" | "results";

// Read-along is a fluency demo, not a timed drill: every passage plays at the same natural
// newscaster pace regardless of the level's training WPM, with brief pauses at punctuation.
const READ_ALONG_WPM = 150;

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
  onRecord: (score: number) => void;
  onAdvance: () => void;
  onExit: () => void;
};

function msPerChunk(wpm: number, wordsPerChunk: number) {
  return Math.floor((60_000 / wpm) * wordsPerChunk);
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
  const [isListening, setIsListening] = useState(false);
  const [speechSupported, setSpeechSupported] = useState(false);
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);
  const answerBeforeListeningRef = useRef("");

  const words = useMemo(() => passage.content.split(/\s+/), [passage.content]);
  const totalChunks = Math.ceil(words.length / level.wordsPerChunk);

  useEffect(() => {
    if (phase !== "reading") return;
    if (chunkIndex >= totalChunks) {
      setPhase("quiz");
      return;
    }
    const timer = window.setTimeout(
      () => setChunkIndex((value) => value + 1),
      msPerChunk(level.wpm, level.wordsPerChunk)
    );
    return () => window.clearTimeout(timer);
  }, [phase, chunkIndex, totalChunks, level.wpm, level.wordsPerChunk]);

  useEffect(() => {
    if (phase !== "readAlong" || !readAlongPlaying) return;
    if (readAlongIndex >= words.length) {
      setReadAlongPlaying(false);
      return;
    }
    const baseMs = msPerChunk(READ_ALONG_WPM, 1);
    const timer = window.setTimeout(
      () => setReadAlongIndex((value) => value + 1),
      readAlongDelay(words[readAlongIndex], baseMs)
    );
    return () => window.clearTimeout(timer);
  }, [phase, readAlongPlaying, readAlongIndex, words]);

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
    setChunkIndex(0);
    setPhase("reading");
  }

  function startReadAlong() {
    setReadAlongIndex(0);
    setReadAlongPlaying(true);
    setPhase("readAlong");
  }

  function toggleReadAlongPlaying() {
    setReadAlongPlaying((value) => !value);
  }

  function restartReadAlong() {
    setReadAlongIndex(0);
    setReadAlongPlaying(true);
  }

  function exitReadAlong() {
    setReadAlongPlaying(false);
    setPhase("intro");
  }

  function submitAnswer() {
    recognitionRef.current?.stop();
    const scored = scoreComprehension(passage, answer, level.passThreshold);
    setResult(scored);
    onRecord(scored.score);
    setPhase("results");
  }

  function retryLevel() {
    setChunkIndex(0);
    setAnswer("");
    setResult(null);
    setPhase("intro");
  }

  const highlightStart = Math.min(chunkIndex, totalChunks - 1) * level.wordsPerChunk;
  const highlightEnd = highlightStart + level.wordsPerChunk;
  const activeChunk = words.slice(highlightStart, highlightEnd).join(" ");
  const readingProgress = Math.min(100, Math.round((chunkIndex / totalChunks) * 100));

  return (
    <div className={styles.player} data-testid="level-player">
      <header className={styles.playerHeader}>
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
      </header>

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
        <section className={styles.stageCard} data-testid="read-along">
          <p className={styles.kicker}>Read along</p>
          <h3>{passage.title}</h3>
          <div className={styles.reader} data-testid="reader">
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
        <section className={styles.stageCard}>
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
        <section className={styles.stageCard} data-testid="level-results">
          <p className={styles.kicker}>{result.passed ? "Level cleared!" : "Not yet"}</p>
          <div className={styles.resultScore}>
            <strong data-testid="result-score">{result.score}</strong>
            <span>/ 100</span>
          </div>
          <div className={styles.resultStars} aria-label="Stars earned">
            {/* Accessibility baseline: on/off stars differ by shape, not color alone. */}
            {[70, 80, 90].map((threshold) => (
              <span
                key={threshold}
                className={result.score >= threshold ? styles.starOnBig : styles.starOffBig}
                aria-hidden="true"
              >
                {result.score >= threshold ? "★" : "☆"}
              </span>
            ))}
          </div>
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
