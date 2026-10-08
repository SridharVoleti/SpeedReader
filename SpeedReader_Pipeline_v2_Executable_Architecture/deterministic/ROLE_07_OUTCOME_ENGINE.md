# Deterministic Role 7 — Attempt Outcome Engine

Role 7 is code, not an LLM.

## Inputs

- Approved deterministic scoring result/contract.
- Version-locked canonical outcome/readiness rules.
- Evidence lifecycle status, first-attempt/remediation distinction and freshness state.

## Output

Deterministic attempt outcome, next action and separate oral/comprehension readiness effects.

## Requirements

- Same valid input => same outcome.
- Learner progression to the next passage is never blocked merely by oral/comprehension failure where the frozen rule says progression is non-blocking.
- First-attempt independent evidence remains distinct from post-remediation mastery.
- Oral and comprehension streams remain independent/non-compensatory.
- Stale/invalid/ASR-unresolved evidence follows canonical state rules.
- No threshold invention.

If canonical state rules are absent/contradictory, fail closed.
