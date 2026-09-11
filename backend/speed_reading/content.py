from __future__ import annotations

import json
from pathlib import Path

from .models import ComprehensionConfig, LevelConfig, Passage


def _root() -> Path:
    return Path(__file__).resolve().parents[2]


def load_levels(path: Path | None = None) -> list[LevelConfig]:
    source = path or _root() / "data" / "levels.json"
    raw_levels = json.loads(source.read_text(encoding="utf-8"))
    return [
        LevelConfig(
            level=item["level"],
            name=item["name"],
            words_per_chunk=item["wordsPerChunk"],
            min_wpm=item["minWpm"],
            max_wpm=item["maxWpm"],
            recommended_sessions_per_week=item["recommendedSessionsPerWeek"],
            session_duration_minutes=item["sessionDurationMinutes"],
            estimated_weeks=item["estimatedWeeks"],
            target_completed_sessions=item["targetCompletedSessions"],
            pass_threshold=item["passThreshold"],
        )
        for item in raw_levels
    ]


def load_passages(level: int, path: Path | None = None) -> list[Passage]:
    source = path or _root() / "data" / "passages" / f"level-{level}.json"
    raw_passages = json.loads(source.read_text(encoding="utf-8"))
    return [_parse_passage(item) for item in raw_passages]


def validate_passage(passage: Passage) -> list[str]:
    errors: list[str] = []
    actual_word_count = len(passage.content.split())
    if passage.word_count != actual_word_count:
        errors.append(
            f"{passage.id}: wordCount is {passage.word_count}, actual is {actual_word_count}"
        )
    if not passage.comprehension.required_keywords:
        errors.append(f"{passage.id}: requiredKeywords cannot be empty")
    if not passage.comprehension.concepts:
        errors.append(f"{passage.id}: concepts cannot be empty")
    if passage.comprehension.minimum_response_words < 10:
        errors.append(f"{passage.id}: minimumResponseWords is too low")
    if not 0 < passage.comprehension.copy_limit < 1:
        errors.append(f"{passage.id}: copyLimit must be between 0 and 1")
    return errors


def _parse_passage(item: dict) -> Passage:
    comprehension = item["comprehension"]
    return Passage(
        id=item["id"],
        level=item["level"],
        title=item["title"],
        category=item["category"],
        difficulty=item["difficulty"],
        estimated_age_range=item["estimatedAgeRange"],
        word_count=item["wordCount"],
        content=item["content"],
        comprehension=ComprehensionConfig(
            minimum_response_words=comprehension["minimumResponseWords"],
            required_keywords=comprehension["requiredKeywords"],
            concepts=comprehension["concepts"],
            synonyms=comprehension.get("synonyms", {}),
            copy_limit=comprehension["copyLimit"],
        ),
    )
