from __future__ import annotations

import json
import sys
from pathlib import Path

from .models import ComprehensionConfig, LevelConfig, Passage

# SR-R1-003: approved-file-only content - the schema version this runtime understands.
CONTENT_SCHEMA_VERSION = "1.0"


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


def gate_content(item: dict) -> list[str]:
    """SR-R1-003: reasons a raw content record cannot be exposed to a learner, if any."""
    reasons: list[str] = []
    if not item.get("content_id"):
        reasons.append("missing content_id")
    if not item.get("content_version"):
        reasons.append("missing content_version")
    schema_version = item.get("schema_version")
    if not schema_version:
        reasons.append("missing schema_version")
    elif schema_version != CONTENT_SCHEMA_VERSION:
        reasons.append(f'unsupported schema_version "{schema_version}"')
    approval_status = item.get("approval_status")
    if not approval_status:
        reasons.append("missing approval_status")
    elif approval_status != "APPROVED":
        reasons.append(f'content not approved (approval_status="{approval_status}")')
    return reasons


def load_passages(level: int, path: Path | None = None) -> list[Passage]:
    source = path or _root() / "data" / "passages" / f"level-{level}.json"
    raw_passages = json.loads(source.read_text(encoding="utf-8"))
    approved: list[Passage] = []
    for item in raw_passages:
        reasons = gate_content(item)
        if reasons:
            print(f"CONTENT_INVALID {item.get('content_id')}: {reasons}", file=sys.stderr)
            continue
        approved.append(_parse_passage(item))
    return approved


def validate_passage(passage: Passage) -> list[str]:
    errors: list[str] = []
    actual_word_count = len(passage.content.split())
    if passage.word_count != actual_word_count:
        errors.append(
            f"{passage.content_id}: wordCount is {passage.word_count}, actual is {actual_word_count}"
        )
    if not passage.comprehension.required_keywords:
        errors.append(f"{passage.content_id}: requiredKeywords cannot be empty")
    if not passage.comprehension.concepts:
        errors.append(f"{passage.content_id}: concepts cannot be empty")
    if passage.comprehension.minimum_response_words < 10:
        errors.append(f"{passage.content_id}: minimumResponseWords is too low")
    if not 0 < passage.comprehension.copy_limit < 1:
        errors.append(f"{passage.content_id}: copyLimit must be between 0 and 1")
    return errors


def _parse_passage(item: dict) -> Passage:
    comprehension = item["comprehension"]
    return Passage(
        content_id=item["content_id"],
        content_version=item["content_version"],
        schema_version=item["schema_version"],
        approval_status=item["approval_status"],
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
