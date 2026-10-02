"use client";

import passagesData from "../data/passages/level-1.json";
import { useEffect, useState } from "react";
import LevelMap from "./components/LevelMap";
import LevelPlayer from "./components/LevelPlayer";
import { ProgressDashboard, SettingsPanel } from "./components/Dashboards";
import { loadApprovedContent } from "../lib/content-gate";
import {
  levels,
  loadProgress,
  passedCount,
  Progress,
  ProgressionLevel,
  recordResult,
  starsForScore,
  totalStars,
  worlds
} from "../lib/progression";
import { PassageData } from "../lib/scoring";
import identity from "../app.identity";
import styles from "./page.module.css";

// SR-R1-003: approved-file-only content - anything missing approval/version/schema validity is
// blocked here, before it can ever reach a learner, and logged as CONTENT_INVALID.
const passages = loadApprovedContent(passagesData as unknown as PassageData[]);

type LaunchedLearner = { learnerId: string; displayName: string; avatarId: string | null };

function passageForLevel(level: ProgressionLevel): PassageData {
  return passages[(level.id - 1) % passages.length];
}

// Reads the non-httpOnly `${identity.cookiePrefix}_learner` cookie set by POST /launch (see
// container/docs/app-launch-integration.md). Absent when the app was opened directly rather than from
// inside BabySteps - that's the normal, fully-supported case too.
function readLaunchedLearner(): LaunchedLearner | null {
  if (typeof document === "undefined") return null;
  const match = document.cookie.match(new RegExp(`(?:^|;\\s*)${identity.cookiePrefix}_learner=([^;]+)`));
  if (!match) return null;
  try {
    return JSON.parse(decodeURIComponent(match[1])) as LaunchedLearner;
  } catch {
    return null;
  }
}

// Best-effort push of a passed level to BabySteps' central progress store (see
// container/docs/app-launch-integration.md). Fire-and-forget: a standalone visit (no `learner`) or any
// failure here is silently a no-op - localStorage (recordResult, above) is already the source
// of truth for gameplay by the time this is called.
function syncLevelPassToBabySteps(level: ProgressionLevel, score: number, learner: LaunchedLearner | null) {
  if (!learner || score < level.passThreshold) return;

  const nextLevel = levels.find((candidate) => candidate.id === level.id + 1) ?? null;
  const worldName = worlds.find((world) => world.world === level.world)?.name ?? "Reading";
  const nextWorldName = nextLevel ? worlds.find((world) => world.world === nextLevel.world)?.name : undefined;
  const promotesWorld = level.step === 6 && nextLevel && nextLevel.world !== level.world;

  const body = {
    levelKey: String(level.id),
    nextLevelKey: nextLevel ? String(nextLevel.id) : "complete",
    progressSummary: {
      currentLevel: `Level ${level.id} — ${worldName}`,
      efficiencyStars: starsForScore(score),
      milestone: promotesWorld && nextWorldName ? `${nextWorldName} unlocked!` : null,
      nextDestination: nextLevel ? `Level ${nextLevel.id} — ${nextWorldName ?? worldName}` : "All levels complete!"
    }
  };

  fetch("/api/babysteps-progress", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body)
  }).catch((e) => {
    console.error("[babysteps-progress] request failed:", e);
  });
}

export default function Home() {
  const [progress, setProgress] = useState<Progress>({});
  const [activeLevelId, setActiveLevelId] = useState<number | null>(null);
  const [learner, setLearner] = useState<LaunchedLearner | null>(null);
  const [tab, setTab] = useState<"home" | "progress" | "settings">("home");

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
          learnerName={learner?.displayName}
          onRecord={(score, readingTiming) => {
            setProgress(
              recordResult(progress, activeLevel, score, learner?.learnerId, readingTiming ?? undefined)
            );
            syncLevelPassToBabySteps(activeLevel, score, learner);
          }}
          onAdvance={() => setActiveLevelId(activeLevel.id + 1)}
          onExit={() => setActiveLevelId(null)}
        />
      </main>
    );
  }

  return (
    <main className={styles.shell}>
      {tab === "home" && <>
        <section className={styles.hero}>
          <div>
            <p className={styles.eyebrow}>⚡ {learner ? `Welcome back, ${learner.displayName}` : "Speed reading journey"}</p>
            <h1>Climb from 100 to 200 WPM, one level at a time.</h1>
            <p className={styles.lede}>Six worlds, thirty-six levels. Each level widens your eye span by one word — read the passage at the target speed, pass the comprehension check, and unlock the next level.</p>
            {learner && <a href="/return" data-testid="return-to-babysteps">Return to BabySteps</a>}
          </div>
          <div className={styles.sessionBadge}><span>{passedCount(progress)}</span><small>/{levels.length}</small></div>
        </section>
        <section className={styles.summaryBar} aria-label="Overall progress">
          <div className={styles.metric}><span className={styles.metricIcon}>♜</span><strong data-testid="levels-cleared">{passedCount(progress)}/{levels.length}</strong><small>Levels cleared</small></div>
          <div className={styles.metric}><span className={styles.metricIcon}>★</span><strong>{totalStars(progress)}/{levels.length * 3}</strong><small>Stars collected</small></div>
          <div className={styles.metric}><span className={styles.metricIcon}>ϟ</span><strong>{worlds.length} × 6</strong><small>Worlds &amp; speed steps</small></div>
        </section>
        <aside className={styles.motivation}><span>♧</span><p><strong>Read a 200-page book in under 3 hours</strong><br />That&apos;s about 280 WPM — keep building your reading speed!</p></aside>
        <LevelMap progress={progress} onSelectLevel={(level) => setActiveLevelId(level.id)} />
      </>}
      {tab === "progress" && <ProgressDashboard progress={progress} />}
      {tab === "settings" && <SettingsPanel learner={learner} onBack={() => setTab("home")} />}
      <nav className={styles.bottomNav} aria-label="Main navigation">
        {(["home", "progress", "settings"] as const).map((item) => <button key={item} type="button" className={tab === item ? styles.navActive : ""} aria-current={tab === item ? "page" : undefined} onClick={() => { setTab(item); window.scrollTo(0, 0); }}><span aria-hidden="true">{item === "home" ? "⌂" : item === "progress" ? "⌁" : "⚙"}</span>{item[0].toUpperCase() + item.slice(1)}</button>)}
      </nav>
    </main>
  );
}
