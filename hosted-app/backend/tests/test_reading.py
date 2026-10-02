import pytest

from speed_reading.content import load_levels, load_passages
from speed_reading.reading import (
    calculate_wpm,
    clamp_wpm,
    milliseconds_per_chunk,
    planned_session_segments,
    words_to_chunks,
)


def test_level_one_chunks_are_single_words():
    passage = load_passages(1)[0]
    chunks = words_to_chunks(passage.content, words_per_chunk=1)

    assert chunks[0] == "Ravi"
    assert len(chunks) == len(passage.content.split())


def test_wpm_is_clamped_to_level_range():
    level = load_levels()[0]

    assert clamp_wpm(20, level) == 60
    assert clamp_wpm(240, level) == 240
    assert clamp_wpm(900, level) == 500


def test_milliseconds_per_word_at_60_wpm_is_one_second():
    assert milliseconds_per_chunk(60, 1) == 1000


def test_calculate_wpm_for_one_minute_benchmark():
    assert calculate_wpm(words_read=180, elapsed_seconds=60) == 180


def test_session_segments_cover_exactly_thirty_minutes():
    segments = planned_session_segments(30)

    assert segments[0]["name"] == "Warmup"
    assert segments[-1]["endMinute"] == 30
    assert sum(segment["endMinute"] - segment["startMinute"] for segment in segments) == 30


def test_session_model_rejects_non_thirty_minute_sessions():
    with pytest.raises(ValueError):
        planned_session_segments(20)
