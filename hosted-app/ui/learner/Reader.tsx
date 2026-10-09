"use client";

// One-word-at-a-time reader (APP-READ-001/002/003/005/006). All timing comes from lib/v2/rsvp.ts: positions are
// derived from absolute timestamps, a hidden tab pauses reading (no phantom completion) and completion fires once.

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { initialReader, pause, planRsvp, progress, start, tick, tokenAt, type ReaderState } from "../../lib/v2/rsvp";
import type { Token } from "./api";
import styles from "./learner.module.css";

export type ReaderProps = {
  tokens: Token[];
  wpm: number;
  onComplete: (info: { readingMs: number; interruptions: number }) => void;
};

export default function Reader({ tokens, wpm, onComplete }: ReaderProps) {
  const plan = useMemo(() => planRsvp(tokens, wpm), [tokens, wpm]);
  const stateRef = useRef<ReaderState>(initialReader());
  const rafRef = useRef<number | null>(null);
  const completeRef = useRef(onComplete);
  completeRef.current = onComplete;
  const [phase, setPhase] = useState<ReaderState["phase"]>("READY");
  const [index, setIndex] = useState(0);
  const [pct, setPct] = useState(0);

  const loop = useCallback(() => {
    const now = performance.now();
    const r = tick(plan, stateRef.current, now);
    stateRef.current = r.state;
    const tok = tokenAt(plan, r.state.elapsedMs);
    if (tok) setIndex(tok.index - 1);
    setPct(Math.round(progress(plan, r.state, now) * 100));
    if (r.completed) {
      setPhase("FINISHED");
      completeRef.current({ readingMs: r.state.elapsedMs, interruptions: r.state.interruptions });
      return;
    }
    if (r.state.phase === "PLAYING") rafRef.current = requestAnimationFrame(loop);
  }, [plan]);

  const play = useCallback(() => {
    stateRef.current = start(stateRef.current, performance.now());
    setPhase(stateRef.current.phase);
    rafRef.current = requestAnimationFrame(loop);
  }, [loop]);

  const stop = useCallback(() => {
    if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
    rafRef.current = null;
    stateRef.current = pause(stateRef.current, performance.now());
    setPhase(stateRef.current.phase);
  }, []);

  useEffect(() => {
    const onVisibility = () => { if (document.hidden && stateRef.current.phase === "PLAYING") stop(); };
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      document.removeEventListener("visibilitychange", onVisibility);
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
    };
  }, [stop]);

  const word = tokens[Math.min(index, tokens.length - 1)]?.text ?? "";

  return (
    <section className={styles.readerCard} aria-label="Reading">
      <div className={styles.wordStage} data-testid="reader-stage" aria-live="off">
        {phase === "READY" ? <span className={styles.wordHint}>Tap start when you are ready</span> : null}
        {phase === "PLAYING" || phase === "PAUSED" ? <span className={styles.word} data-testid="reader-word">{word}</span> : null}
        {phase === "FINISHED" ? <span className={styles.wordHint}>Well read!</span> : null}
      </div>
      <div className={styles.progressTrack} role="progressbar" aria-label="Reading progress" aria-valuemin={0} aria-valuemax={100} aria-valuenow={pct}>
        <div className={styles.progressFill} style={{ width: `${pct}%` }} />
      </div>
      <div className={styles.row}>
        {phase === "READY" && <button type="button" className={styles.primary} onClick={play} data-testid="reader-start">Start reading</button>}
        {phase === "PLAYING" && <button type="button" className={styles.secondary} onClick={stop} data-testid="reader-pause">Pause</button>}
        {phase === "PAUSED" && <button type="button" className={styles.primary} onClick={play} data-testid="reader-resume">Keep reading</button>}
      </div>
    </section>
  );
}
