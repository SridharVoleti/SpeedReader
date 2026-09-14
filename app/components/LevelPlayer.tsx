"use client";

import { useEffect, useMemo, useState } from "react";
import { ProgressionLevel } from "../../lib/progression";
import { PassageData, ScoreResult, scoreComprehension } from "../../lib/scoring";
import styles from "../page.module.css";

type Phase = "intro" | "reading" | "quiz" | "results";

type Props = {
  level: ProgressionLevel;
  worldName: string;
  passage: PassageData;
  hasNextLevel: boolean;
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
  onRecord,
  onAdvance,
  onExit
}: Props) {
  const [phase, setPhase] = useState<Phase>("intro");
  const [chunkIndex, setChunkIndex] = useState(0);
  const [answer, setAnswer] = useState("");
  const [result, setResult] = useState<ScoreResult | null>(null);

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

  function startReading() {
    setChunkIndex(0);
    setPhase("reading");
  }

  function submitAnswer() {
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
          <button className={styles.primaryButton} onClick={startReading}>
            Start reading
          </button>
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
            {[70, 80, 90].map((threshold) => (
              <span
                key={threshold}
                className={result.score >= threshold ? styles.starOnBig : styles.starOffBig}
              >
                ★
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
