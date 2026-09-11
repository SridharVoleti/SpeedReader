from __future__ import annotations

import re
from difflib import SequenceMatcher

from .models import Passage, ScoreResult


WORD_RE = re.compile(r"[a-zA-Z']+")


def normalize_words(text: str) -> list[str]:
    return [word.lower().strip("'") for word in WORD_RE.findall(text)]


def score_comprehension(passage: Passage, response: str, pass_threshold: int = 70) -> ScoreResult:
    response_words = normalize_words(response)
    passage_words = normalize_words(passage.content)
    response_text = " ".join(response_words)

    length_points = _score_length(
        len(response_words), passage.comprehension.minimum_response_words
    )
    keyword_points = _score_keywords(
        response_text,
        passage.comprehension.required_keywords,
        passage.comprehension.synonyms,
    )
    concept_points = _score_concepts(response_text, passage.comprehension.concepts)
    originality_points = _score_originality(
        response_words, passage_words, passage.comprehension.copy_limit
    )
    coherence_points = _score_coherence(response_words)

    total = (
        length_points
        + keyword_points
        + concept_points
        + originality_points
        + coherence_points
    )
    feedback = _feedback(
        total,
        length_points,
        keyword_points,
        concept_points,
        originality_points,
        coherence_points,
    )
    return ScoreResult(
        score=total,
        passed=total >= pass_threshold,
        length_points=length_points,
        keyword_points=keyword_points,
        concept_points=concept_points,
        originality_points=originality_points,
        coherence_points=coherence_points,
        feedback=feedback,
    )


def _score_length(word_count: int, minimum: int) -> int:
    if word_count >= minimum:
        return 15
    return round(15 * (word_count / minimum)) if minimum else 0


def _score_keywords(
    response_text: str, required_keywords: list[str], synonyms: dict[str, list[str]]
) -> int:
    if not required_keywords:
        return 0
    matches = 0
    for keyword in required_keywords:
        accepted_terms = [keyword.lower(), *[term.lower() for term in synonyms.get(keyword, [])]]
        if any(_contains_term(response_text, term) for term in accepted_terms):
            matches += 1
    return round(30 * (matches / len(required_keywords)))


def _score_concepts(response_text: str, concepts: list[str]) -> int:
    if not concepts:
        return 0
    matched = 0
    for concept in concepts:
        concept_words = set(normalize_words(concept))
        if not concept_words:
            continue
        overlap = sum(1 for word in concept_words if _contains_term(response_text, word))
        if overlap / len(concept_words) >= 0.45:
            matched += 1
    return round(35 * (matched / len(concepts)))


def _score_originality(
    response_words: list[str], passage_words: list[str], copy_limit: float
) -> int:
    if not response_words:
        return 0
    response_text = " ".join(response_words)
    passage_text = " ".join(passage_words)
    similarity = SequenceMatcher(None, response_text, passage_text).ratio()
    if similarity <= copy_limit:
        return 10
    if similarity >= 0.9:
        return 0
    return round(10 * ((0.9 - similarity) / (0.9 - copy_limit)))


def _score_coherence(response_words: list[str]) -> int:
    unique_ratio = len(set(response_words)) / len(response_words) if response_words else 0
    if len(response_words) < 5:
        return 0
    if unique_ratio < 0.35:
        return 3
    return 10


def _contains_term(text: str, term: str) -> bool:
    escaped = re.escape(term.lower())
    return re.search(rf"\b{escaped}\b", text) is not None


def _feedback(
    total: int,
    length_points: int,
    keyword_points: int,
    concept_points: int,
    originality_points: int,
    coherence_points: int,
) -> list[str]:
    notes: list[str] = []
    if total >= 70:
        notes.append("Good recall. You captured enough of the passage to move ahead.")
    else:
        notes.append("Try again and include the main idea plus two important details.")
    if length_points < 15:
        notes.append("Write a little more so your answer has enough detail.")
    if keyword_points < 20:
        notes.append("Mention more important names, objects, or actions from the passage.")
    if concept_points < 24:
        notes.append("Focus on what happened and what the passage teaches.")
    if originality_points < 7:
        notes.append("Use your own words instead of copying the passage.")
    if coherence_points < 10:
        notes.append("Write complete, clear sentences.")
    return notes
