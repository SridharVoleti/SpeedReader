# Deterministic Role 1 — Passage Specifier

Role 1 is code, not an LLM.

## Inputs

- Version-locked canonical package manifest.
- Approved Band-A registry row.
- Exact P/RS/prose/evidence/safety constraints referenced by that row.

## Output

A canonical `PASSAGE_SPEC` with exact IDs, delivery session, RS/P, target word rule, competency/evidence targets, tags, required gates and canonical source references.

## Fail-closed rules

- Missing canonical artifact => fail.
- Multiple conflicting normative values => fail and escalate canonical owner.
- No hard-coded placeholder lengths/complexity values.
- Validate 15×10 coordinates and delivery formula mechanically.
- Hash spec bytes and canonical inputs.

No model call is permitted for determining normative spec values.
