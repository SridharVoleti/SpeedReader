import os
import re
from pathlib import Path

from speed_reading.content import load_passages
from speed_reading.reading import milliseconds_per_chunk, words_to_chunks
from speed_reading.scoring import score_comprehension

# SR-R1-015: Zero paid-AI runtime dependency.
# "Core reading, scoring and progression work without generative AI/LLM inference."
# "Full attempt succeeds with AI endpoints/credentials absent." (TC-R1-015-B: "Offline")
AI_DEPENDENCY_PATTERNS = [
    re.compile(pattern, re.IGNORECASE)
    for pattern in [
        r"openai",
        r"anthropic",
        r"langchain",
        r"cohere",
        r"huggingface",
        r"generative-ai",
        r"gemini",
        r"\bllm\b",
        r"vertex-?ai",
        r"azure-openai",
    ]
]


def is_ai_related_dependency(name: str) -> bool:
    return any(pattern.search(name) for pattern in AI_DEPENDENCY_PATTERNS)


def test_backend_requirements_has_zero_ai_dependencies():
    requirements_path = Path(__file__).resolve().parents[1] / "requirements.txt"
    lines = [
        line.split("==")[0].split(">=")[0].strip()
        for line in requirements_path.read_text(encoding="utf-8").splitlines()
        if line.strip()
    ]

    ai_dependencies = [name for name in lines if is_ai_related_dependency(name)]
    assert ai_dependencies == []


def test_full_attempt_flow_succeeds_with_ai_env_vars_absent():
    for key in ["OPENAI_API_KEY", "ANTHROPIC_API_KEY", "AI_API_KEY", "LLM_API_KEY"]:
        assert os.environ.get(key) is None

    passage = load_passages(1)[0]
    chunks = words_to_chunks(passage.content, words_per_chunk=1)
    assert len(chunks) == len(passage.content.split())
    assert milliseconds_per_chunk(100, 1) == 600

    result = score_comprehension(
        passage,
        "Ravi went to the shop and got extra money by mistake. "
        "He returned the change to the shopkeeper. The story teaches honesty.",
    )
    assert result.passed is True
