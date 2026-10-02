"use client";

import { useEffect, useState } from "react";
import { isPassed, levels, passedCount, Progress, totalStars, worlds } from "../../lib/progression";
import styles from "../page.module.css";

type Learner = { displayName: string } | null;

function streakDays(progress: Progress): number {
  const days = new Set(Object.values(progress).filter((item) => item.passed).map((item) => item.completedAt?.slice(0, 10)).filter(Boolean));
  let count = 0;
  const day = new Date();
  if (!days.has(day.toISOString().slice(0, 10))) day.setUTCDate(day.getUTCDate() - 1);
  while (days.has(day.toISOString().slice(0, 10))) { count += 1; day.setUTCDate(day.getUTCDate() - 1); }
  return count;
}

function measuredWpm(progress: Progress, levelId: number, targetWpm: number): number {
  const timing = progress[String(levelId)]?.lastReadingTiming;
  return timing?.actual_duration_ms ? Math.round(timing.word_count * 60000 / timing.actual_duration_ms) : targetWpm;
}

export function ProgressDashboard({ progress }: { progress: Progress }) {
  const cleared = passedCount(progress);
  const stars = totalStars(progress);
  const streak = streakDays(progress);
  const completed = levels.filter((level) => isPassed(progress, level.id));
  const best = completed.length ? Math.max(...completed.map((level) => measuredWpm(progress, level.id, level.wpm))) : null;
  const badges = [
    { label: "First Steps", earned: cleared >= 1 },
    { label: "World 1 Complete", earned: levels.filter((level) => level.world === 1).every((level) => isPassed(progress, level.id)) },
    { label: "7-Day Streak", earned: streak >= 7 },
    { label: "Halfway Hero", earned: cleared >= Math.ceil(levels.length / 2) }
  ];
  return <section className={styles.dashboard} data-testid="progress-dashboard">
    <h1>Your progress</h1>
    <p className={styles.streakPill}>♧ &nbsp;{streak > 0 ? `Day ${streak} streak — let's go!` : "Finish a level to start your streak"}</p>
    <div className={styles.statGrid}>
      <Stat icon="♜" value={`${cleared} / ${levels.length}`} label="Levels cleared" color="blue" />
      <Stat icon="★" value={`${stars} / ${levels.length * 3}`} label="Stars collected" color="orange" />
      <Stat icon="♧" value={`${streak} ${streak === 1 ? "day" : "days"}`} label="Current streak" color="green" />
      <Stat icon="ϟ" value={best ? `${best} WPM` : "—"} label="Personal best WPM" color="gray" />
    </div>
    <h2>Speed history</h2>
    {completed.length ? <div className={styles.historyCard} aria-label="Completed level speed history">{completed.map((level) => { const wpm = measuredWpm(progress, level.id, level.wpm); return <div className={styles.historyRow} key={level.id}><span>Level {level.id}</span><div><span style={{ width: `${Math.min(100, Math.max(8, wpm / 2))}%` }} /></div><strong>{wpm} WPM</strong></div>; })}</div> : <div className={styles.emptyHistory}><span className={styles.emptyIcon}>⌁</span><strong>Your chart starts after Level 1</strong><p>Finish your first level and this fills in with your WPM at every level you clear.</p></div>}
    <h2>Achievements</h2>
    <div className={styles.achievements}>{badges.map((badge) => <div key={badge.label} className={styles.achievement}><span className={badge.earned ? styles.earnedBadge : styles.lockedBadge} aria-hidden="true">{badge.earned ? "★" : "♙"}</span><small>{badge.label}</small></div>)}</div>
    <h2>Worlds</h2>
    <div className={styles.worldProgress}>{worlds.map((world) => { const count = levels.filter((level) => level.world === world.world && isPassed(progress, level.id)).length; const total = levels.filter((level) => level.world === world.world).length; return <div className={styles.worldProgressRow} key={world.world}><span className={styles.worldNumber}>{world.world}</span><div><div className={styles.worldProgressLabel}><strong>{world.name}</strong><span>{count}/{total}</span></div><div className={styles.worldProgressTrack}><span style={{ width: `${count / total * 100}%` }} /></div></div></div>; })}</div>
  </section>;
}

function Stat({ icon, value, label, color }: { icon: string; value: string; label: string; color: string }) {
  return <div className={styles.statCard}><span className={`${styles.statIcon} ${styles[color]}`} aria-hidden="true">{icon}</span><strong>{value}</strong><small>{label}</small></div>;
}

export function SettingsPanel({ learner, onBack }: { learner: Learner; onBack: () => void }) {
  const [reducedMotion, setReducedMotion] = useState(false);
  const [soundEffects, setSoundEffects] = useState(true);
  useEffect(() => { setReducedMotion(window.localStorage.getItem("speedreader-reduced-motion") === "true"); }, []);
  useEffect(() => { setSoundEffects(window.localStorage.getItem("speedreader-sound-effects") !== "false"); }, []);
  function toggleReducedMotion() { const next = !reducedMotion; setReducedMotion(next); window.localStorage.setItem("speedreader-reduced-motion", String(next)); document.documentElement.classList.toggle("reduce-motion", next); }
  function toggleSoundEffects() { const next = !soundEffects; setSoundEffects(next); window.localStorage.setItem("speedreader-sound-effects", String(next)); }
  useEffect(() => { document.documentElement.classList.toggle("reduce-motion", reducedMotion); }, [reducedMotion]);
  return <section className={styles.settings} data-testid="settings-panel">
    <div className={styles.settingsTitle}><button type="button" onClick={onBack} aria-label="Back to home">‹</button><h1>Settings</h1></div>
    <h2>Account</h2><div className={styles.settingsGroup}><div className={styles.settingRow}><span>Name</span><span>{learner?.displayName ?? "Guest learner"}</span></div><div className={styles.settingRow}><span>Email</span><span>Not provided</span></div><div className={styles.settingRow}><span>Account</span><span>{learner ? "Connected through BabySteps" : "Playing on this device"}</span></div></div>
    <h2>Reading preferences</h2><div className={styles.settingsGroup}><div className={styles.settingRow}><span>Sound effects</span><button className={`${styles.switch} ${soundEffects ? styles.switchOn : ""}`} type="button" role="switch" aria-checked={soundEffects} aria-label="Sound effects" onClick={toggleSoundEffects}><span /></button></div><div className={styles.settingRow}><span>Reduced motion</span><button className={`${styles.switch} ${reducedMotion ? styles.switchOn : ""}`} type="button" role="switch" aria-checked={reducedMotion} aria-label="Reduced motion" onClick={toggleReducedMotion}><span /></button></div><div className={styles.settingRow}><span>Daily reminder</span><span>Not available yet</span></div></div>
    <h2>Parent controls</h2><div className={styles.settingsGroup}><div className={styles.settingRow}><span>Screen time limit</span><span>Managed in BabySteps</span></div><div className={styles.settingRow}><span>Require PIN to exit</span><span>Managed in BabySteps</span></div></div>
    <h2>About</h2><div className={styles.settingsGroup}><div className={styles.settingRow}><span>Help &amp; support</span><span>Contact BabySteps</span></div><div className={styles.settingRow}><span>Privacy policy</span><span>See BabySteps</span></div><div className={styles.settingRow}><span>App version</span><span>0.1.0</span></div></div>
    {learner && <a className={styles.returnButton} href="/return">Return to BabySteps</a>}
  </section>;
}
