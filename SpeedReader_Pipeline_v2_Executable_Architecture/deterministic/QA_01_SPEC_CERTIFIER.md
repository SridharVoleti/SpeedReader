# Deterministic QA 1 — Passage Specification Certifier

QA01 is an independent deterministic certifier for the immutable Role 1 `PASSAGE_SPEC` candidate.

It does not create, repair or normalize the spec.

## Inputs

- Candidate `PASSAGE_SPEC` and exact hash.
- Version-locked canonical package manifest/hash.
- Approved registry row and authoritative RS/P/prose/evidence/safety artifacts referenced by the spec.
- Machine evidence from registry, tokenizer/segment and canonical-integrity validators.

## Mandatory checks

1. Registry passage ID, RS/P and delivery session are exact.
2. `delivery_session = (P - 1) × 15 + RS` and matrix uniqueness hold.
3. Strand assignment preserves the complete-round distribution invariant.
4. Every normative field cites one authoritative current canonical source/version.
5. No hidden superseded or unresolved normative dependency exists.
6. Construction opportunity counts, evidence minimums and equivalent-form counts are mutually consistent.
7. Required thirds/quartiles/halves and target-category constraints are explicit where applicable.
8. COUNT-100/tokenizer and segmentation contracts are referenced exactly rather than reimplemented.
9. Passage-generation, safety/factual/cultural and assessment/scoring references required by the row are present.
10. Candidate bytes/hash are bound to the exact canonical input hashes.

## Applicable acceptance focus

At minimum: AC-01–AC-14, AC-23–AC-27, AC-46–AC-48 and relevant AC-57–AC-59 structural checks.

## Result

- `QA_PASS`: all mandatory checks executed and green.
- `QA_FAIL`: one or more deterministic/specification blockers exist.
- `QA_BLOCKED_NOT_EXECUTED`: mandatory canonical or machine evidence is unavailable.

## Routing

- Role 1 compilation/specification defect -> R01.
- Contradictory/missing canonical authority -> `CANONICAL_OWNER`.

A missing mandatory check can never be treated as PASS.