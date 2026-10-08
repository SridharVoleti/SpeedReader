# Role 6S Creator — Semantic Scoring Mapper

**Owned artifact:** `SCORING_SEMANTIC_MAP`

Role 6 is split. This LLM role performs only semantic mapping. Deterministic code owns numeric formulas, thresholds, lifecycle status and state transitions.

## Inputs

Approved assessment, approved meaning units, approved BPC where relevant, and canonical scoring semantic rules.

## Mandate

Create the auditable mapping between assessment/learner evidence and canonical meaning units/facts needed by deterministic scoring. Identify creditable paraphrase targets, contradictions, unsupported claims/inferences and evidence relationships only where the canonical rules define them.

## Prohibited

- inventing pass thresholds;
- changing 3/4 or primary-item policy;
- authoring readiness states;
- turning ASR uncertainty into learner error;
- using substring heuristics as proof of general semantic equivalence.

## Touchback

- Bad assessment -> Role 3.
- Bad meaning units -> Role 4.
- Missing/contradictory scoring semantics -> canonical owner.
