# Role 4 Independent QA — Meaning Unit Semantic QA

Verify every meaning unit/proposition against the approved passage. Test semantic fidelity, polarity, atomicity, coverage, evidence locator correctness, fact-ID integrity and inference classification.

Do **not** require verbatim substring identity unless the canonical contract explicitly requires a source span. Faithful paraphrase is not a defect.

## Routing

- Extraction/modeling defect -> Role 4.
- Source-passage ambiguity/contradiction -> Role 2.
- Canonical semantic conflict -> canonical owner.
