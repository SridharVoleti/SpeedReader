from speed_reading.content import load_passages, validate_passage
from speed_reading.progression import (
    build_expected_levels,
    load_progression,
    next_level_id,
    stars_for_score,
    unlocked_level_ids,
)


def test_progression_has_six_worlds_of_six_speed_steps():
    worlds, levels = load_progression()

    assert [world.words_per_chunk for world in worlds] == [1, 2, 3, 4, 5, 6]
    assert len(levels) == 36
    assert levels == build_expected_levels()


def test_each_world_climbs_from_100_to_200_wpm():
    _, levels = load_progression()

    for chunk in range(1, 7):
        world_levels = [level for level in levels if level.world == chunk]
        assert [level.wpm for level in world_levels] == [100, 120, 140, 160, 180, 200]
        assert all(level.words_per_chunk == chunk for level in world_levels)


def test_world_transition_resets_speed_to_100():
    _, levels = load_progression()

    # Finishing 200 WPM in one world lands on 100 WPM with one more word per chunk.
    for previous, current in zip(levels, levels[1:]):
        if current.world != previous.world:
            assert previous.wpm == 200
            assert current.wpm == 100
            assert current.words_per_chunk == previous.words_per_chunk + 1


def test_levels_unlock_sequentially():
    _, levels = load_progression()

    assert unlocked_level_ids(levels, set()) == {1}
    assert unlocked_level_ids(levels, {1}) == {1, 2}
    assert next_level_id(levels, set()) == 1
    assert next_level_id(levels, {1, 2, 3}) == 4
    assert next_level_id(levels, {level.id for level in levels}) is None


def test_stars_reward_higher_comprehension_scores():
    assert stars_for_score(69) == 0
    assert stars_for_score(70) == 1
    assert stars_for_score(80) == 2
    assert stars_for_score(90) == 3
    assert stars_for_score(100) == 3


def test_passage_pool_covers_a_full_world_without_repeats():
    passages = load_passages(1)

    assert len(passages) >= 6
    errors = [error for passage in passages for error in validate_passage(passage)]
    assert errors == []
