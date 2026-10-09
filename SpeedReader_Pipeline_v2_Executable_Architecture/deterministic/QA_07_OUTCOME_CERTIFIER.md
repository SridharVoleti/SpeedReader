# Deterministic QA 7 — Attempt Outcome Engine Certifier

QA07 independently certifies the immutable output/transition behaviour of deterministic Role 7.

It never changes learner state or repairs a transition table.

## Inputs

- Exact Role 7 executable/version/hash.
- Version-locked canonical outcome/readiness lifecycle rules.
- Approved deterministic scoring contract.
- Machine-generated transition/boundary/property test evidence.

## Mandatory checks

1. Same valid input always produces the same outcome and next action.
2. Sample validity is resolved before PASS/FAIL/readiness scoring.
3. ASR uncertainty/technical invalidity never becomes fabricated learner error.
4. Initial confirmation cannot be skipped where canon requires it.
5. Valid failure routes to the canonical remediation/new-cycle path; no retry lottery.
6. Technical replacement preserves the protected lifecycle role/phase.
7. Form identity/reuse rules are enforced.
8. Oral and comprehension evidence streams remain independent/non-compensatory where required.
9. First-attempt independent evidence remains distinct from post-remediation mastery.
10. Evidence freshness/recency triggers are deterministic and the canonical first-trigger rule is preserved.
11. Baseline mastery, readiness and certification states are not conflated.
12. Readiness/oral outcomes do not mutate or block core WPM/canonical passage progression where the frozen V3 product rule says they are nonblocking.
13. Every threshold/state boundary and invalid/insufficient-evidence edge has an executable test.
14. No threshold, state or transition exists without authoritative canonical provenance.

## Applicable acceptance focus

At minimum: AC-25–AC-45, AC-52–AC-56 and AC-58/59 edge/contradiction checks.

## Result

- `QA_PASS`: transition/property suite fully matches canonical rules.
- `QA_FAIL`: deterministic behaviour differs from authority or an edge case fails.
- `QA_BLOCKED_NOT_EXECUTED`: canonical rules or mandatory executable evidence are unavailable.

## Routing

- Role 7 implementation defect -> R07.
- Scoring-contract defect -> R06/deterministic scoring owner as applicable.
- Canonical lifecycle conflict -> `CANONICAL_OWNER`.

Missing executable evidence is not PASS.