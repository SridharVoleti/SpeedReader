# Migration from v1 16-Agent Contracts to v2

## Retired as LLM agents

- Role 1 Creator/QA -> deterministic registry/spec validator.
- Role 7 Creator/QA -> deterministic outcome/state engine.
- Role 8 Creator/QA -> deterministic assembler + machine final validator.

Their governance requirements remain; only the executor changes from prompt to code.

## Retained as LLM creator + independent QA

- Role 2 Passage Author
- Role 3 Assessment Author
- Role 4 Meaning Units
- Role 5 BPC
- Role 6 semantic mapping portion

## Common contract

The duplicated v1 common contract is replaced by `contracts/COMMON_AGENT_CONTRACT.md`, injected at runtime. Role files contain only stage-specific instructions.

## State

Prompt/session memory is no longer pipeline state. SQLite + immutable artifact files + QA certificates become the state of record.

## Routing

Agents only report structured blockers. The orchestrator performs routing, retry counting, invalidation and escalation.
