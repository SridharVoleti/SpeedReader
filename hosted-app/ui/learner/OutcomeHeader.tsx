"use client";

// The header names the OUTCOME, not the speed: "Read a 200-page book in under 3 hours - with understanding and
// retention." Once the learner's baseline exists it shows what a book would take today, the goal, and how far along the
// journey they are. The exact words-per-minute lives only in a data attribute (tests/analytics), never in the copy.

import identity from "../../app.identity";
import { OUTCOME_HEADLINE, bookGoalView } from "../../lib/v2/book-goal";
import styles from "./learner.module.css";

export default function OutcomeHeader({ speed, startSpeed }: { speed: number | null; startSpeed: number | null }) {
  const goal = speed !== null && startSpeed !== null ? bookGoalView(speed, startSpeed) : null;
  const pct = goal ? Math.round(goal.journey * 100) : 0;

  return (
    <header className={styles.outcome} data-testid="outcome-header">
      <p className={styles.brand}>{identity.displayName}</p>
      <h1 className={styles.headline} data-testid="outcome-headline">{OUTCOME_HEADLINE}</h1>
      {goal && (
        <div className={styles.journey}>
          <p className={styles.bookNow} data-testid="book-time-now" data-wpm={speed ?? undefined}>
            Today, a 200-page book would take you <strong>{goal.nowText}</strong>.
          </p>
          <div className={styles.progressTrack} role="progressbar" aria-label="Your journey to a 3-hour book" aria-valuemin={0} aria-valuemax={100} aria-valuenow={pct} data-testid="journey-bar">
            <div className={styles.progressFill} style={{ width: `${pct}%` }} />
          </div>
          <p className={styles.goalLine} data-testid="book-goal-line">
            Goal: {goal.goalText}.{goal.savedText ? ` You have already saved ${goal.savedText}.` : " Every story gets you closer."}
          </p>
        </div>
      )}
    </header>
  );
}
