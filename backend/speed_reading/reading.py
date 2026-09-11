from __future__ import annotations

import math

from .models import LevelConfig


def clamp_wpm(requested_wpm: int, config: LevelConfig) -> int:
    return max(config.min_wpm, min(config.max_wpm, requested_wpm))


def words_to_chunks(text: str, words_per_chunk: int) -> list[str]:
    if words_per_chunk < 1:
        raise ValueError("words_per_chunk must be at least 1")
    words = text.split()
    return [
        " ".join(words[index : index + words_per_chunk])
        for index in range(0, len(words), words_per_chunk)
    ]


def milliseconds_per_chunk(wpm: int, words_per_chunk: int) -> int:
    if wpm <= 0:
        raise ValueError("wpm must be greater than zero")
    if words_per_chunk <= 0:
        raise ValueError("words_per_chunk must be greater than zero")
    return math.floor((60_000 / wpm) * words_per_chunk)


def calculate_wpm(words_read: int, elapsed_seconds: float) -> int:
    if elapsed_seconds <= 0:
        raise ValueError("elapsed_seconds must be greater than zero")
    return round((words_read / elapsed_seconds) * 60)


def planned_session_segments(duration_minutes: int) -> list[dict[str, int | str]]:
    if duration_minutes != 30:
        raise ValueError("Level 1 sessions are intentionally fixed at 30 minutes")
    return [
        {"name": "Warmup", "startMinute": 0, "endMinute": 3},
        {"name": "Guided Practice", "startMinute": 3, "endMinute": 10},
        {"name": "Practice Article 1", "startMinute": 10, "endMinute": 15},
        {"name": "Focus Reset", "startMinute": 15, "endMinute": 17},
        {"name": "Practice Article 2", "startMinute": 17, "endMinute": 24},
        {"name": "Benchmark Drill", "startMinute": 24, "endMinute": 27},
        {"name": "Results", "startMinute": 27, "endMinute": 30},
    ]
