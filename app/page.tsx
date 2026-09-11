"use client";

import passagesData from "../data/passages/level-1.json";
import { useEffect, useState } from "react";
import LevelMap from "./components/LevelMap";
import LevelPlayer from "./components/LevelPlayer";
import {
  levels,
  loadProgress,
  passedCount,
  Progress,
  ProgressionLevel,
  recordResult,
  totalStars,
  worlds
} from "../lib/progression";
import { PassageData } from "../lib/scoring";
import styles from "./page.module.css";

const passages = passagesData as unknown as PassageData[];

function passageForLevel(level: ProgressionLevel): PassageData {
  return passages[(level.id - 1) % passages.length];
}

export default function Home() {
  const [progress, setProgress] = useState<Progress>({});
  const [activeLevelId, setActiveLevelId] = useState<number | null>(null);

  useEffect(() => {
    setProgress(loadProgress());
  }, []);

  const activeLevel = activeLevelId ? levels.find((level) => level.id === activeLevelId) : null;

  if (activeLevel) {
    const worldName =
      worlds.find((world) => world.world === activeLevel.world)?.name ?? "Reading";
    return (
      <main className={styles.shell}>
        <LevelPlayer
          key={activeLevel.id}
          level={activeLevel}
          worldName={worldName}
          passage={passageForLevel(activeLevel)}
          hasNextLevel={activeLevel.id < levels.length}
          onRecord={(score) => setProgress(recordResult(progress, activeLevel, score))}
          onAdvance={() => setActiveLevelId(activeLevel.id + 1)}
          onExit={() => setActiveLevelId(null)}
        />
      </main>
    );
  }

  return (
    <main className={styles.shell}>
      <section className={styles.hero}>
        <div>
          <p className={styles.eyebrow}>Speed Reading Journey</p>
          <h1>Climb from 100 to 200 WPM, one level at a time.</h1>
          <p className={styles.lede}>
            Six worlds, thirty-six levels. Each world widens your eye span by one word — read the
            passage at the target speed, pass the comprehension check, and unlock the next level.
          </p>
        </div>
        <div className={styles.sessionBadge}>
          <span>{passedCount(progress)}</span>
          <small>of {levels.length} levels cleared</small>
        </div>
      </section>

      <section className={styles.summaryBar} aria-label="Overall progress">
        <div className={styles.metric}>
          <span>Levels cleared</span>
          <strong data-testid="levels-cleared">
            {passedCount(progress)}/{levels.length}
          </strong>
        </div>
        <div className={styles.metric}>
          <span>Stars collected</span>
          <strong>
            {totalStars(progress)}/{levels.length * 3} ★
          </strong>
        </div>
        <div className={styles.metric}>
          <span>Worlds</span>
          <strong>{worlds.length} × 6 speed steps</strong>
        </div>
      </section>

      <LevelMap progress={progress} onSelectLevel={(level) => setActiveLevelId(level.id)} />
    </main>
  );
}
