from __future__ import annotations

from dataclasses import dataclass


@dataclass(frozen=True)
class LevelConfig:
    level: int
    name: str
    words_per_chunk: int
    min_wpm: int
    max_wpm: int
    recommended_sessions_per_week: int
    session_duration_minutes: int
    estimated_weeks: int
    target_completed_sessions: int
    pass_threshold: int


@dataclass(frozen=True)
class ComprehensionConfig:
    minimum_response_words: int
    required_keywords: list[str]
    concepts: list[str]
    synonyms: dict[str, list[str]]
    copy_limit: float


@dataclass(frozen=True)
class Passage:
    # SR-R1-003: approved-file-only content - every passage declares these.
    content_id: str
    content_version: str
    schema_version: str
    approval_status: str
    level: int
    title: str
    category: str
    difficulty: str
    estimated_age_range: str
    word_count: int
    content: str
    comprehension: ComprehensionConfig


@dataclass(frozen=True)
class ScoreResult:
    score: int
    passed: bool
    length_points: int
    keyword_points: int
    concept_points: int
    originality_points: int
    coherence_points: int
    feedback: list[str]
    scorer_version: str
