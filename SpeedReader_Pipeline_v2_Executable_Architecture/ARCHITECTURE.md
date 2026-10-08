# Architecture — SpeedReader Pipeline v2

## 1. Design principle

Use software for deterministic guarantees and LLMs only where semantic judgment or creative generation is genuinely needed.

### Deterministic code-owned work

| Role | Owner | Output |
|---|---|---|
| Role 1 | Code | `PASSAGE_SPEC` derived from the approved registry/canonical package |
| Role 7 | Code | `ATTEMPT_OUTCOME_CONTRACT` derived from approved scoring/state rules |
| Role 8 | Code | `FINAL_PACKAGE`, hashes, manifest, schema validation, fidelity checks |

### LLM semantic work

| Role | Creator | Independent QA |
|---|---|---|
| 2 | Passage author | Passage/prose QA |
| 3 | Assessment author | Assessment semantic QA |
| 4 | Meaning-unit author | Meaning-unit semantic QA |
| 5 | Best Possible Comprehension author | BPC semantic QA |
| 6S | Scoring semantic mapper | Scoring semantic-map QA |

Role 6S does **not** own numeric threshold invention or runtime state transitions. It produces an auditable semantic mapping consumed by deterministic scoring code.

## 2. Source of truth

The source of truth is the **canonical package + SQLite manifest**, not an agent's chat history.

Every unit is addressed by `production_unit_id` (normally passage ID). Every artifact records:

- canonical package version/hash;
- role and artifact version;
- approved upstream hashes;
- creator run ID;
- candidate hash;
- QA certificate/hash;
- active defect IDs;
- retry count;
- approval/invalidation state.

## 3. Queue state machine

`WAITING_UPSTREAM -> READY -> RUNNING -> READY_FOR_QA -> QA_RUNNING -> APPROVED`

Exceptional states:

- `BLOCKED_UPSTREAM`
- `QA_FAILED`
- `ROUTING_PENDING`
- `INVALIDATED`
- `ESCALATED_HUMAN_REVIEW`
- `FAILED_CANONICAL_PACKAGE`

Only the orchestrator changes queue states.

## 4. Upstream touchback

Agents never repair another role's artifact. They emit a defect envelope identifying the true owner. The orchestrator persists the defect, blocks the current unit, schedules the owning correction, and invalidates only descendants that depend on the superseded hash.

Static DAG:

- R1 -> R2, R3, R8
- R2 -> R3, R4, R5, R8
- R3 -> R6S/R6, R8
- R4 -> R5, R6S/R6, R8
- R5 -> R8
- R6 -> R7, R8
- R7 -> R8

Transitive descendants are evaluated in topological order.

## 5. Independent QA isolation

A QA job is created only after a creator candidate is immutable and hashed. The QA job receives:

- candidate bytes/hash;
- canonical version/hash;
- required approved upstream artifacts;
- machine-check evidence;
- QA contract;
- no creator chain-of-thought/chat context.

QA is read-only. It returns PASS/FAIL and defects; it cannot edit the candidate.

## 6. Promotion

Only the orchestrator promotes an artifact after:

1. candidate hash still matches the QA-reviewed bytes;
2. QA verdict is PASS;
3. all required upstream hashes are still current;
4. no open blocker exists for that artifact;
5. mandatory machine checks are PASS.

Promotion should be implemented as atomic file move/copy+fsync/rename on the target environment. The scaffold records the transition but intentionally leaves the environment-specific file backend as an adapter.

## 7. Retry and escalation

Default operational limit: 3 creator attempts per artifact version.

- Upstream-caused defects do not spend the downstream creator's quota.
- Two consecutive identical blocker fingerprints => early human escalation.
- Third QA failure => `ESCALATED_HUMAN_REVIEW`.
- Human-approved canonical correction starts a new artifact version and resets the applicable retry count.

## 8. Execution modes

### MANUAL_PACKET

The orchestrator emits a JSON job packet and rendered prompt. You run it in ChatGPT Work, Codex, Claude, or another selected environment, then import the structured result.

Advantages: no model API required; ideal for the 150-passage pilot.

Trade-off: not fully unattended.

### AUTOMATED_RUNNER

An adapter pulls `READY` jobs and invokes an external model automatically. That adapter may use a model API or another supported automation platform. It is not part of the core orchestrator.

## 9. Pilot gating

- Phase A: 3–5 representative passages to validate infrastructure.
- Phase B: 15 passages, one complete RS01→RS15 delivery round.
- Phase C: all 150 Band A passages.
- Scale beyond Band A only after cost, fail-loop, routing and quality metrics meet agreed thresholds.
