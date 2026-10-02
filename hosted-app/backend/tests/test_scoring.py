from speed_reading.content import load_passages
from speed_reading.scoring import SCORER_VERSION, score_comprehension


# SR-R1-004: Deterministic item scoring.
# "Same content/scorer version + response always yields same result; no network AI/LLM call."
def test_result_is_tagged_with_the_scorer_version():
    passage = load_passages(1)[0]

    result = score_comprehension(passage, "Ravi returned the extra coins to the shopkeeper.")

    assert result.scorer_version == SCORER_VERSION


def test_100_identical_scoring_runs_produce_the_same_result():
    passage = load_passages(1)[0]
    response = (
        "Ravi went to the shop and got extra money by mistake. "
        "He returned the change to the shopkeeper. The story teaches honesty."
    )

    first = score_comprehension(passage, response)
    for _ in range(100):
        assert score_comprehension(passage, response) == first


def test_good_response_passes_without_ai():
    passage = load_passages(1)[0]
    response = (
        "Ravi went to the shop and got extra money by mistake. "
        "He returned the change to the shopkeeper. The story teaches honesty."
    )

    result = score_comprehension(passage, response)

    assert result.passed is True
    assert result.score >= 70


def test_short_vague_response_fails():
    passage = load_passages(1)[0]

    result = score_comprehension(passage, "It was nice and good.")

    assert result.passed is False
    assert result.score < 70


def test_copied_passage_loses_originality_points():
    passage = load_passages(1)[0]

    result = score_comprehension(passage, passage.content)

    assert result.originality_points < 7
