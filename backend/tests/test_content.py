from speed_reading.content import load_levels, load_passages, validate_passage


def test_level_one_config_supports_single_word_focus():
    level = load_levels()[0]

    assert level.level == 1
    assert level.words_per_chunk == 1
    assert level.min_wpm == 60
    assert level.max_wpm == 500
    assert level.session_duration_minutes == 30
    assert level.target_completed_sessions == 24


def test_seed_passages_are_valid():
    passages = load_passages(1)

    assert len(passages) >= 3
    assert all(passage.level == 1 for passage in passages)
    errors = [error for passage in passages for error in validate_passage(passage)]
    assert errors == []
