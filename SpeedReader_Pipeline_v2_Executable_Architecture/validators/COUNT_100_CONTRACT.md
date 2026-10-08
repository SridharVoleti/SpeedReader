# COUNT-100 Validator Contract

The canonical acceptance criteria require one deterministic tokenizer shared by authoring, QA, renderer, ASR alignment, WPM and equivalent-form validation.

This v2 package **does not invent the tokenizer rules**. The canonical package manifest therefore lists `canonical/count100_spec.json` as required but missing and fails closed for production.

## Required implementation once the approved spec is supplied

Expose one library function, e.g.:

```text
count100.tokenize(text) -> ordered lexical tokens with source spans
count100.count(text) -> integer
count100.segment(tokens) -> canonical thirds/quartiles
```

The frozen spec must explicitly cover contractions, hyphenated forms, numerals, currency, abbreviations, apostrophes, punctuation and proper nouns.

Every consumer must import/call the same implementation. No role prompt may use its own word-count heuristic.

## Acceptance tests

Create table-driven fixtures for every defined token class plus boundary combinations. The same fixture set must be used in passage authoring QA, renderer tests, ASR alignment tests, WPM tests and form-equivalence tests.
