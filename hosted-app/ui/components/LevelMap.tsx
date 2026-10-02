"use client";

import { isPassed, levels, nextPlayableLevel, nodeState, Progress, ProgressionLevel, worlds } from "../../lib/progression";
import styles from "../page.module.css";

type Props = { progress: Progress; onSelectLevel: (level: ProgressionLevel) => void };

export default function LevelMap({ progress, onSelectLevel }: Props) {
  const current = nextPlayableLevel(progress);
  return (
    <div className={styles.map} data-testid="level-map">
      {worlds.map((world) => {
        const worldLevels = levels.filter((level) => level.world === world.world);
        const cleared = worldLevels.filter((level) => isPassed(progress, level.id)).length;
        const unlocked = worldLevels.some((level) => nodeState(progress, level) !== "locked");
        return (
          <section className={`${styles.world} ${!unlocked ? styles.worldLocked : ""}`} key={world.world} aria-label={`World ${world.world}: ${world.name}`}>
            <header className={styles.worldHeader}>
              <span className={styles.worldNumber}>{world.world}</span>
              <div className={styles.worldHeading}>
                <h2>{world.name}</h2>
                <p>{cleared}/{worldLevels.length} levels cleared <span aria-hidden="true">·</span> {worldLevels[0].wpm} — {worldLevels[worldLevels.length - 1].wpm} WPM</p>
              </div>
              <div className={styles.worldBadge}><strong>{world.wordsPerChunk}</strong><small>{world.wordsPerChunk === 1 ? "word" : "words"} at a time</small></div>
            </header>
            <div className={styles.path}>
              <svg className={styles.pathLine} viewBox="0 0 300 510" preserveAspectRatio="none" aria-hidden="true">
                <path d="M76 43 C76 93 222 102 222 144 S76 205 76 246 S222 306 222 348 S76 408 76 450" />
              </svg>
              {worldLevels.map((level) => {
                const state = nodeState(progress, level);
                const stars = progress[String(level.id)]?.stars ?? 0;
                const nodeClass = [styles.node, state === "completed" ? styles.nodePassed : "", current?.id === level.id ? styles.nodeCurrent : "", state === "locked" ? styles.nodeLocked : ""].filter(Boolean).join(" ");
                return (
                  <div className={styles.nodeWrap} key={level.id}>
                    <button className={nodeClass} type="button" data-testid={`level-node-${level.id}`} disabled={state === "locked"} onClick={() => onSelectLevel(level)} aria-label={state === "locked" ? `Level ${level.id} locked` : `Level ${level.id}: ${level.wpm} words per minute`}>
                      {state === "locked" ? <span aria-hidden="true">🔒</span> : <><strong>{level.wpm}</strong><small>{state === "completed" ? "✓ WPM" : "WPM"}</small></>}
                    </button>
                    <span className={styles.nodeStars} aria-label={`${stars} of 3 stars`}>
                      {[1, 2, 3].map((slot) => <span key={slot} className={slot <= stars ? styles.starOn : styles.starOff} aria-hidden="true">{slot <= stars ? "★" : "☆"}</span>)}
                    </span>
                  </div>
                );
              })}
            </div>
          </section>
        );
      })}
    </div>
  );
}
