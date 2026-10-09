"use client";

// The production learner journey (replaces the legacy 36-level demo). Everything authoritative is server-side
// (/api/v3): speed, progress, scoring and evidence. This component only presents the next activity and child-safe
// feedback; it never shows scores, thresholds or result labels.

import { useCallback, useEffect, useRef, useState } from "react";
import identity from "../../app.identity";
import { api, friendlyProblem, type Feedback, type StoryView } from "./api";
import Story, { type StoryMode, type StoryResult } from "./Story";
import styles from "./learner.module.css";

type Next =
  | { activity: "INITIAL_ASSESSMENT" }
  | { activity: "NEW_PROGRESSION"; sequence: number; wpm: number }
  | { activity: "FAMILIAR_PRACTICE"; passageId: string; wpm: number }
  | { activity: "READINESS" }
  | { activity: "NONE"; reason: string };

type View =
  | { k: "boot" }
  | { k: "problem"; message: string }
  | { k: "welcome" }
  | { k: "home"; next: Next }
  | { k: "story"; mode: StoryMode; wpm: number; story: StoryView; key: string }
  | { k: "feedback"; feedback: Feedback; attemptId: string; mode: "progress" | "practice" };

const newKey = (p: string) => `${p}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;

const WAITING_COPY: Record<string, string> = {
  NO_COMPLETED_MATERIAL_FOR_REVIEW: "Today is a review day. Your earlier stories will be here soon.",
  WORLD1_SEQUENCE_COMPLETE: "You have read every story in this world. Amazing work!"
};

export default function LearnerApp() {
  const [view, setView] = useState<View>({ k: "boot" });
  const [speed, setSpeed] = useState<number | null>(null);
  const [bpcText, setBpcText] = useState<string | null>(null);
  const [launched, setLaunched] = useState(false);
  const booted = useRef(false);

  const refreshSpeed = useCallback(async () => {
    const p = await api<{ currentWpm: number }>("GET", "progress");
    if (p.ok) setSpeed(p.data.currentWpm);
  }, []);

  const goHome = useCallback(async () => {
    setBpcText(null);
    const n = await api<{ next: Next }>("GET", "next");
    if (!n.ok) return setView({ k: "problem", message: friendlyProblem(n) });
    if (n.data.next.activity === "INITIAL_ASSESSMENT") return setView({ k: "welcome" });
    await refreshSpeed();
    setView({ k: "home", next: n.data.next });
  }, [refreshSpeed]);

  const boot = useCallback(async () => {
    setView({ k: "boot" });
    const b = await api<{ state: "ASSESSMENT_REQUIRED" | "READY" }>("POST", "bootstrap");
    if (!b.ok) return setView({ k: "problem", message: friendlyProblem(b) });
    await goHome();
  }, [goHome]);

  useEffect(() => {
    if (booted.current) return;
    booted.current = true;
    setLaunched(/(?:^|;\s*)speedreader_learner=/.test(document.cookie));
    void boot();
  }, [boot]);

  async function beginAssessment() {
    const s = await api("POST", "assessment/start");
    if (!s.ok) return setView({ k: "problem", message: friendlyProblem(s) });
    await nextAssessmentStory();
  }

  async function nextAssessmentStory() {
    const p = await api<{ wpm: number; passage: StoryView }>("GET", "assessment/passage");
    if (!p.ok) {
      // a finished assessment has no more passages: finalize it
      if (p.status === 409) return finishAssessment();
      return setView({ k: "problem", message: friendlyProblem(p) });
    }
    setView({ k: "story", mode: "assessment", wpm: p.data.wpm, story: p.data.passage, key: newKey("as") });
  }

  async function finishAssessment() {
    const f = await api("POST", "assessment/finalize");
    if (!f.ok) return setView({ k: "problem", message: friendlyProblem(f) });
    await goHome();
  }

  async function startNext(next: Next) {
    if (next.activity === "NEW_PROGRESSION") {
      const p = await api<{ wpm: number; passage: StoryView }>("GET", "passage/next");
      if (!p.ok) return setView({ k: "problem", message: friendlyProblem(p) });
      return setView({ k: "story", mode: "progress", wpm: p.data.wpm, story: p.data.passage, key: newKey("a") });
    }
    if (next.activity === "FAMILIAR_PRACTICE") {
      const p = await api<{ wpm: number; passage: StoryView }>("GET", "practice/next");
      if (!p.ok) return setView({ k: "problem", message: friendlyProblem(p) });
      return setView({ k: "story", mode: "practice", wpm: p.data.wpm, story: p.data.passage, key: newKey("pr") });
    }
  }

  function onStoryResult(r: StoryResult) {
    if (r.mode === "assessment") {
      if (r.status === "COMPLETE") void finishAssessment();
      else void nextAssessmentStory();
      return;
    }
    void refreshSpeed();
    setView({ k: "feedback", feedback: r.feedback, attemptId: r.attemptId, mode: r.mode });
  }

  async function showBpc(attemptId: string) {
    const r = await api<{ text: string }>("GET", `bpc?attemptId=${encodeURIComponent(attemptId)}`);
    setBpcText(r.ok ? r.data.text : "This explanation is not ready yet. Your story was still great reading!");
  }

  return (
    <main className={styles.shell}>
      <header className={styles.top}>
        <p className={styles.brand}>{identity.displayName}</p>
        {speed !== null && view.k !== "welcome" && <span className={styles.speed} data-testid="speed-badge">Your speed: {speed} words a minute</span>}
      </header>

      {view.k === "boot" && <section className={styles.card} role="status"><p>Getting your stories ready...</p></section>}

      {view.k === "problem" && (
        <section className={`${styles.card} ${styles.error}`} role="alert" data-testid="problem">
          <p>{view.message}</p>
          <div className={styles.row}>
            <button type="button" className={styles.primary} onClick={() => void boot()}>Try again</button>
            {launched && <a href="/return" className={styles.secondary} data-testid="return-to-babysteps">Back to Babysteps</a>}
          </div>
        </section>
      )}

      {view.k === "welcome" && (
        <section className={styles.card}>
          <h1>Let us find your reading speed</h1>
          <p>You will read a few short stories and answer some questions. Take your time - there is no hurry, just do your best.</p>
          <div className={styles.row}><button type="button" className={styles.primary} onClick={() => void beginAssessment()} data-testid="begin-assessment">Let us begin</button></div>
        </section>
      )}

      {view.k === "home" && (
        <section className={styles.card}>
          <h1>Ready to read?</h1>
          {view.next.activity === "NEW_PROGRESSION" && (
            <><p>Your next story is waiting for you.</p><div className={styles.row}><button type="button" className={styles.primary} onClick={() => void startNext(view.next)} data-testid="start-story">Read a story</button></div></>
          )}
          {view.next.activity === "FAMILIAR_PRACTICE" && (
            <><p>Here is a story you know. Reading it again helps you feel confident.</p><div className={styles.row}><button type="button" className={styles.primary} onClick={() => void startNext(view.next)} data-testid="start-practice">Read a story you know</button></div></>
          )}
          {view.next.activity === "READINESS" && <p>Your reading check-in is coming up soon.</p>}
          {view.next.activity === "NONE" && <p>{WAITING_COPY[view.next.reason] ?? "Nothing to read right now. Come back soon!"}</p>}
          {launched && <div className={styles.row}><a href="/return" className={styles.secondary} data-testid="return-to-babysteps">Back to Babysteps</a></div>}
        </section>
      )}

      {view.k === "story" && (
        <Story key={view.key} mode={view.mode} wpm={view.wpm} story={view.story} attemptKey={view.key}
          onResult={onStoryResult} onProblem={(message) => setView({ k: "problem", message })} />
      )}

      {view.k === "feedback" && (
        <section className={`${styles.card} ${view.feedback.newWpm ? styles.levelUp : ""}`} data-testid="feedback">
          <div className={styles.celebrate} aria-hidden="true">{view.feedback.celebration === "LARGE" ? "🎉" : view.feedback.celebration === "SMALL" ? "⭐" : "📖"}</div>
          <h2 data-testid="feedback-message">{view.feedback.message}</h2>
          {view.feedback.newWpm !== undefined && (
            <>
              <p data-testid="new-speed">Your new speed: {view.feedback.newWpm} words a minute</p>
              {view.feedback.bookTime && <p className={styles.bookTime} data-testid="book-time">{view.feedback.bookTime.message}</p>}
            </>
          )}
          {view.feedback.retry && <p>Let us try that story once more.</p>}
          {view.feedback.showBestPossibleComprehension && !view.feedback.retry && bpcText === null && (
            <div className={styles.row}><button type="button" className={styles.secondary} onClick={() => void showBpc(view.attemptId)} data-testid="show-bpc">See how a strong reader might tell it</button></div>
          )}
          {bpcText !== null && <p data-testid="bpc-text">{bpcText}</p>}
          <div className={styles.row}><button type="button" className={styles.primary} onClick={() => void goHome()} data-testid="continue">{view.feedback.retry ? "Try again" : "Keep going"}</button></div>
        </section>
      )}
    </main>
  );
}
