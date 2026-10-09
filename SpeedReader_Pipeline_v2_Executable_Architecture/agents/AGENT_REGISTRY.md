# SpeedReader — 16-Agent Content Pipeline Registry v1

**Scope:** World 1 Band A, first 150 passages  
**Operating model:** 8 creator roles + 8 independent QA roles  
**Architecture:** hybrid deterministic + LLM semantic pipeline

## Non-negotiable architecture

The pipeline has 16 operational agents, but not 16 generative LLMs.

- Roles 1, 7 and 8 are deterministic code-owned creator agents.
- QA 1, QA 7 and QA 8 are independent deterministic/certification agents.
- Roles 2, 3, 4, 5 and semantic Role 6 are LLM creator agents.
- QA 2, QA 3, QA 4, QA 5 and QA 6 are fresh-context, read-only LLM QA agents.
- Role 6 remains hybrid: semantic mapping is LLM-owned; numeric formulas, thresholds, lifecycle states and state transitions remain deterministic.
- No creator may approve its own output. No QA agent may repair the artifact it reviews.

## Agent registry

| ID | Agent | Execution type | Owned / reviewed artifact | Contract |
|---|---|---|---|---|
| R01 | Passage Specification Agent | DETERMINISTIC | `PASSAGE_SPEC` | `../deterministic/ROLE_01_SPECIFIER.md` |
| QA01 | Passage Specification Certifier | DETERMINISTIC_QA | `PASSAGE_SPEC` | `../deterministic/QA_01_SPEC_CERTIFIER.md` |
| R02 | Passage Author Agent | LLM_SEMANTIC | `PASSAGE_TEXT` | `../contracts/ROLE_02_CREATOR.md` |
| QA02 | Passage / Prose Gate | LLM_QA | `PASSAGE_TEXT` | `../contracts/ROLE_02_QA.md` |
| R03 | Assessment Author Agent | LLM_SEMANTIC | `ASSESSMENT` | `../contracts/ROLE_03_CREATOR.md` |
| QA03 | Assessment Semantic QA | LLM_QA | `ASSESSMENT` | `../contracts/ROLE_03_QA.md` |
| R04 | Meaning Unit / Proposition Author | LLM_SEMANTIC | `MEANING_UNITS` | `../contracts/ROLE_04_CREATOR.md` |
| QA04 | Meaning Unit Semantic QA | LLM_QA | `MEANING_UNITS` | `../contracts/ROLE_04_QA.md` |
| R05 | Best Possible Comprehension Author | LLM_SEMANTIC | `BPC` | `../contracts/ROLE_05_CREATOR.md` |
| QA05 | BPC QA | LLM_QA | `BPC` | `../contracts/ROLE_05_QA.md` |
| R06 | Semantic Scoring Mapper | HYBRID | `SCORING_SEMANTIC_MAP` | `../contracts/ROLE_06S_CREATOR.md` |
| QA06 | Semantic Scoring Map QA | LLM_QA + deterministic compatibility checks | `SCORING_SEMANTIC_MAP` | `../contracts/ROLE_06S_QA.md` |
| R07 | Attempt Outcome Engine | DETERMINISTIC | `OUTCOME_RESULT` / lifecycle transition | `../deterministic/ROLE_07_OUTCOME_ENGINE.md` |
| QA07 | Outcome Engine Certifier | DETERMINISTIC_QA | R07 output | `../deterministic/QA_07_OUTCOME_CERTIFIER.md` |
| R08 | Final Package Assembler / Validator | DETERMINISTIC | `FINAL_PASSAGE_PACKAGE` | `../deterministic/ROLE_08_ASSEMBLER_VALIDATOR.md` |
| QA08 | Final Package Independent Certifier | DETERMINISTIC_QA / certification | `FINAL_PASSAGE_PACKAGE` | `../deterministic/QA_08_FINAL_PACKAGE_CERTIFIER.md` |

## Shared LLM contract

Every LLM creator/QA job must prepend `../contracts/COMMON_AGENT_CONTRACT.md` to the role-specific contract.

Required creator states:
- `READY_FOR_INDEPENDENT_QA`
- `BLOCKED_UPSTREAM`
- `BLOCKED_CANONICAL`
- `ESCALATED`

Required QA states:
- `QA_PASS`
- `QA_FAIL`
- `QA_BLOCKED_NOT_EXECUTED`

No `CONDITIONAL_PASS`.

## End-to-end passage chain

1. R01 creates `PASSAGE_SPEC`.
2. QA01 certifies the immutable spec.
3. R02 writes `PASSAGE_TEXT`.
4. QA02 reviews passage/prose.
5. R03 writes `ASSESSMENT`.
6. QA03 reviews assessment semantics.
7. R04 writes `MEANING_UNITS`.
8. QA04 reviews proposition fidelity.
9. R05 writes `BPC`.
10. QA05 reviews BPC.
11. R06 creates `SCORING_SEMANTIC_MAP`; deterministic scoring code owns numeric policy.
12. QA06 reviews semantic scoring mapping and deterministic compatibility.
13. R07 executes deterministic attempt-outcome/lifecycle rules.
14. QA07 independently certifies state transitions and boundary behaviour.
15. R08 assembles the exact final package in WIP and runs all machine validation.
16. QA08 independently certifies the exact final package hash and evidence bundle.
17. Only the orchestrator may promote the exact QA08-passed package from WIP to APPROVED.
18. Downstream/runtime consumers read APPROVED only.

## Parallelism rule

Parallelize **across passage production units**, never by letting one unit skip its dependency chain or consume WIP upstream artifacts.

Production order remains learner delivery order: P1 RS01→RS15, then P2 RS01→RS15, through P10.

## Agent readiness definition

An agent is operational only when it has:

1. stable role ID/name;
2. creator/QA mode;
3. execution type;
4. owned/reviewed artifact type;
5. immutable required inputs;
6. exact output schema;
7. allowed result states;
8. applicable acceptance-criteria IDs;
9. forbidden actions;
10. touchback routing rules;
11. self-validation/QA checklist;
12. retry/escalation behaviour;
13. machine-check dependencies;
14. WIP/APPROVED rules;
15. one positive fixture;
16. one negative/blocker fixture.

## Initial rollout

- Register all 16 agents first.
- Prove one passage can traverse R01→QA08 with no out-of-band repair.
- Then run one complete P1 round of 15 passages.
- Only after that round passes should concurrency scale across all 150 Band-A production units.
