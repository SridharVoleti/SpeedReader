from speed_reading.content import load_passages
from speed_reading.scoring import score_comprehension


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
