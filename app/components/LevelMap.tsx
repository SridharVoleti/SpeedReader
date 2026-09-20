"use client";

import {
  isPassed,
  isUnlocked,
  levels,
  nextPlayableLevel,
  nodeState,
  Progress,
  ProgressionLevel,
  WorldInfo,
  worlds
} from "../../lib/progression";
import styles from "../page.module.css";

type Props = {
  progress: Progress;
  onSelectLevel: (level: ProgressionLevel) => void;
};

export default function LevelMap({ progress, onSelectLevel }: Props) {
  const current = nextPlayableLevel(progress);

  return (
    <div className={styles.map} data-testid="level-map">
      {worlds.map((world) => (
        <WorldSection
          key={world.world}
          world={world}
          progress={progress}
          currentLevelId={current?.id ?? null}
          onSelectLevel={onSelectLevel}
        />
      ))}
    </div>
  );
}

function WorldSection({
  world,
  progress,
  currentLevelId,
  onSelectLevel
}: {
  world: WorldInfo;
  progress: Progress;
  currentLevelId: number | null;
  onSelectLevel: (level: ProgressionLevel) => void;
}) {
  const worldLevels = levels.filter((level) => level.world === world.world);
  const passedInWorld = worldLevels.filter((level) => isPassed(progress, level.id)).length;
  const worldUnlocked = worldLevels.some((level) => isUnlocked(progress, level));

  return (
    <section
      className={worldUnlocked ? styles.world : `${styles.world} ${styles.worldLocked}`}
      aria-label={`World ${world.world}: ${world.name}`}
    >
      <header className={styles.worldHeader}>
        <div>
          <p className={styles.kicker}>World {world.world}</p>
          <h2>{world.name}</h2>
        </div>
        <div className={styles.worldBadge}>
          <span>{world.wordsPerChunk}</span>
          <small>{world.wordsPerChunk === 1 ? "word at a time" : "words at a time"}</small>
        </div>
      </header>
      <p className={styles.worldMeta}>
        {passedInWorld}/{worldLevels.length} levels cleared • 100 → 200 WPM
      </p>
      <div className={styles.path}>
        {worldLevels.map((level) => (
          <LevelNode
            key={level.id}
            level={level}
            progress={progress}
            isCurrent={level.id === currentLevelId}
            onSelect={onSelectLevel}
          />
        ))}
      </div>
    </section>
  );
}

function LevelNode({
  level,
  progress,
  isCurrent,
  onSelect
}: {
  level: ProgressionLevel;
  progress: Progress;
  isCurrent: boolean;
  onSelect: (level: ProgressionLevel) => void;
}) {
  // SR-R1-016: Game path continuity - "locked" | "unlocked" | "completed" is the single source
  // of truth for how this node renders, derived the same way whether this is a fresh visit, a
  // reload, or right after a PASS/HOLD attempt.
  const state = nodeState(progress, level);
  const unlocked = state !== "locked";
  const result = progress[String(level.id)];
  const stars = result?.stars ?? 0;

  const nodeClass = [
    styles.node,
    state === "completed" ? styles.nodePassed : "",
    isCurrent ? styles.nodeCurrent : "",
    state === "locked" ? styles.nodeLocked : ""
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <div className={styles.nodeWrap}>
      <button
        className={nodeClass}
        data-testid={`level-node-${level.id}`}
        disabled={!unlocked}
        onClick={() => onSelect(level)}
        aria-label={
          unlocked
            ? `Level ${level.id}: ${level.wpm} words per minute`
            : `Level ${level.id} locked`
        }
      >
        {unlocked ? (
          <>
            <strong>{level.wpm}</strong>
            <small>WPM</small>
          </>
        ) : (
          <span aria-hidden="true">🔒</span>
        )}
      </button>
      <span className={styles.nodeStars} aria-label={`${stars} of 3 stars`}>
        {[1, 2, 3].map((slot) => (
          <span key={slot} className={slot <= stars ? styles.starOn : styles.starOff}>
            ★
          </span>
        ))}
      </span>
    </div>
  );
}
