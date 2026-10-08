# SpeedReader Pipeline v2 — Executable Production Architecture

This package replaces the prompt-only 16-agent design with a hybrid pipeline:

- **Code-owned roles:** Role 1 (Passage Specification), Role 7 (Attempt Outcome State Machine), Role 8 (Final Assembly/Validation).
- **LLM-owned semantic roles:** Roles 2, 3, 4, 5 and the semantic mapping portion of Role 6.
- **Independent fresh-context QA:** one QA run for each LLM-owned semantic role.
- **Local orchestrator:** SQLite-backed state, queue, retry cap, defect routing, approvals, hash invalidation and restart recovery.
- **No model API is required by SQLite or by the orchestrator itself.** The included orchestrator defaults to `MANUAL_PACKET` mode: it writes a job packet, a human/ChatGPT Work/Codex/Claude session executes the job, and the result is imported. A future API runner is optional.

## Why SQLite does not imply API usage

SQLite is an embedded database file. `orchestrator.py` uses only Python's standard-library `sqlite3` module. It stores pipeline state on the same computer as the project. It makes no network calls and imports no LLM SDK.

There are two execution modes:

1. **MANUAL_PACKET (recommended pilot):** local code manages state and emits job packets. You launch the semantic job in the tool/session you choose, save its JSON response, and import it. No model API is required.
2. **AUTOMATED_RUNNER (optional later):** a runner can consume queued jobs automatically. If that runner directly invokes a hosted LLM, it would need that provider's API or another supported automation mechanism. SQLite still remains local.

Fully unattended overnight semantic generation is therefore a separate decision from using SQLite.

## Pilot scope

Start with the frozen **World 1 Band A 150-passage scope**, not all 1,500 passages. The canonical acceptance-criteria file is packaged under `canonical/`. The rest of the canonical package (approved registry, exact schemas/matrices, tokenizer rules and other normative artifacts) must be added and hash-locked before production. The manifest intentionally fails closed while those required artifacts are absent.

## Package layout

- `canonical/` — authoritative package inputs and version/hash manifest.
- `contracts/` — one shared common LLM contract + 10 lean role-specific contracts.
- `deterministic/` — executable contracts for Roles 1, 7 and 8.
- `orchestrator/` — SQLite schema, local CLI scaffold, schemas and tests.
- `validators/` — contracts for COUNT-100, AJV/final validation and shared machine checks.
- `pilot/` — 3-stage rollout, metrics and operating runbook.
- `migration/` — migration from the v1 16-agent prompt model.

## Operational retry rule

The v2 operational default is **3 creator attempts per artifact version**. This is an orchestration rule, not a frozen pedagogical Knowledge Map rule. After the third QA failure, the unit enters `ESCALATED_HUMAN_REVIEW`. Upstream-caused failures do not consume the downstream role's retry budget. The same blocker fingerprint appearing twice consecutively also triggers early escalation.
