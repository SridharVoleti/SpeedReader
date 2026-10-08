# SpeedReader Pipeline v2 - implementation notes

Local, durable, resumable World 1 Band A content-production pipeline. Design source:
[`SpeedReader_Pipeline_v2_Executable_Architecture/`](../../../../SpeedReader_Pipeline_v2_Executable_Architecture/).
**No LLM/model API is used or importable here.** SQLite (`node:sqlite`, Node >= 22.13) is local state only.

```
node tools/pipeline/pipeline.mjs <command> ...        (or: npm run pipeline -- <command> ...)
```

| command | purpose |
|---|---|
| `register <ids...>` / `--phase-a` | create production units (all 8 work items, Role 1 queued) |
| `status` / `jobs` / `passage <id>` / `defects` | state of the factory |
| `next` / `resume` | recover files, run Roles 1/7/8 where eligible, show the next READY Cowork job |
| `export-job <n>` | write `job-00000n.packet.json` (schema-validated envelope) + `.prompt.md` (self-contained) |
| `import-result <n> <file> --run-ref <cowork-task>` | validate and import a creator or QA result; creator import ends with `READY_FOR_INDEPENDENT_QA` and the QA packet, then STOPs |
| `retry <n>` | re-issue a lost exported job (no attempt spent) |
| `validate <id>` | Role 8 machine validation (dry run) |
| `resolve <id> <role> --note` | record a human decision on an escalated item |
| `canonical-check` | canonical package identity, freeze status and canonical gaps |
| `count100 --text/--file` | canonical COUNT-100 tokenization |
| `demo-phase-a` | Phase-A infrastructure demonstration with SIMULATED results (own folder) |

Production options: `--root`, `--canonical-dir`. A canonical package without an independent-QA PASS certification
(FG-06) is refused unless `--allow-candidate` is given. `--ack-gap <id>` and `--interim-schema` exist for infrastructure
demonstrations only; acknowledged gaps are stamped on every packet and artifact as authority caveats.

## Modules

| module | role |
|---|---|
| `count100.ts` | the ONE canonical tokenizer (COUNT-100 v2.0) + SEGMENT-1.0 thirds/quartiles |
| `canonical.ts`, `registry.ts`, `csv.ts` | version/hash lock of the canonical package, 15x10 registry validation, freeze certification check |
| `db.ts` | SQLite schema, transactions, append-only history, immutable artifact identity |
| `store.ts` | versioned WIP/approved files on top of the existing durable store (`../pipeline/storage.ts`) |
| `role1.ts` / `role7.ts` / `role8.ts` | deterministic passage spec / ATTEMPT-OUTCOME-1.0 machine / final assembly + validation |
| `engine.ts` | state machine, queue, export/import, QA-gated promotion, touchback, invalidation, retry/escalation |
| `packets.ts`, `excerpts.ts`, `gaps.ts`, `machine-checks.ts` | Cowork packets, canonical excerpts, canonical-gap gate, code-decided mechanical checks |
| `cli.ts`, `demo.ts` | the commands and the Phase-A demonstration |

## Rules enforced in code

* Creators and code write WIP only. `APPROVED` requires an independent QA PASS bound to the exact content hash (or a
  deterministic machine certificate for Roles 1/7/8). Downstream reads approved artifacts only (approval record re-verified).
* Creator and QA must come from different Cowork contexts (`--run-ref` differs); a creator cannot return PASS; QA cannot
  carry or repair an artifact; QA packets contain no creator reasoning.
* Jobs are pinned to the approved upstream hashes they were built from; a changed hash makes the job `STALE` and its result is rejected.
* A defect is routed to its true owner: owner upstream -> detector `BLOCKED_UPSTREAM` (no retry spent), owner reopened with a
  correction job; after fresh QA approval of the corrected hash, only artifacts whose recorded inputs no longer match are
  invalidated. Code-owned roles and `CANONICAL_OWNER` defects escalate to a human.
* 3 counted creator failures -> `ESCALATED_HUMAN_REVIEW`; the same blocker fingerprint twice in a row escalates early.
  A confirmed upstream defect counts against the owner's budget, never the detector's.
* Missing canonical inputs fail closed as `BLOCKED_CANONICAL_INPUT` naming exactly what is missing (`gaps.ts`).

## Runtime requirement

`node:sqlite` needs Node >= 22.13. The launcher checks this. (This machine's `nvm` symlink points at a missing Node 20.11.1;
the tests were run with the Node 22.13.1 binary bundled with the Playwright Go driver.)
