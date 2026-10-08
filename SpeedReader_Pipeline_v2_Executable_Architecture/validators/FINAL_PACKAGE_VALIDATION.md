# Final Package Machine Validation Contract

Role 8/final QA must execute, not merely describe, these checks:

1. Strict UTF-8 / JSON parse.
2. Duplicate-key rejection.
3. Canonical AJV JSON Schema validation.
4. Required enums/types/additional-property policy.
5. Referential integrity across assessment, meaning units, BPC, scoring and outcome artifacts.
6. Upstream fidelity against exact approved source artifacts.
7. Version/hash/package-lock integrity.
8. Current-input check: no stale approved hash.
9. Required QA certificate check for each semantic stage.
10. Durable promotion/ingestion smoke test.

Each check emits versioned executable evidence: validator name/version, command/function, PASS/FAIL/NOT_EXECUTED and exact failures. Any mandatory `NOT_EXECUTED` prevents final PASS.
