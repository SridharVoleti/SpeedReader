import json

from speed_reading.content import gate_content, load_levels, load_passages, validate_passage


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


# SR-R1-003: Approved-file-only content.
# "Missing approval/version/schema validity blocks exposure and logs CONTENT_INVALID."
def _approved_fixture(**overrides):
    fixture = {
        "content_id": "fixture_001",
        "content_version": "1.0",
        "schema_version": "1.0",
        "approval_status": "APPROVED",
    }
    fixture.update(overrides)
    return fixture


def test_gate_content_accepts_approved_versioned_content():
    assert gate_content(_approved_fixture()) == []


def test_gate_content_blocks_missing_approval_status():
    reasons = gate_content(_approved_fixture(approval_status=None))
    assert any("approval_status" in reason for reason in reasons)


def test_gate_content_blocks_unapproved_content():
    reasons = gate_content(_approved_fixture(approval_status="WIP"))
    assert any("not approved" in reason for reason in reasons)


def test_gate_content_blocks_missing_content_version():
    reasons = gate_content(_approved_fixture(content_version=None))
    assert any("content_version" in reason for reason in reasons)


def test_gate_content_blocks_unsupported_schema_version():
    reasons = gate_content(_approved_fixture(schema_version="999.0"))
    assert any("schema_version" in reason for reason in reasons)


def test_load_passages_blocks_exposure_of_unapproved_content(tmp_path, capsys):
    fixture_path = tmp_path / "level-1.json"
    fixture_path.write_text(
        json.dumps(
            [
                {
                    **_approved_fixture(content_id="good", approval_status="APPROVED"),
                    "level": 1,
                    "title": "Good",
                    "category": "test",
                    "difficulty": "beginner",
                    "estimatedAgeRange": "7-12",
                    "wordCount": 2,
                    "content": "hello world",
                    "comprehension": {
                        "minimumResponseWords": 10,
                        "requiredKeywords": ["hello"],
                        "concepts": ["hello world"],
                        "synonyms": {},
                        "copyLimit": 0.5,
                    },
                },
                {
                    **_approved_fixture(content_id="bad", approval_status="WIP"),
                    "level": 1,
                    "title": "Bad",
                    "category": "test",
                    "difficulty": "beginner",
                    "estimatedAgeRange": "7-12",
                    "wordCount": 2,
                    "content": "hello world",
                    "comprehension": {
                        "minimumResponseWords": 10,
                        "requiredKeywords": ["hello"],
                        "concepts": ["hello world"],
                        "synonyms": {},
                        "copyLimit": 0.5,
                    },
                },
            ]
        ),
        encoding="utf-8",
    )

    passages = load_passages(1, path=fixture_path)

    assert [passage.content_id for passage in passages] == ["good"]
    assert "CONTENT_INVALID" in capsys.readouterr().err
