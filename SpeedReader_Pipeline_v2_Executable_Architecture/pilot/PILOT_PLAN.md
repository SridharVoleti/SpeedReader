# Band A Pilot Plan

## Phase A — Infrastructure validation (3–5 passages)

Select representative RS/P combinations including at least one early confidence-protected passage and one P10 case. Prove:

- job packet generation/import;
- creator/QA context separation;
- durable resume after process restart;
- defect touchback to true owner;
- hash-based invalidation;
- retry/escalation behavior;
- deterministic roles fail closed when canonical artifacts are missing.

Exit only when there are no orchestration blockers.

## Phase B — One full delivery round (15 passages)

Produce RS01-P1 through RS15-P1 in actual learner order. Measure quality and nearby duplication across the round.

## Phase C — Full Band A (150 passages)

Complete the frozen 15×10 matrix. Do not authorize 1,500-passage scale until the Band-A metrics are reviewed.

## Metrics

- first-pass creator→QA PASS rate by role;
- average attempts per artifact;
- blocker rate and root-owner distribution;
- upstream touchbacks per passage;
- repeated blocker/escalation rate;
- human escalations;
- final package rejection rate;
- elapsed time per passage;
- LLM tokens/cost per passage when measurable;
- deterministic validation failures;
- percentage of descendants revalidated vs fully regenerated.
