from __future__ import annotations

import json
from dataclasses import dataclass
from pathlib import Path


@dataclass(frozen=True)
class ProgressionLevel:
    id: int
    world: int
    step: int
    words_per_chunk: int
    wpm: int
    pass_threshold: int


@dataclass(frozen=True)
class World:
    world: int
    words_per_chunk: int
    name: str


def _root() -> Path:
    return Path(__file__).resolve().parents[2]


def load_progression(path: Path | None = None) -> tuple[list[World], list[ProgressionLevel]]:
    source = path or _root() / "data" / "progression.json"
    raw = json.loads(source.read_text(encoding="utf-8"))
    worlds = [
        World(world=item["world"], words_per_chunk=item["wordsPerChunk"], name=item["name"])
        for item in raw["worlds"]
    ]
    # SR-R1-011: the level ladder is derived from the speedSteps/passThreshold configuration,
    # not read from a separately hard-coded/duplicated levels list - change the config, and the
    # eligible speeds change with it, no code change required.
    levels = build_levels_from_ladder(worlds, raw["speedSteps"], raw["passThreshold"])
    return worlds, levels


def build_levels_from_ladder(
    worlds: list[World], speed_steps: list[int], pass_threshold: int
) -> list[ProgressionLevel]:
    levels: list[ProgressionLevel] = []
    for world in worlds:
        for step_index, wpm in enumerate(speed_steps, start=1):
            levels.append(
                ProgressionLevel(
                    id=len(levels) + 1,
                    world=world.world,
                    step=step_index,
                    words_per_chunk=world.words_per_chunk,
                    wpm=wpm,
                    pass_threshold=pass_threshold,
                )
            )
    return levels


def build_expected_levels(
    speed_steps: list[int] | None = None,
    max_words_per_chunk: int = 6,
    pass_threshold: int = 70,
) -> list[ProgressionLevel]:
    """Canonical progression: every chunk size climbs the full speed ladder.

    World 1 highlights one word at a time from 100 to 200 WPM; each later world
    repeats the same ladder with one more word per chunk, up to six words.
    """
    steps = speed_steps or [100, 120, 140, 160, 180, 200]
    levels: list[ProgressionLevel] = []
    for chunk in range(1, max_words_per_chunk + 1):
        for index, wpm in enumerate(steps, start=1):
            levels.append(
                ProgressionLevel(
                    id=len(levels) + 1,
                    world=chunk,
                    step=index,
                    words_per_chunk=chunk,
                    wpm=wpm,
                    pass_threshold=pass_threshold,
                )
            )
    return levels


def stars_for_score(score: int) -> int:
    if score >= 90:
        return 3
    if score >= 80:
        return 2
    if score >= 70:
        return 1
    return 0


def unlocked_level_ids(levels: list[ProgressionLevel], passed_level_ids: set[int]) -> set[int]:
    """A level is unlocked when it is the first level or its predecessor is passed."""
    unlocked: set[int] = set()
    for level in levels:
        if level.id == 1 or (level.id - 1) in passed_level_ids:
            unlocked.add(level.id)
    return unlocked


def next_level_id(levels: list[ProgressionLevel], passed_level_ids: set[int]) -> int | None:
    """The next playable level: first unlocked level that is not yet passed."""
    unlocked = unlocked_level_ids(levels, passed_level_ids)
    for level in levels:
        if level.id in unlocked and level.id not in passed_level_ids:
            return level.id
    return None
