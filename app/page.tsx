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

type LaunchedLearner = { learnerId: string; displayName: string; avatarId: string | null };

function passageForLevel(level: ProgressionLevel): PassageData {
  return passages[(level.id - 1) % passages.length];
}

// Reads the non-httpOnly `speedreader_learner` cookie set by POST /launch (see
// docs/app-launch-integration.md). Absent when the app was opened directly rather than from
// inside BabySteps - that's the normal, fully-supported case too.
function readLaunchedLearner(): LaunchedLearner | null {
  if (typeof document === "undefined") return null;
  const match = document.cookie.match(/(?:^|;\s*)speedreader_learner=([^;]+)/);
  if (!match) return null;
  try {
    return JSON.parse(decodeURIComponent(match[1])) as LaunchedLearner;
  } catch {
    return null;
  }
}

export default function Home() {
  const [progress, setProgress] = useState<Progress>({});
  const [activeLevelId, setActiveLevelId] = useState<number | null>(null);
  const [learner, setLearner] = useState<LaunchedLearner | null>(null);

  useEffect(() => {
    const launched = readLaunchedLearner();
    setLearner(launched);
    setProgress(loadProgress(launched?.learnerId));
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
          onRecord={(score) => setProgress(recordResult(progress, activeLevel, score, learner?.learnerId))}
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
          <p className={styles.eyebrow}>
            {learner ? `Welcome back, ${learner.displayName}` : "Speed Reading Journey"}
          </p>
          <h1>Climb from 100 to 200 WPM, one level at a time.</h1>
          <p className={styles.lede}>
            Six worlds, thirty-six levels. Each world widens your eye span by one word — read the
            passage at the target speed, pass the comprehension check, and unlock the next level.
          </p>
          {learner && (
            <a href="/return" data-testid="return-to-babysteps">
              Return to BabySteps
            </a>
          )}
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
